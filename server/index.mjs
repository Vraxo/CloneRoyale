import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createGame, stepGame, SIMULATION_STEP, canPlaceCard, snapToArenaTile, playCard, ReplayRecorder, STARTER_DECK } from "../dist-server/simulation.js";

const root = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const rooms = new Map();
const clients = new Set();
const matchmakingQueue = [];
const PORT = Number(process.env.PORT ?? 3001);
const MAX_MESSAGE_BYTES = 16_384;
const RECONNECT_GRACE_SECONDS = 30;
const MAX_MATCHMAKING_QUEUE = 200;
const reconnectTimers = new Map();

function send(client, payload) {
  if (client.closed || !client.socket) return;
  const body = Buffer.from(JSON.stringify(payload));
  let header;
  if (body.length < 126) header = Buffer.from([0x81, body.length]);
  else if (body.length <= 65_535) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(body.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(body.length), 2); }
  client.socket.write(Buffer.concat([header, body]));
}
function broadcast(room, payload) { for (const player of room.players.values()) send(player, payload); }
function playerSummaries(room) {
  return [...room.players.values()].map(player => ({ side: player.side, name: player.name }));
}
function sendRoom(room) {
  broadcast(room, { type: "room", code: room.code, players: playerSummaries(room), status: room.state ? "playing" : "waiting" });
}
function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) code += alphabet[randomBytes(1)[0] % alphabet.length];
  return code;
}
function attachPlayer(room, client, side) {
  client.room = room; client.side = side; room.players.set(client.id, client);
  send(client, { type: "assigned", side, code: room.publicMatch ? null : room.code, publicMatch: room.publicMatch, resumeToken: client.resumeToken, name: client.name });
  if (!room.publicMatch) sendRoom(room);
  if (room.players.size === 2 && [...room.players.values()].every(player => !player.disconnected)) {
    room.seed = randomBytes(4).readUInt32BE(0);
    room.state = createGame(room.seed);
    room.replayRecorder = new ReplayRecorder(room.seed, STARTER_DECK, undefined, "online");
    room.replaySent = false;
    room.lastUpdate = Date.now();
    broadcast(room, { type: "match-start", state: room.state, players: playerSummaries(room) });
  }
}
function isSocketUsable(client) {
  return !client.closed && Boolean(client.socket) && !client.socket.destroyed && client.socket.writable;
}
function pruneMatchmakingQueue() {
  let changed = false;
  for (let index = matchmakingQueue.length - 1; index >= 0; index -= 1) {
    const client = matchmakingQueue[index];
    if (isSocketUsable(client) && !client.room) continue;
    matchmakingQueue.splice(index, 1);
    client.queued = false;
    changed = true;
  }
  if (changed) broadcastQueueStatus();
  return changed;
}
function removeFromQueue(client, notify = false) {
  const index = matchmakingQueue.indexOf(client);
  if (index < 0) return false;
  matchmakingQueue.splice(index, 1);
  client.queued = false;
  if (notify) send(client, { type: "queue-cancelled" });
  broadcastQueueStatus();
  return true;
}
function broadcastQueueStatus() {
  const waiting = matchmakingQueue.length;
  matchmakingQueue.forEach((client, index) => {
    send(client, { type: "queue-status", waiting, position: index + 1 });
  });
}
function startMatchedRoom(first, second) {
  if (!isSocketUsable(first) || !isSocketUsable(second) || first.room || second.room) return false;
  first.queued = false;
  second.queued = false;
  const room = { code: "PUBLIC-" + randomBytes(8).toString("hex"), players: new Map(), state: null, lastUpdate: Date.now(), accumulator: 0, publicMatch: true };
  rooms.set(room.code, room);
  attachPlayer(room, first, "blue");
  attachPlayer(room, second, "red");
  return true;
}
function joinMatchmaking(client) {
  if (!isSocketUsable(client)) return;
  if (client.room) {
    send(client, { type: "error", message: "Leave your current room before searching for another match." });
    return;
  }
  pruneMatchmakingQueue();
  if (client.queued) {
    const index = matchmakingQueue.indexOf(client);
    send(client, { type: "queue-status", waiting: matchmakingQueue.length, position: index + 1 });
    return;
  }
  let opponent = null;
  while (matchmakingQueue.length > 0 && !opponent) {
    const candidate = matchmakingQueue.shift();
    candidate.queued = false;
    if (isSocketUsable(candidate) && !candidate.room) opponent = candidate;
  }
  if (opponent) {
    client.queued = false;
    if (!startMatchedRoom(opponent, client)) {
      if (isSocketUsable(opponent) && !opponent.room) {
        matchmakingQueue.unshift(opponent);
        opponent.queued = true;
      }
      if (matchmakingQueue.length < MAX_MATCHMAKING_QUEUE) {
        matchmakingQueue.push(client);
        client.queued = true;
      } else send(client, { type: "error", message: "The matchmaking queue is full. Please try again shortly." });
    }
    broadcastQueueStatus();
    return;
  }
  if (matchmakingQueue.length >= MAX_MATCHMAKING_QUEUE) {
    send(client, { type: "error", message: "The matchmaking queue is full. Please try again shortly." });
    return;
  }
  matchmakingQueue.push(client);
  client.queued = true;
  broadcastQueueStatus();
}
function createRoom(client) {
  let code;
  do { code = makeCode(); } while (rooms.has(code));
  const room = { code, players: new Map(), state: null, lastUpdate: Date.now(), accumulator: 0, publicMatch: false };
  rooms.set(code, room); attachPlayer(room, client, "blue");
}
function leaveRoom(client) {
  const room = client.room;
  if (!room) return;
  const timer = reconnectTimers.get(client.resumeToken);
  if (timer) clearTimeout(timer);
  reconnectTimers.delete(client.resumeToken);
  room.players.delete(client.id); client.room = null; client.side = null; client.rematchReady = false;
  if (room.players.size === 0 || room.state) { rooms.delete(room.code); }
  if (room.players.size > 0) {
    broadcast(room, { type: "opponent-left" });
    if (!room.state) sendRoom(room);
  }
}
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
  if (message.type === "find-match") { joinMatchmaking(client); return; }
  if (message.type === "cancel-matchmaking") { removeFromQueue(client, true); return; }
  if (message.type === "create-room") { removeFromQueue(client); if (client.room) leaveRoom(client); createRoom(client); return; }
  if (message.type === "join-room") {
    const room = rooms.get(String(message.code ?? "").trim().toUpperCase());
    if (!room) { send(client, { type: "error", message: "Room not found. Check the code and try again." }); return; }
    if (client.room === room) { sendRoom(room); return; }
    if (room.players.size >= 2 || room.state) { send(client, { type: "error", message: "That room is already full." }); return; }
    removeFromQueue(client);
    if (client.room) leaveRoom(client);
    if (rooms.get(room.code) !== room || room.players.size >= 2 || room.state) {
      send(client, { type: "error", message: "That room is no longer available." });
      return;
    }
    attachPlayer(room, client, "red");
    return;
  }
  if (message.type === "leave-room") { removeFromQueue(client); leaveRoom(client); return; }
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
function requestRematch(client) {
  const room = client.room;
  if (!room?.state?.gameOver || !client.side || client.disconnected) return;
  client.rematchReady = true;
  const ready = [...room.players.values()].filter(player => player.rematchReady && !player.disconnected).length;
  broadcast(room, { type: "rematch-status", ready, total: room.players.size });
  if (room.players.size !== 2 || ready !== 2) return;
  for (const player of room.players.values()) player.rematchReady = false;
  room.seed = randomBytes(4).readUInt32BE(0);
  room.state = createGame(room.seed);
  room.replayRecorder = new ReplayRecorder(room.seed, STARTER_DECK, undefined, "online");
  room.replaySent = false;
  room.lastUpdate = Date.now();
  room.accumulator = 0;
  broadcast(room, { type: "rematch-start", state: room.state, players: playerSummaries(room) });
}

function resumePlayer(client, token) {
  if (typeof token !== "string" || token.length < 24 || token.length > 128) {
    send(client, { type: "resume-failed" });
    return;
  }
  for (const room of rooms.values()) {
    const player = [...room.players.values()].find(candidate => candidate.resumeToken === token);
    if (!player || !player.disconnected) continue;
    const timer = reconnectTimers.get(token);
    if (timer) clearTimeout(timer);
    reconnectTimers.delete(token);
    room.players.delete(player.id);
    client.room = room;
    client.side = player.side;
    client.resumeToken = token;
    client.name = player.name;
    client.disconnected = false;
    client.queued = false;
    client.rematchReady = false;
    room.players.set(client.id, client);
    clients.add(client);
    send(client, { type: "resumed", side: client.side, code: room.publicMatch ? null : room.code, publicMatch: room.publicMatch, state: room.state, resumeToken: token, name: client.name, players: playerSummaries(room) });
    for (const opponent of room.players.values()) {
      if (opponent !== client && !opponent.disconnected) send(opponent, { type: "opponent-reconnected", side: client.side });
    }
    if (room.state && room.players.size === 2) room.lastUpdate = Date.now();
    else sendRoom(room);
    return;
  }
  send(client, { type: "resume-failed" });
}
function closeClient(client) {
  if (client.closed) return;
  client.closed = true;
  removeFromQueue(client);
  clients.delete(client.id);
  if (client.room && client.room.state && !client.room.state.gameOver) {
    const room = client.room;
    client.disconnected = true;
    client.socket = null;
    broadcast(room, { type: "opponent-disconnected", graceSeconds: RECONNECT_GRACE_SECONDS });
    const timer = setTimeout(() => {
      reconnectTimers.delete(client.resumeToken);
      if (!client.disconnected || client.room !== room) return;
      leaveRoom(client);
    }, RECONNECT_GRACE_SECONDS * 1000);
    reconnectTimers.set(client.resumeToken, timer);
    return;
  }
  leaveRoom(client);
  client.socket?.end();
}
function decodeFrames(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);
  while (client.buffer.length >= 2) {
    const first = client.buffer[0]; const second = client.buffer[1]; const opcode = first & 0x0f; const masked = (second & 0x80) !== 0;
    let length = second & 0x7f; let offset = 2;
    if (length === 126) { if (client.buffer.length < 4) return; length = client.buffer.readUInt16BE(2); offset = 4; }
    else if (length === 127) { if (client.buffer.length < 10) return; const wide = client.buffer.readBigUInt64BE(2); if (wide > BigInt(MAX_MESSAGE_BYTES)) return closeClient(client); length = Number(wide); offset = 10; }
    if (length > MAX_MESSAGE_BYTES) return closeClient(client);
    const maskLength = masked ? 4 : 0;
    if (client.buffer.length < offset + maskLength + length) return;
    let payload = client.buffer.subarray(offset + maskLength, offset + maskLength + length);
    if (masked) { const mask = client.buffer.subarray(offset, offset + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4]; }
    client.buffer = client.buffer.subarray(offset + maskLength + length);
    if (opcode === 8) return closeClient(client);
    if (opcode === 9) { client.socket.write(Buffer.from([0x8a, 0x00])); continue; }
    if (opcode !== 1) continue;
    try { handleMessage(client, JSON.parse(payload.toString("utf8"))); } catch { send(client, { type: "error", message: "Invalid message." }); }
  }
}
function contentType(path) {
  const ext = extname(path);
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".ogg": "audio/ogg", ".opus": "audio/opus", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json; charset=utf-8" })[ext] ?? "application/octet-stream";
}
const server = createServer(async (request, response) => {
  if (request.url === "/healthz") { response.writeHead(200, { "content-type": "text/plain" }).end("ok"); return; }
  if (request.url === "/matchmaking-status") {
    pruneMatchmakingQueue();
    const publicMatches = [...rooms.values()].filter(room => room.publicMatch && room.state && !room.state.gameOver).length;
    const privateRooms = [...rooms.values()].filter(room => !room.publicMatch).length;
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(JSON.stringify({
      connectedClients: [...clients].filter(isSocketUsable).length,
      queuedPlayers: matchmakingQueue.length,
      activePublicMatches: publicMatches,
      privateRooms
    }));
    return;
  }
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  let filePath = resolve(root, "." + pathname);
  if (!filePath.startsWith(root + sep) && filePath !== root) { response.writeHead(403).end("Forbidden"); return; }
  try {
    const info = await stat(filePath); if (info.isDirectory()) filePath = resolve(filePath, "index.html");
    const content = await readFile(filePath);
    const isHashedAsset = filePath.includes(sep + "assets" + sep);
    const cacheControl = isHashedAsset
      ? "public, max-age=31536000, immutable"
      : "no-cache";
    response.writeHead(200, { "content-type": contentType(filePath), "cache-control": cacheControl }).end(content);
  } catch {
    try { const content = await readFile(resolve(root, "index.html")); response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(content); }
    catch { response.writeHead(404).end("Not found. Build the client with npm run build."); }
  }
});
server.on("upgrade", (request, socket) => {
  if (new URL(request.url ?? "/", "http://localhost").pathname !== "/ws") { socket.destroy(); return; }
  const key = request.headers["sec-websocket-key"];
  if (typeof key !== "string" || request.headers.upgrade?.toLowerCase() !== "websocket") { socket.destroy(); return; }
  const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write(["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", "Sec-WebSocket-Accept: " + accept, "", ""].join("\r\n"));
  const client = { id: randomBytes(12).toString("hex"), guestId: null, resumeToken: randomBytes(32).toString("hex"), socket, buffer: Buffer.alloc(0), room: null, side: null, name: "Guest", queued: false, closed: false, disconnected: false, rematchReady: false, lastSeen: Date.now() };
  clients.add(client); socket.on("data", chunk => decodeFrames(client, chunk)); socket.on("close", () => closeClient(client)); socket.on("error", () => closeClient(client));
  send(client, { type: "connected" });
});
setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.state || room.state.gameOver || room.players.size !== 2 || [...room.players.values()].some(player => player.disconnected)) continue;
    const now = Date.now(); const elapsed = Math.min((now - room.lastUpdate) / 1000, 0.1); room.lastUpdate = now;
    room.accumulator += elapsed;
    while (room.accumulator >= SIMULATION_STEP) { stepGame(room.state, SIMULATION_STEP, null, true); room.accumulator -= SIMULATION_STEP; }
    broadcast(room, { type: "state", state: room.state });
    if (room.state.gameOver && !room.replaySent && room.replayRecorder) {
      room.replaySent = true;
      const replay = room.replayRecorder.finish(room.state);
      broadcast(room, { type: "match-replay", replay });
    }
    room.state.audioEvents = [];
  }
}, SIMULATION_STEP * 1000);
server.listen(PORT, "0.0.0.0", () => console.log("Clone Royale server listening on " + PORT));