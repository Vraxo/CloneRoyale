import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createGame,
  ReplayRecorder,
  SIMULATION_STEP,
  STARTER_DECK,
  stepGame
} from "./simulation.js";
import { createAccountStore } from "./account/accounts.js";
import { createClientMessageHandler } from "./multiplayer/clientMessages.js";
import { createHttpHandler } from "./httpHandler.js";
import { createMatchSimulation } from "./multiplayer/matchSimulation.js";
import { createMatchmaking } from "./multiplayer/matchmaking.js";
import { createReplayArchive } from "./replays/replayArchive.js";
import { createRoomLifecycle } from "./multiplayer/roomLifecycle.js";
import { createWebSocketTransport } from "./multiplayer/webSocketTransport.js";
import type {
  MessageHandler,
  ServerClient,
  ServerRoom
} from "./types.js";

const SERVER_ROOT = resolve(
  fileURLToPath(new URL("../dist/", import.meta.url))
);

const PORT = Number(process.env.PORT ?? 3001);
const MAX_MESSAGE_BYTES = 16_384;
const RECONNECT_GRACE_SECONDS = 30;
const MAX_MATCHMAKING_QUEUE = 200;

const REPLAY_DIRECTORY = resolve(
  process.env.CLONEROYALE_REPLAY_DIR
    ?? fileURLToPath(new URL("../data/replays/", import.meta.url))
);

const ACCOUNT_FILE = resolve(
  process.env.CLONEROYALE_ACCOUNT_FILE
    ?? fileURLToPath(new URL("../data/accounts/accounts.json", import.meta.url))
);

const rooms = new Map<string, ServerRoom>();
const clients = new Set<ServerClient>();
const matchmakingQueue: ServerClient[] = [];
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

const replayArchive = createReplayArchive(REPLAY_DIRECTORY);
const accountStore = createAccountStore(ACCOUNT_FILE);

function send(client: ServerClient, payload: Record<string, unknown>): void {
  websocketTransport.send(client, payload);
}

function broadcast(room: ServerRoom, payload: Record<string, unknown>): void {
  for (const player of room.players.values()) {
    send(player, payload);
  }
}

function playerSummaries(
  room: ServerRoom
): Array<{ side: ServerClient["side"]; name: string }> {
  return [...room.players.values()].map(player => ({
    side: player.side,
    name: player.name
  }));
}

function sendRoom(room: ServerRoom): void {
  broadcast(room, {
    type: "room",
    code: room.code,
    players: playerSummaries(room),
    status: room.state ? "playing" : "waiting"
  });
}

let roomLifecycle: ReturnType<typeof createRoomLifecycle>;

function attachPlayer(
  room: ServerRoom,
  client: ServerClient,
  side: "blue" | "red"
): void {
  roomLifecycle.attachPlayer(room, client, side);
}

function createRoom(client: ServerClient): void {
  roomLifecycle.createRoom(client);
}

function leaveRoom(client: ServerClient): void {
  roomLifecycle.leaveRoom(client);
}

function requestRematch(client: ServerClient): void {
  roomLifecycle.requestRematch(client);
}

function resumePlayer(client: ServerClient, token: unknown): void {
  roomLifecycle.resumePlayer(client, token);
}

function closeClient(client: ServerClient): void {
  roomLifecycle.closeClient(client);
}

function isSocketUsable(client: ServerClient): boolean {
  const socket = client.socket;

  return Boolean(
    !client.closed
    && socket
    && !socket.destroyed
    && socket.writable
  );
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

const httpHandler = createHttpHandler({
  root: SERVER_ROOT,
  replayArchive,
  accountStore,
  pruneMatchmakingQueue: () => matchmaking.prune(),
  getMatchmakingStatus: () => ({
    connectedClients: [...clients].filter(isSocketUsable).length,
    queuedPlayers: matchmaking.size,
    activePublicMatches: [...rooms.values()].filter(room =>
      room.publicMatch && room.state && !room.state.gameOver
    ).length,
    privateRooms: [...rooms.values()].filter(room => !room.publicMatch).length
  })
});

const server = createServer(httpHandler);

let handleClientMessage: MessageHandler = () => {};

function handleMessage(
  client: ServerClient,
  message: Parameters<MessageHandler>[1]
): void {
  handleClientMessage(client, message);
}

const websocketTransport = createWebSocketTransport({
  randomBytes,
  handleMessage,
  closeClient,
  maxMessageBytes: MAX_MESSAGE_BYTES,
  resolveAccount: token => accountStore.resolveSession(token)
});

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

server.listen(PORT, "0.0.0.0", () => {
  console.log("Clone Royale server listening on " + PORT);
});
