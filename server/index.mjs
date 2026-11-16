import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createGame, stepGame, SIMULATION_STEP, canPlaceCard, snapToArenaTile, playCard } from "../dist-server/simulation.js";

const root = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const rooms = new Map();
const clients = new Set();
const PORT = Number(process.env.PORT ?? 3001);
const MAX_MESSAGE_BYTES = 16_384;

function send(client, payload) {
  if (client.closed) return;
  const body = Buffer.from(JSON.stringify(payload));
  let header;
  if (body.length < 126) header = Buffer.from([0x81, body.length]);
  else if (body.length <= 65_535) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(body.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(body.length), 2); }
  client.socket.write(Buffer.concat([header, body]));
}
function broadcast(room, payload) { for (const player of room.players.values()) send(player, payload); }
function sendRoom(room) {
  broadcast(room, { type: "room", code: room.code, players: [...room.players.values()].map(p => ({ side: p.side, name: p.name })), status: room.state ? "playing" : "waiting" });
}
function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) code += alphabet[randomBytes(1)[0] % alphabet.length];
  return code;
}
function attachPlayer(room, client, side) {
  client.room = room; client.side = side; room.players.set(client.id, client);
  send(client, { type: "assigned", side, code: room.code });
  sendRoom(room);
  if (room.players.size === 2) {
    room.state = createGame(randomBytes(4).readUInt32BE(0));
    room.lastUpdate = Date.now();
    broadcast(room, { type: "match-start", state: room.state });
  }
}
function createRoom(client) {
  let code;
  do { code = makeCode(); } while (rooms.has(code));
  const room = { code, players: new Map(), state: null, lastUpdate: Date.now() };
  rooms.set(code, room); attachPlayer(room, client, "blue");
}
function leaveRoom(client) {
  const room = client.room;
  if (!room) return;
  room.players.delete(client.id); client.room = null; client.side = null;
  if (room.players.size === 0) { rooms.delete(room.code); return; }
  broadcast(room, { type: "opponent-left" }); sendRoom(room);
}
function handleMessage(client, message) {
  if (!message || typeof message.type !== "string") return;
  if (message.type === "create-room") { if (client.room) leaveRoom(client); createRoom(client); return; }
  if (message.type === "join-room") {
    const room = rooms.get(String(message.code ?? "").trim().toUpperCase());
    if (!room) { send(client, { type: "error", message: "Room not found. Check the code and try again." }); return; }
    if (room.players.size >= 2 || room.state) { send(client, { type: "error", message: "That room is already full." }); return; }
    if (client.room) leaveRoom(client); attachPlayer(room, client, "red"); return;
  }
  if (message.type === "leave-room") { leaveRoom(client); return; }
  if (message.type !== "play-card" || !client.room?.state || !client.side) return;
  const state = client.room.state; const side = client.side;
  if (state.gameOver) return;
  const cardId = message.cardId; const x = Number(message.x); const y = Number(message.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || typeof cardId !== "string") return;
  const point = snapToArenaTile({ x, y });
  if (!canPlaceCard(state, side, cardId, point.x, point.y)) { send(client, { type: "action-error", message: "That card cannot be deployed there." }); return; }
  const lane = point.x < 360 ? "left" : "right";
  if (!playCard(state, side, cardId, lane, point.x, point.y, point)) { send(client, { type: "action-error", message: "That card is no longer available." }); return; }
  broadcast(client.room, { type: "state", state });
}
function closeClient(client) {
  if (client.closed) return;
  client.closed = true; leaveRoom(client); clients.delete(client); client.socket.end();
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
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".ogg": "audio/ogg", ".opus": "audio/opus", ".woff2": "font/woff2", ".svg": "image/svg+xml" })[ext] ?? "application/octet-stream";
}
const server = createServer(async (request, response) => {
  if (request.url === "/healthz") { response.writeHead(200, { "content-type": "text/plain" }).end("ok"); return; }
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  let filePath = resolve(root, "." + pathname);
  if (!filePath.startsWith(root + sep) && filePath !== root) { response.writeHead(403).end("Forbidden"); return; }
  try {
    const info = await stat(filePath); if (info.isDirectory()) filePath = resolve(filePath, "index.html");
    const content = await readFile(filePath);
    response.writeHead(200, { "content-type": contentType(filePath), "cache-control": filePath.endsWith(".html") ? "no-cache" : "public, max-age=31536000, immutable" }).end(content);
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
  const client = { id: randomBytes(12).toString("hex"), socket, buffer: Buffer.alloc(0), room: null, side: null, name: "Guest", closed: false };
  clients.add(client); socket.on("data", chunk => decodeFrames(client, chunk)); socket.on("close", () => closeClient(client)); socket.on("error", () => closeClient(client));
  send(client, { type: "connected" });
});
setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.state || room.state.gameOver || room.players.size !== 2) continue;
    const now = Date.now(); const elapsed = Math.min((now - room.lastUpdate) / 1000, 0.1); room.lastUpdate = now;
    let remaining = elapsed;
    while (remaining >= SIMULATION_STEP) { stepGame(room.state, SIMULATION_STEP, null); remaining -= SIMULATION_STEP; }
    broadcast(room, { type: "state", state: room.state });
  }
}, SIMULATION_STEP * 1000);
server.listen(PORT, "0.0.0.0", () => console.log("Clone Royale server listening on " + PORT));