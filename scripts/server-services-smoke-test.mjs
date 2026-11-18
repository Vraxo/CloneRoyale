import assert from "node:assert/strict";
import { createMatchmaking, createRoomLifecycle, createClientMessageHandler } from "../dist-server/services.js";

function makeClient(id) {
  return {
    id,
    name: id,
    socket: {},
    closed: false,
    disconnected: false,
    queued: false,
    room: null,
    side: null,
    resumeToken: "resume-token-" + id.padEnd(32, "x"),
    rematchReady: false
  };
}

function createRandomBytes() {
  return size => Buffer.alloc(size, 7);
}

function testMatchmaking() {
  const queue = [];
  const rooms = new Map();
  const messages = new Map();
  const attached = [];
  const send = (client, message) => {
    const list = messages.get(client.id) ?? [];
    list.push(message);
    messages.set(client.id, list);
  };
  const matchmaking = createMatchmaking({
    queue,
    rooms,
    randomBytes: createRandomBytes(),
    attachPlayer: (room, client, side) => {
      client.room = room;
      client.side = side;
      room.players.set(client.id, client);
      attached.push({ id: client.id, side });
    },
    isSocketUsable: client => !client.closed && Boolean(client.socket),
    send,
    maxQueue: 2
  });

  const first = makeClient("first");
  const second = makeClient("second");
  matchmaking.join(first);
  assert.equal(matchmaking.size, 1);
  assert.equal(first.queued, true);
  assert.deepEqual(messages.get("first").at(-1), { type: "queue-status", waiting: 1, position: 1 });

  matchmaking.join(second);
  assert.equal(matchmaking.size, 0, "The second player should immediately match with the first.");
  assert.deepEqual(attached, [
    { id: "first", side: "blue" },
    { id: "second", side: "red" }
  ]);
  assert.equal(first.queued, false);
  assert.equal(second.queued, false);
  assert.equal(rooms.size, 1);
  assert.equal([...rooms.values()][0].publicMatch, true);

  const third = makeClient("third");
  matchmaking.join(third);
  matchmaking.join(third);
  assert.equal(matchmaking.size, 1, "Repeated search requests must not duplicate a queue entry.");
  assert.deepEqual(messages.get("third").at(-1), { type: "queue-status", waiting: 1, position: 1 });
  assert.equal(matchmaking.remove(third, true), true);
  assert.equal(third.queued, false);
  assert.equal(matchmaking.remove(third), false);
  assert.deepEqual(messages.get("third").at(-1), { type: "queue-cancelled" });
  assert.equal(matchmaking.size, 0);

  const fifoQueue = [makeClient("fifo-first"), makeClient("fifo-second")];
  fifoQueue.forEach(client => { client.queued = true; });
  const fifoAttached = [];
  const fifoRooms = new Map();
  const fifo = createMatchmaking({
    queue: fifoQueue,
    rooms: fifoRooms,
    randomBytes: createRandomBytes(),
    attachPlayer: (room, client, side) => {
      client.room = room;
      client.side = side;
      room.players.set(client.id, client);
      fifoAttached.push({ id: client.id, side });
    },
    isSocketUsable: client => !client.closed && Boolean(client.socket),
    send,
    maxQueue: 2
  });
  const thirdPlayer = makeClient("fifo-opponent-one");
  fifo.join(thirdPlayer);
  assert.equal(fifo.size, 1);
  assert.deepEqual(fifoAttached, [
    { id: "fifo-first", side: "blue" },
    { id: "fifo-opponent-one", side: "red" }
  ]);
  const fourthPlayer = makeClient("fifo-opponent-two");
  fifo.join(fourthPlayer);
  assert.equal(fifo.size, 0);
  assert.deepEqual(fifoAttached.slice(2), [
    { id: "fifo-second", side: "blue" },
    { id: "fifo-opponent-two", side: "red" }
  ], "Matchmaking must preserve FIFO order across successive matches.");

  const stale = makeClient("stale");
  matchmaking.join(stale);
  stale.closed = true;
  assert.equal(matchmaking.prune(), true);
  assert.equal(matchmaking.size, 0);
  assert.equal(stale.queued, false);
  assert.equal(matchmaking.prune(), false);

  const fullMessages = [];
  const full = createMatchmaking({
    queue: [],
    rooms: new Map(),
    randomBytes: createRandomBytes(),
    attachPlayer: () => assert.fail("A zero-capacity queue cannot create a match."),
    isSocketUsable: client => !client.closed && Boolean(client.socket),
    send: (_client, message) => fullMessages.push(message),
    maxQueue: 0
  });
  full.join(makeClient("rejected"));
  assert.match(fullMessages.at(-1).message, /queue is full/);
}
function testRoomLifecycle() {
  const rooms = new Map();
  const clients = new Set();
  const reconnectTimers = new Map();
  const sent = new Map();
  const broadcasts = [];
  let gameNumber = 0;
  const send = (client, message) => {
    const list = sent.get(client.id) ?? [];
    list.push(message);
    sent.set(client.id, list);
  };
  const broadcast = (room, message) => broadcasts.push({ room: room.code, message });
  const lifecycle = createRoomLifecycle({
    rooms,
    clients,
    reconnectTimers,
    randomBytes: createRandomBytes(),
    createGame: seed => ({ seed, gameOver: false, number: ++gameNumber }),
    ReplayRecorder: class {
      constructor(seed, deck, id, mode) { Object.assign(this, { seed, deck, id, mode }); }
    },
    starterDeck: ["knight"],
    send,
    broadcast,
    playerSummaries: room => [...room.players.values()].map(player => ({ id: player.id, name: player.name })),
    sendRoom: room => broadcast(room, { type: "room", players: [...room.players.keys()] }),
    removeFromMatchmaking: client => { client.queued = false; },
    reconnectGraceSeconds: 30
  });

  const host = makeClient("host");
  clients.add(host);
  lifecycle.createRoom(host);
  const room = host.room;
  assert.ok(room);
  assert.equal(room.publicMatch, false);
  assert.equal(host.side, "blue");
  assert.equal(sent.get(host.id).at(-1).type, "assigned");
  assert.equal(room.state, null);

  const guest = makeClient("guest");
  clients.add(guest);
  lifecycle.attachPlayer(room, guest, "red");
  assert.ok(room.state, "A match must start when both players are attached.");
  assert.equal(room.state.number, 1);
  assert.equal(room.replayRecorder.mode, "online");
  assert.equal(broadcasts.at(-1).message.type, "match-start");

  room.state.gameOver = true;
  lifecycle.requestRematch(host);
  assert.equal(host.rematchReady, true);
  assert.equal(broadcasts.at(-1).message.type, "rematch-status");
  assert.equal(broadcasts.at(-1).message.ready, 1);
  lifecycle.requestRematch(guest);
  assert.equal(room.state.number, 2);
  assert.equal(host.rematchReady, false);
  assert.equal(guest.rematchReady, false);
  assert.equal(broadcasts.at(-1).message.type, "rematch-start");

  lifecycle.closeClient(host);
  assert.equal(host.closed, true);
  assert.equal(host.disconnected, true);
  assert.equal(clients.has(host.id), false);
  assert.equal(broadcasts.at(-1).message.type, "opponent-disconnected");
  assert.equal(reconnectTimers.has(host.resumeToken), true);

  const replacement = makeClient("replacement");
  const resumeToken = host.resumeToken;
  lifecycle.resumePlayer(replacement, "invalid");
  assert.equal(sent.get(replacement.id).at(-1).type, "resume-failed");

  lifecycle.resumePlayer(replacement, resumeToken);
  assert.equal(reconnectTimers.has(resumeToken), false, "Successful resume must clear the grace timer.");
  assert.equal(replacement.room, room);
  assert.equal(replacement.side, "blue");
  assert.equal(replacement.name, host.name);
  assert.equal(replacement.disconnected, false);
  assert.equal(clients.has(replacement), true);
  assert.equal(sent.get(replacement.id).at(-1).type, "resumed");
  assert.equal(sent.get(guest.id).at(-1).type, "opponent-reconnected");

  lifecycle.leaveRoom(replacement);
  assert.equal(replacement.room, null);
  assert.equal(replacement.side, null);
  assert.equal(rooms.has(room.code), false, "Leaving an active match must remove its room.");
  assert.equal(broadcasts.at(-1).message.type, "opponent-left");
  for (const timer of reconnectTimers.values()) clearTimeout(timer);
}

function testClientMessageDispatch() {
  const messages = [];
  const roomUpdates = [];
  const room = { code: "ABCDE", players: new Map(), state: null };
  const client = makeClient("dispatcher");
  client.room = room;
  room.players.set(client.id, client);
  const calls = [];
  const handler = createClientMessageHandler({
    send: (_client, message) => messages.push(message),
    broadcast: (_room, message) => roomUpdates.push(message),
    playerSummaries: currentRoom => [...currentRoom.players.values()].map(player => ({ name: player.name })),
    rooms: new Map([[room.code, room]]),
    matchmaking: {
      join: current => calls.push(["find-match", current.id]),
      remove: (current, notify) => calls.push(["remove", current.id, Boolean(notify)])
    },
    createRoom: current => calls.push(["create-room", current.id]),
    leaveRoom: current => calls.push(["leave-room", current.id]),
    attachPlayer: (...args) => calls.push(["attach-player", ...args]),
    requestRematch: current => calls.push(["rematch-ready", current.id]),
    resumePlayer: (current, token) => calls.push(["resume", current.id, token]),
    sendRoom: currentRoom => roomUpdates.push({ type: "room", code: currentRoom.code })
  });

  handler(client, { type: "not-a-real-message" });
  assert.equal(messages.length, 0, "Unknown message types must be ignored.");

  handler(client, { type: "join-room", code: room.code.toLowerCase() });
  assert.deepEqual(roomUpdates.at(-1), { type: "room", code: room.code },
    "Joining the room a client already occupies should refresh its room state.");

  handler(client, { type: "find-match" });
  handler(client, { type: "rematch-ready" });
  handler(client, { type: "resume", token: "resume-token" });
  assert.deepEqual(calls, [
    ["find-match", client.id],
    ["rematch-ready", client.id],
    ["resume", client.id, "resume-token"]
  ], "Each registered message should dispatch to its own handler.");
}

testMatchmaking();
testRoomLifecycle();
testClientMessageDispatch();
console.log("Server service unit tests passed: matchmaking capacity, duplicate requests, cancellation, FIFO pairing, stale queue cleanup, room creation, match start, rematches, reconnect grace handling, token validation, resume, and room cleanup, and client-message dispatch.");
