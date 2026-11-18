import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { createReplayArchive } from "./replayArchive.js";
import type { createAccountStore } from "./accounts.js";

type ReplayArchive = ReturnType<typeof createReplayArchive>;
type AccountStore = ReturnType<typeof createAccountStore>;

interface HttpHandlerOptions {
  root: string;
  replayArchive: ReplayArchive;
  accountStore: AccountStore;
  getMatchmakingStatus: () => Record<string, number>;
  pruneMatchmakingQueue: () => unknown;
}

const SESSION_COOKIE = "clone_royale_session";
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_ATTEMPT_LIMIT = 10;

async function readRequestBody(request: IncomingMessage, maximumBytes = 4096): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maximumBytes) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function contentType(path: string): string {
  const ext = extname(path);
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".ogg": "audio/ogg", ".opus": "audio/opus", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json; charset=utf-8" } as Record<string, string>)[ext] ?? "application/octet-stream";
}

function readSessionCookie(request: IncomingMessage): string {
  const cookies = request.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    return cookie.slice(separator + 1).trim();
  }
  return "";
}

function sessionCookie(token: string, maxAge: number): string {
  return SESSION_COOKIE + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAge;
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>, headers: Record<string, string> = {}): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  response.end(JSON.stringify(body));
}

export function createHttpHandler(options: HttpHandlerOptions) {
  const { root, replayArchive, accountStore, getMatchmakingStatus, pruneMatchmakingQueue } = options;
  const authAttempts = new Map<string, { count: number; resetAt: number }>();

  function allowAuthAttempt(request: IncomingMessage, response: ServerResponse): boolean {
    const now = Date.now();
    const address = request.socket.remoteAddress ?? "unknown";
    let attempt = authAttempts.get(address);
    if (!attempt || attempt.resetAt <= now) {
      attempt = { count: 0, resetAt: now + AUTH_WINDOW_MS };
      authAttempts.set(address, attempt);
    }
    if (attempt.count >= AUTH_ATTEMPT_LIMIT) {
      sendJson(response, 429, { error: "Too many authentication attempts. Please try again later." }, {
        "retry-after": String(Math.max(1, Math.ceil((attempt.resetAt - now) / 1000)))
      });
      return false;
    }
    attempt.count += 1;
    if (authAttempts.size > 5000) {
      for (const [key, value] of authAttempts) if (value.resetAt <= now) authAttempts.delete(key);
    }
    return true;
  }

  async function handleAuth(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
    if (!pathname.startsWith("/api/auth/")) return false;

    if (pathname === "/api/auth/me" && request.method === "GET") {
      const account = await accountStore.resolveSession(readSessionCookie(request));
      sendJson(response, 200, { account });
      return true;
    }

    if (pathname === "/api/auth/logout" && request.method === "POST") {
      const token = readSessionCookie(request);
      if (token) await accountStore.revokeSession(token);
      sendJson(response, 200, { loggedOut: true }, { "set-cookie": sessionCookie("", 0) });
      return true;
    }

    if ((pathname !== "/api/auth/register" && pathname !== "/api/auth/login") || request.method !== "POST") {
      sendJson(response, 404, { error: "Not found." });
      return true;
    }

    if (!allowAuthAttempt(request, response)) return true;

    let body: any;
    try {
      body = await readRequestBody(request, 2048);
    } catch {
      sendJson(response, 400, { error: "Invalid JSON request." });
      return true;
    }

    const username = typeof body?.username === "string" ? body.username : "";
    const password = typeof body?.password === "string" ? body.password : "";
    try {
      const account = pathname.endsWith("/register")
        ? await accountStore.createAccount(username, password)
        : await accountStore.authenticate(username, password);

      if (!account) {
        sendJson(response, 401, { error: "Incorrect username or password." });
        return true;
      }

      const session = await accountStore.createSession(account.id);
      const maxAge = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
      sendJson(response, pathname.endsWith("/register") ? 201 : 200, { account }, {
        "set-cookie": sessionCookie(session.token, maxAge)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create account.";
      const duplicate = message.includes("already taken");
      sendJson(response, duplicate ? 409 : 400, { error: message });
    }
    return true;
  }

  return async function handleHttpRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.url === "/healthz") {
      response.writeHead(200, { "content-type": "text/plain" }).end("ok");
      return;
    }

    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    if (await handleAuth(request, response, requestUrl.pathname)) return;

    if (requestUrl.pathname === "/api/replays" && request.method === "GET") {
      const replays = await replayArchive.listPublicReplays();
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(JSON.stringify({ replays }));
      return;
    }

    const replayMatch = requestUrl.pathname.match(/^\/api\/replays\/([a-f0-9]{32})(?:\/(publish|unpublish))?$/);
    if (replayMatch) {
      const [, id, action] = replayMatch;
      if (action === "unpublish") {
        response.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "Not found." }));
        return;
      }
      const record = await replayArchive.readReplayRecord(id);
      if (!record) {
        response.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "Replay not found." }));
        return;
      }
      if (request.method === "GET" && !action) {
        response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" })
          .end(JSON.stringify({ replay: record.replay, visibility: record.visibility, summary: replayArchive.replaySummary(record) }));
        return;
      }
      if (request.method === "POST" && action === "publish") {
        let body;
        try { body = await readRequestBody(request); } catch {
          response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "Invalid request." }));
          return;
        }
        const supplied = typeof body?.shareToken === "string" ? body.shareToken : "";
        if (!replayArchive.verifyShareToken(record, supplied)) {
          response.writeHead(403, { "content-type": "application/json" }).end(JSON.stringify({ error: "You don't have permission to publish this replay." }));
          return;
        }
        const summary = await replayArchive.publishReplay(record, id);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" })
          .end(JSON.stringify({ published: true, url: "/?replay=" + id, summary }));
        return;
      }
      response.writeHead(405, { allow: action ? "POST" : "GET" }).end("Method not allowed.");
      return;
    }

    if (requestUrl.pathname === "/matchmaking-status") {
      pruneMatchmakingQueue();
      const status = getMatchmakingStatus();
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(JSON.stringify(status));
      return;
    }

    const pathname = decodeURIComponent(requestUrl.pathname);
    let filePath = resolve(root, "." + pathname);
    if (!filePath.startsWith(root + sep) && filePath !== root) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = resolve(filePath, "index.html");
      const content = await readFile(filePath);
      const isHashedAsset = filePath.includes(sep + "assets" + sep);
      const cacheControl = isHashedAsset ? "public, max-age=31536000, immutable" : "no-cache";
      response.writeHead(200, { "content-type": contentType(filePath), "cache-control": cacheControl }).end(content);
    } catch {
      try {
        const content = await readFile(resolve(root, "index.html"));
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(content);
      } catch {
        response.writeHead(404).end("Not found. Build the client with npm run build.");
      }
    }
  };
}
