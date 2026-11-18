import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

async function readRequestBody(request, maximumBytes = 4096) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function contentType(path) {
  const ext = extname(path);
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".ogg": "audio/ogg", ".opus": "audio/opus", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json; charset=utf-8" })[ext] ?? "application/octet-stream";
}

export function createHttpHandler(options) {
  const { root, replayArchive, getMatchmakingStatus, pruneMatchmakingQueue } = options;

  return async function handleHttpRequest(request, response) {
    if (request.url === "/healthz") {
      response.writeHead(200, { "content-type": "text/plain" }).end("ok");
      return;
    }

    const requestUrl = new URL(request.url ?? "/", "http://localhost");
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
