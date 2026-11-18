import { createServer } from "node:http";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createGame, stepGame, SIMULATION_STEP, canPlaceCard, snapToArenaTile, playCard, ReplayRecorder, STARTER_DECK } from "../dist-server/simulation.js";
import { createReplayArchive } from "./replayArchive.mjs";
import { createHttpHandler } from "./httpHandler.mjs";
import { createWebSocketTransport } from "./webSocketTransport.mjs";
import { createMatchmaking } from "./matchmaking.mjs";
import { createRoomLifecycle } from "./roomLifecycle.mjs";
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


function broadcast(room, payload) { for (const player of room.players.values()) send(player, payload); }
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
const MATCH_EMOTE_COUNT = 12;
const EMOTE_COOLDOWN_MS = 1200;
function handleEmote(client, message) {
  const room = client.room;
  const emoteId = message.emoteId;
  if (!room?.state || !client.side || client.disconnected) return;
  if (!Number.isInteger(emoteId) || emoteId < 0 || emoteId >= MATCH_EMOTE_COUNT) return;
  const now = Date.now();
  if (now - (client.lastEmoteAt ?? 0) < EMOTE_COOLDOWN_MS) return;
  client.lastEmoteAt = now;
  broadcast(room, { type: "emote", side: client.side, emoteId, name: client.name });
}
function handleMessage(client, message) {
  if (!message || typeof message.type !== "string") return;
  if (message.type === "emote") { handleEmote(client, message); return; }
  if (message.type === "resume") { resumePlayer(client, message.token); return; }
  if (message.type === "set-profile") {
    const rawName = typeof message.name === "string" ? message.name : "";
    const name = rawName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16) || "Guest";
    const guestId = typeof message.guestId === "string" && /^[a-f0-9-]{36}$/i.test(message.guestId)
      ? message.guestId : client.guestId;
    client.guestId = guestId;
    client.name = name;
    if (client.room) broadcast(client.room, { type: "players-updated", players: playerSummaries(client.room) });
    return;
  }
  if (message.type === "rematch-ready") { requestRematch(client); return; }
  if (message.type === "find-match") { matchmaking.join(client); return; }
  if (message.type === "cancel-matchmaking") { matchmaking.remove(client, true); return; }
  if (message.type === "create-room") { matchmaking.remove(client); if (client.room) leaveRoom(client); createRoom(client); return; }
  if (message.type === "join-room") {
    const room = rooms.get(String(message.code ?? "").trim().toUpperCase());
    if (!room) { send(client, { type: "error", message: "Room not found. Check the code and try again." }); return; }
    if (client.room === room) { sendRoom(room); return; }
    if (room.players.size >= 2 || room.state) { send(client, { type: "error", message: "That room is already full." }); return; }
    matchmaking.remove(client);
    if (client.room) leaveRoom(client);
    if (rooms.get(room.code) !== room || room.players.size >= 2 || room.state) {
      send(client, { type: "error", message: "That room is no longer available." });
      return;
    }
    attachPlayer(room, client, "red");
    return;
  }
  if (message.type === "leave-room") { matchmaking.remove(client); leaveRoom(client); return; }
  if (message.type !== "play-card" || !client.room?.state || !client.side) return;
  const state = client.room.state; const side = client.side;
  if (state.gameOver) return;
  const cardId = message.cardId; const x = Number(message.x); const y = Number(message.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || typeof cardId !== "string") return;
  const point = snapToArenaTile({ x, y });
  if (!canPlaceCard(state, side, cardId, point.x, point.y)) { send(client, { type: "action-error", message: "That card cannot be deployed there." }); return; }
  const lane = point.x < 360 ? "left" : "right";
  if (!playCard(state, side, cardId, lane, point.x, point.y, point)) { send(client, { type: "action-error", message: "That card is no longer available." }); return; }
  client.room.replayRecorder?.record(state, side, cardId, point.x, point.y);
  broadcast(client.room, { type: "state", state });
  state.audioEvents = [];
}
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