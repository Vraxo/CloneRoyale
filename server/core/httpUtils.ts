import type { IncomingMessage, ServerResponse } from "node:http";

export async function readJsonBody(
  request: IncomingMessage,
  maximumBytes = 4096
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > maximumBytes) {
      throw new Error("Request body is too large.");
    }

    chunks.push(buffer);
  }

  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

export function sendJson(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  response.end(JSON.stringify(body));
}

export function sendText(
  response: ServerResponse,
  status: number,
  body: string,
  headers: Record<string, string> = {}
): void {
  response.writeHead(status, headers);
  response.end(body);
}
