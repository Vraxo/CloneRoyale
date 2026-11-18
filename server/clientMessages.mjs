import { canPlaceCard, snapToArenaTile, playCard } from "../dist-server/simulation.js";

const MATCH_EMOTE_COUNT = 12;
const EMOTE_COOLDOWN_MS = 1200;

export function createClientMessageHandler(options) {
  const {
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
  } = options;

  const handlers = new Map();

  function register(type, handler) {
    handlers.set(type, handler);
  }

  register("emote", (client, message) => {
    const room = client.room;
    const emoteId = message.emoteId;
    if (!room?.state || !client.side || client.disconnected) return;
    if (!Number.isInteger(emoteId) || emoteId < 0 || emoteId >= MATCH_EMOTE_COUNT) return;
    const now = Date.now();
    if (now - (client.lastEmoteAt ?? 0) < EMOTE_COOLDOWN_MS) return;
    client.lastEmoteAt = now;
    broadcast(room, { type: "emote", side: client.side, emoteId, name: client.name });
  });

  register("resume", (client, message) => resumePlayer(client, message.token));

  register("set-profile", (client, message) => {
    const rawName = typeof message.name === "string" ? message.name : "";
    const name = rawName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16) || "Guest";
    const guestId = typeof message.guestId === "string" && /^[a-f0-9-]{36}$/i.test(message.guestId)
      ? message.guestId : client.guestId;
    client.guestId = guestId;
    client.name = name;
    if (client.room) broadcast(client.room, { type: "players-updated", players: playerSummaries(client.room) });
  });

  register("rematch-ready", client => requestRematch(client));
  register("find-match", client => matchmaking.join(client));
  register("cancel-matchmaking", client => matchmaking.remove(client, true));

  register("create-room", client => {
    matchmaking.remove(client);
    if (client.room) leaveRoom(client);
    createRoom(client);
  });

  register("join-room", (client, message) => {
    const room = rooms.get(String(message.code ?? "").trim().toUpperCase());
    if (!room) {
      send(client, { type: "error", message: "Room not found. Check the code and try again." });
      return;
    }
    if (client.room === room) {
      sendRoom(room);
      return;
    }
    if (room.players.size >= 2 || room.state) {
      send(client, { type: "error", message: "That room is already full." });
      return;
    }
    matchmaking.remove(client);
    if (client.room) leaveRoom(client);
    if (rooms.get(room.code) !== room || room.players.size >= 2 || room.state) {
      send(client, { type: "error", message: "That room is no longer available." });
      return;
    }
    attachPlayer(room, client, "red");
  });

  register("leave-room", client => {
    matchmaking.remove(client);
    leaveRoom(client);
  });

  register("play-card", (client, message) => {
    if (!client.room?.state || !client.side) return;
    const state = client.room.state;
    const side = client.side;
    if (state.gameOver) return;
    const cardId = message.cardId;
    const x = Number(message.x);
    const y = Number(message.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || typeof cardId !== "string") return;
    const point = snapToArenaTile({ x, y });
    if (!canPlaceCard(state, side, cardId, point.x, point.y)) {
      send(client, { type: "action-error", message: "That card cannot be deployed there." });
      return;
    }
    const lane = point.x < 360 ? "left" : "right";
    if (!playCard(state, side, cardId, lane, point.x, point.y, point)) {
      send(client, { type: "action-error", message: "That card is no longer available." });
      return;
    }
    client.room.replayRecorder?.record(state, side, cardId, point.x, point.y);
    broadcast(client.room, { type: "state", state });
    state.audioEvents = [];
  });

  return function handleMessage(client, message) {
    if (!message || typeof message.type !== "string") return;
    handlers.get(message.type)?.(client, message);
  };
}
