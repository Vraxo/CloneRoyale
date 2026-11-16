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
      console.log("smoke received:", message.type);
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
  console.log("waiting for room assignment");
  const assignedPromise = nextMessage(first, message => message.type === "assigned");
  first.send(JSON.stringify({ type: "create-room" }));
  const assigned = await assignedPromise;
  console.log("room assigned", assigned.code);
  assert.equal(assigned.side, "blue");
  assert.equal(assigned.code.length, 5);

  const second = await connect();
  const firstStartPromise = nextMessage(first, message => message.type === "match-start");
  const secondStartPromise = nextMessage(second, message => message.type === "match-start");
  second.send(JSON.stringify({ type: "join-room", code: assigned.code }));
  const [firstStart, secondStart] = await Promise.all([firstStartPromise, secondStartPromise]);
  assert.equal(firstStart.state.time, 0);
  assert.equal(secondStart.state.time, 0);

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

  console.log("Multiplayer smoke test passed: room creation, joining, shared simulation, no AI, and server-validated card deployment.");
} finally {
  for (const socket of sockets) socket.close();
  server.kill("SIGTERM");
}
