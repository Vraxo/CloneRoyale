import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = 31771;
const baseUrl = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["server/index.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: "inherit"
});
const sockets = [];

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) throw new Error("Multiplayer server exited before startup.");
    try {
      const response = await fetch(baseUrl + "/healthz");
      if (response.ok) return;
    } catch { /* Wait for the listener. */ }
    await delay(100);
  }
  throw new Error("Multiplayer server did not become ready.");
}

function connect() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket("ws://127.0.0.1:" + port + "/ws");
    sockets.push(socket);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", () => reject(new Error("WebSocket connection failed.")), { once: true });
  });
}

function nextMessage(socket, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for multiplayer message."));
    }, timeoutMs);
    function onMessage(event) {
      const message = JSON.parse(String(event.data));
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      resolve(message);
    }
    socket.addEventListener("message", onMessage);
  });
}

try {
  await waitForServer();
  const first = await connect();
  first.send(JSON.stringify({ type: "set-profile", guestId: "11111111-1111-4111-8111-111111111111", name: "BluePlayer" }));
  const assignedPromise = nextMessage(first, message => message.type === "assigned");
  first.send(JSON.stringify({ type: "create-room" }));
  const assigned = await assignedPromise;
  assert.equal(assigned.side, "blue");
  assert.equal(assigned.code.length, 5);
  assert.equal(typeof assigned.resumeToken, "string");

  const sameRoomNotice = nextMessage(first, message => message.type === "room" && message.players.length === 1);
  first.send(JSON.stringify({ type: "join-room", code: assigned.code }));
  await sameRoomNotice;
  const activeRoomSearchError = nextMessage(first, message =>
    message.type === "error" && message.message.includes("Leave your current room")
  );
  first.send(JSON.stringify({ type: "find-match" }));
  await activeRoomSearchError;

  const second = await connect();
  second.send(JSON.stringify({ type: "set-profile", guestId: "22222222-2222-4222-8222-222222222222", name: "RedPlayer" }));
  const firstStartPromise = nextMessage(first, message => message.type === "match-start");
  const secondStartPromise = nextMessage(second, message => message.type === "match-start");
  second.send(JSON.stringify({ type: "join-room", code: assigned.code }));
  const [firstStart, secondStart] = await Promise.all([firstStartPromise, secondStartPromise]);
  assert.equal(firstStart.state.time, 0);
  assert.equal(secondStart.state.time, 0);
  assert.deepEqual(firstStart.players.map(player => player.name).sort(), ["BluePlayer", "RedPlayer"]);
  assert.deepEqual(secondStart.players.map(player => player.name).sort(), ["BluePlayer", "RedPlayer"]);

  await delay(1200);
  const liveState = await nextMessage(first, message => message.type === "state");
  assert.equal(liveState.state.sides.blue.cardsPlayed, 0, "Blue must not be controlled by an AI.");
  assert.equal(liveState.state.sides.red.cardsPlayed, 0, "Red must not be controlled by an AI.");

  const cardId = liveState.state.sides.blue.hand[0];
  const deployedPromise = nextMessage(first, message =>
    message.type === "state" && message.state.sides.blue.cardsPlayed === 1
  );
  const opponentViewPromise = nextMessage(second, message =>
    message.type === "state" && message.state.sides.blue.cardsPlayed === 1
  );
  first.send(JSON.stringify({ type: "play-card", cardId, x: 205, y: 700 }));
  const [deployed, opponentView] = await Promise.all([deployedPromise, opponentViewPromise]);
  assert.equal(deployed.state.sides.blue.cardsPlayed, 1);
  assert.equal(opponentView.state.sides.blue.cardsPlayed, 1, "Both clients must receive the same authoritative deployment.");

  const disconnectNotice = nextMessage(second, message => message.type === "opponent-disconnected");
  first.close();
  const disconnected = await disconnectNotice;
  assert.equal(disconnected.graceSeconds, 30);
  await delay(1200);
  const resumedClient = await connect();
  const resumedPromise = nextMessage(resumedClient, message => message.type === "resumed");
  const opponentReconnected = nextMessage(second, message => message.type === "opponent-reconnected");
  resumedClient.send(JSON.stringify({ type: "resume", token: assigned.resumeToken }));
  const resumed = await resumedPromise;
  await opponentReconnected;
  assert.equal(resumed.side, "blue");
  assert.equal(resumed.state.time, deployed.state.time, "The match should pause while a player is disconnected.");
  const resumedStatePromise = nextMessage(second, message => message.type === "state");
  await delay(300);
  assert.ok((await resumedStatePromise).state.time >= resumed.state.time);

  const queuedPlayer = await connect();
  const waitingNotice = nextMessage(queuedPlayer, message => message.type === "queue-status");
  queuedPlayer.send(JSON.stringify({ type: "find-match" }));
  assert.equal((await waitingNotice).waiting, 1);
  const duplicateQueueNotice = nextMessage(queuedPlayer, message => message.type === "queue-status");
  queuedPlayer.send(JSON.stringify({ type: "find-match" }));
  const duplicateQueueStatus = await duplicateQueueNotice;
  assert.equal(duplicateQueueStatus.waiting, 1, "Repeated search requests must not duplicate a queue entry.");
  assert.equal(duplicateQueueStatus.position, 1);
  const queueMetrics = await (await fetch(baseUrl + "/matchmaking-status")).json();
  assert.equal(queueMetrics.queuedPlayers, 1);

  const publicOpponent = await connect();
  const firstPublicStart = nextMessage(queuedPlayer, message => message.type === "match-start");
  const secondPublicStart = nextMessage(publicOpponent, message => message.type === "match-start");
  publicOpponent.send(JSON.stringify({ type: "find-match" }));
  const [publicFirst, publicSecond] = await Promise.all([firstPublicStart, secondPublicStart]);
  assert.equal(publicFirst.state.time, 0);
  assert.equal(publicSecond.state.time, 0);
  const activeMetrics = await (await fetch(baseUrl + "/matchmaking-status")).json();
  assert.equal(activeMetrics.queuedPlayers, 0);
  assert.ok(activeMetrics.activePublicMatches >= 1);

  const cancelPlayer = await connect();
  const cancelQueued = nextMessage(cancelPlayer, message => message.type === "queue-status");
  cancelPlayer.send(JSON.stringify({ type: "find-match" }));
  assert.equal((await cancelQueued).waiting, 1);
  const cancelled = nextMessage(cancelPlayer, message => message.type === "queue-cancelled");
  cancelPlayer.send(JSON.stringify({ type: "cancel-matchmaking" }));
  await cancelled;
  const emptyQueueMetrics = await (await fetch(baseUrl + "/matchmaking-status")).json();
  assert.equal(emptyQueueMetrics.queuedPlayers, 0);

  const disconnectedQueuedPlayer = await connect();
  const disconnectedQueueNotice = nextMessage(disconnectedQueuedPlayer, message => message.type === "queue-status");
  disconnectedQueuedPlayer.send(JSON.stringify({ type: "find-match" }));
  assert.equal((await disconnectedQueueNotice).waiting, 1);
  disconnectedQueuedPlayer.close();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const metrics = await (await fetch(baseUrl + "/matchmaking-status")).json();
    if (metrics.queuedPlayers === 0) break;
    await delay(50);
  }
  const disconnectedQueueMetrics = await (await fetch(baseUrl + "/matchmaking-status")).json();
  assert.equal(disconnectedQueueMetrics.queuedPlayers, 0, "Disconnected players must be removed from the queue.");

  console.log("Multiplayer smoke test passed: private rooms, idempotent room joins, active-room matchmaking protection, FIFO public matchmaking, duplicate queue protection, cancellation, queue disconnect cleanup and metrics, shared simulation, no AI, deployment validation, and 30-second reconnect/resume.");
} finally {
  for (const socket of sockets) socket.close();
  server.kill("SIGTERM");
}
