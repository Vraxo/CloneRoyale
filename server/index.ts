import { createServer } from "node:http";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createGame, stepGame, SIMULATION_STEP, ReplayRecorder, STARTER_DECK } from "./simulation.js";
import { createReplayArchive } from "./replayArchive.js";
import { createHttpHandler } from "./httpHandler.mjs";
import { createWebSocketTransport } from "./webSocketTransport.mjs";
import { createMatchmaking } from "./matchmaking.js";
import { createRoomLifecycle } from "./roomLifecycle.js";
import { createClientMessageHandler } from "./clientMessages.js";
import { createMatchSimulation } from "./matchSimulation.mjs";

const root = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const rooms = new Map();
const clients = new Set();
const matchmakingQueue = [];
const PORT = Number(process.env.PORT ?? 3001);
const MAX_MESSAGE_BYTES = 16_384;
const RECONNECT_GRACE_SECONDS = 30;
const REPLAY_DIRECTORY = resolve(process.env.CLONEROYALE_REPLAY_DIR ?? resolve(fileURLToPath(new URL("../data/replays/", import.meta.url))));
const MAX_MATCHMAKING_QUEUE = 200;
const reconnectTimers = new Map();
const replayArchive = createReplayArchive(REPLAY_DIRECTORY);

function broadcast(room, payload) {
  for (const player of room.players.values()) send(player, payload);
}

function playerSummaries(room) {
  return [...room.players.values()].map(player => ({ side: player.side, name: player.name }));
}

function sendRoom(room) {
  broadcast(room, { type: "room", code: room.code, players: playerSummaries(room), status: room.state ? "playing" : "waiting" });
}

let roomLifecycle;
function attachPlayer(room, client, side) { roomLifecycle.attachPlayer(room, client, side); }
function createRoom(client) { roomLifecycle.createRoom(client); }
function leaveRoom(client) { roomLifecycle.leaveRoom(client); }
function requestRematch(client) { roomLifecycle.requestRematch(client); }
function resumePlayer(client, token) { roomLifecycle.resumePlayer(client, token); }
function closeClient(client) { roomLifecycle.closeClient(client); }

function isSocketUsable(client) {
  return !client.closed && Boolean(client.socket) && !client.socket.destroyed && client.socket.writable;
}

const matchmaking = createMatchmaking({
  queue: matchmakingQueue,
  rooms,
  randomBytes,
  attachPlayer,
  isSocketUsable,
  send: (client, payload) => send(client, payload),
  maxQueue: MAX_MATCHMAKING_QUEUE
});

const server = createServer(createHttpHandler({
  root,
  replayArchive,
  pruneMatchmakingQueue: () => matchmaking.prune(),
  getMatchmakingStatus: () => ({
    connectedClients: [...clients].filter(isSocketUsable).length,
    queuedPlayers: matchmaking.size,
    activePublicMatches: [...rooms.values()].filter(room => room.publicMatch && room.state && !room.state.gameOver).length,
    privateRooms: [...rooms.values()].filter(room => !room.publicMatch).length
  })
}));

let handleClientMessage = () => {};
function handleMessage(client, message) { handleClientMessage(client, message); }
const websocketTransport = createWebSocketTransport({
  randomBytes,
  handleMessage,
  closeClient,
  maxMessageBytes: MAX_MESSAGE_BYTES
});
const send = websocketTransport.send;

roomLifecycle = createRoomLifecycle({
  rooms,
  clients,
  reconnectTimers,
  randomBytes,
  createGame,
  ReplayRecorder,
  starterDeck: STARTER_DECK,
  send,
  broadcast,
  playerSummaries,
  sendRoom,
  removeFromMatchmaking: client => matchmaking.remove(client),
  reconnectGraceSeconds: RECONNECT_GRACE_SECONDS
});

handleClientMessage = createClientMessageHandler({
  send,
  broadcast,
  playerSummaries,
  rooms,
  matchmaking,
  createRoom,
  leaveRoom,
  attachPlayer,
  requestRematch,
  resumePlayer,
  sendRoom
});

websocketTransport.attach(server, clients);

const matchSimulation = createMatchSimulation({
  rooms,
  broadcast,
  stepGame,
  simulationStep: SIMULATION_STEP,
  saveReplay: replayArchive.saveReplay,
  randomBytes
});
matchSimulation.start();
server.listen(PORT, "0.0.0.0", () => console.log("Clone Royale server listening on " + PORT));
