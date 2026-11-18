import { createHash } from "node:crypto";
import type { Server } from "node:http";
import type { Socket } from "node:net";
import type { RandomBytes, ServerClient } from "./types.js";

interface WebSocketClient extends ServerClient {
  socket: Socket | null;
  buffer: Buffer;
}

interface WebSocketTransportOptions {
  randomBytes: RandomBytes;
  handleMessage: (client: ServerClient, message: any) => void;
  closeClient: (client: ServerClient) => void;
  maxMessageBytes: number;
  resolveAccount: (token: string) => Promise<{ id: string; username: string } | null>;
}

export function createWebSocketTransport(options: WebSocketTransportOptions) {
  const { randomBytes, handleMessage, closeClient, maxMessageBytes, resolveAccount } = options;

  function send(client: ServerClient, payload: Record<string, unknown>): void {
    if (client.closed || !client.socket) return;
    const body = Buffer.from(JSON.stringify(payload));
    let header: Buffer;
    if (body.length < 126) header = Buffer.from([0x81, body.length]);
    else if (body.length <= 65_535) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(body.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(body.length), 2);
    }
    client.socket.write(Buffer.concat([header, body]));
  }

  function decodeFrames(client: WebSocketClient, chunk: Buffer): void {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    while (client.buffer.length >= 2) {
      const first = client.buffer[0];
      const second = client.buffer[1];
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (client.buffer.length < 4) return;
        length = client.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (client.buffer.length < 10) return;
        const wide = client.buffer.readBigUInt64BE(2);
        if (wide > BigInt(maxMessageBytes)) return closeClient(client);
        length = Number(wide);
        offset = 10;
      }
      if (length > maxMessageBytes) return closeClient(client);
      const maskLength = masked ? 4 : 0;
      if (client.buffer.length < offset + maskLength + length) return;
      let payload = client.buffer.subarray(offset + maskLength, offset + maskLength + length);
      if (masked) {
        const mask = client.buffer.subarray(offset, offset + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
      }
      client.buffer = client.buffer.subarray(offset + maskLength + length);
      if (opcode === 8) return closeClient(client);
      if (opcode === 9) {
        client.socket?.write(Buffer.from([0x8a, 0x00]));
        continue;
      }
      if (opcode !== 1) continue;
      try {
        handleMessage(client, JSON.parse(payload.toString("utf8")));
      } catch {
        send(client, { type: "error", message: "Invalid message." });
      }
    }
  }

  function attach(server: Server, clients: Set<ServerClient>): void {
    server.on("upgrade", async (request, socket) => {
      if (new URL(request.url ?? "/", "http://localhost").pathname !== "/ws") {
        socket.destroy();
        return;
      }
      const key = request.headers["sec-websocket-key"];
      if (typeof key !== "string" || request.headers.upgrade?.toLowerCase() !== "websocket") {
        socket.destroy();
        return;
      }
      const cookieHeader = request.headers.cookie ?? "";
      const sessionToken = cookieHeader.split(";").map(cookie => cookie.trim()).find(cookie => cookie.startsWith("clone_royale_session="))?.slice("clone_royale_session=".length) ?? "";
      let account: { id: string; username: string } | null = null;
      if (sessionToken) {
        try {
          account = await resolveAccount(sessionToken);
        } catch {
          socket.destroy();
          return;
        }
      }
      if (socket.destroyed) return;
      const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
      socket.write(["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", "Sec-WebSocket-Accept: " + accept, "", ""].join("\r\n"));
      const client: WebSocketClient = {
        id: randomBytes(12).toString("hex"),
        guestId: account?.id ?? null,
        accountId: account?.id ?? null,
        resumeToken: randomBytes(32).toString("hex"),
        socket,
        buffer: Buffer.alloc(0),
        room: null,
        side: null,
        name: account?.username.slice(0, 16) ?? "Guest",
        queued: false,
        closed: false,
        disconnected: false,
        rematchReady: false
      };
      clients.add(client);
      socket.on("data", chunk => decodeFrames(client, chunk));
      socket.on("close", () => closeClient(client));
      socket.on("error", () => closeClient(client));
      send(client, { type: "connected" });
    });
  }

  return { send, attach };
}
