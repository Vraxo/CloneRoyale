import assert from "node:assert/strict";
import { createMatchmaking } from "../server/matchmaking.mjs";
import { createRoomLifecycle } from "../server/roomLifecycle.mjs";

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
    resumeToken: "resume-token-" + id,
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
  const third = makeClient("third");

  matchmaking.join(first);
  assert.equal(matchmaking.size, 1);
  assert.equal(first.queued, true);
  assert.deepEqual(messages.get("first").at(-1), { type: "queue-status", waiting: 1, position: 1 });

  matchmaking.join(first);
  assert.equal(matchmaking.size, 1, "Repeated join must not duplicate a player.");
  assert.deepEqual(messages.get("first").at(-1), { type: "queue-status", waiting: 1, position: 1 });

  matchmaking.join(second);
  assert.equal(matchmaking.size, 2);
  matchmaking.join(third);
  assert.equal(matchmaking.size, 2, "The configured queue capacity must be enforced.");
  assert.match(messages.get("third").at(-1).message, /queue is full/);

  assert.equal(matchmaking.remove(first, true), true);
  assert.equal(first.queued, false);
  assert.equal(matchmaking.remove(first), false);
  assert.deepEqual(messages.get("first").at(-1), { type: "queue-cancelled" });
  assert.equal(matchmaking.size, 1);

  matchmaking.join(third);
  assert.equal(matchmaking.size, 2);
  const publicOpponent = makeClient("public-opponent");
  matchmaking.join(publicOpponent);
  assert.equal(matchmaking.size, 0);
  assert.equal(rooms.size, 1);
  assert.deepEqual(attached, [
    { id: "second", side: "blue" },
    { id: "public-opponent", side: "red" }
  ]);
  assert.equal([...rooms.values()][0].publicMatch, true);
  assert.equal(second.queued, false);
  assert.equal(publicOpponent.queued, false);

  const stale = makeClient("stale");
  matchmaking.join(stale);
  stale.closed = true;
  assert.equal(matchmaking.prune(), true);
  assert.equal(matchmaking.size, 0);
  assert.equal(stale.queued, false);
  assert.equal(matchmaking.prune(), false);
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
  assert.equal(clients.has(replacement.id), true);
  assert.equal(sent.get(replacement.id).at(-1).type, "resumed");
  assert.equal(broadcasts.at(-1).message.type, "opponent-reconnected");

  lifecycle.leaveRoom(replacement);
  assert.equal(replacement.room, null);
  assert.equal(replacement.side, null);
  assert.equal(rooms.has(room.code), false, "Leaving an active match must remove its room.");
  assert.equal(broadcasts.at(-1).message.type, "opponent-left");
  for (const timer of reconnectTimers.values()) clearTimeout(timer);
}

testMatchmaking();
testRoomLifecycle();
console.log("Server service unit tests passed: matchmaking capacity, duplicate requests, cancellation, FIFO pairing, stale queue cleanup, room creation, match start, rematches, reconnect grace handling, token validation, resume, and room cleanup.");
