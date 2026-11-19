import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { sendText } from "../core/httpUtils.js";

interface StaticFileOptions {
  root: string;
}

function contentType(filePath: string): string {
  const extension = extname(filePath);
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
    ".woff2": "font/woff2",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json; charset=utf-8"
  };

  return types[extension] ?? "application/octet-stream";
}

async function sendStaticFile(
  response: ServerResponse,
  filePath: string
): Promise<void> {
  const content = await readFile(filePath);
  const isHashedAsset = filePath.includes(sep + "assets" + sep);
  const cacheControl = isHashedAsset
    ? "public, max-age=31536000, immutable"
    : "no-cache";

  response.writeHead(200, {
    "content-type": contentType(filePath),
    "cache-control": cacheControl
  });
  response.end(content);
}

export function createStaticFileHandler(options: StaticFileOptions) {
  const { root } = options;

  return async function handleStaticFile(
    request: IncomingMessage,
    response: ServerResponse,
    pathname: string
  ): Promise<void> {
    let decodedPathname: string;

    try {
      decodedPathname = decodeURIComponent(pathname);
    } catch {
      sendText(response, 400, "Bad request.");
      return;
    }

    let filePath = resolve(root, "." + decodedPathname);

    if (!filePath.startsWith(root + sep) && filePath !== root) {
      sendText(response, 403, "Forbidden");
      return;
    }

    try {
      const fileInfo = await stat(filePath);

      if (fileInfo.isDirectory()) {
        filePath = resolve(filePath, "index.html");
      }

      await sendStaticFile(response, filePath);
    } catch {
      try {
        await sendStaticFile(response, resolve(root, "index.html"));
      } catch {
        sendText(
          response,
          404,
          "Not found. Build the client with npm run build."
        );
      }
    }
  };
}
