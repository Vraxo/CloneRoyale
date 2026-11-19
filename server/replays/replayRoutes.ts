import type { IncomingMessage, ServerResponse } from "node:http";
import type { createReplayArchive } from "../replayArchive.js";
import { readJsonBody, sendJson, sendText } from "../core/httpUtils.js";

type ReplayArchive = ReturnType<typeof createReplayArchive>;

interface ReplayRouteOptions {
  replayArchive: ReplayArchive;
}

export function createReplayRoutes(options: ReplayRouteOptions) {
  const { replayArchive } = options;

  return async function handleReplayRoute(
    request: IncomingMessage,
    response: ServerResponse,
    pathname: string
  ): Promise<boolean> {
    if (pathname === "/api/replays" && request.method === "GET") {
      const replays = await replayArchive.listPublicReplays();
      sendJson(response, 200, { replays });
      return true;
    }

    const match = pathname.match(
      /^\/api\/replays\/([a-f0-9]{32})(?:\/(publish|unpublish))?$/
    );

    if (!match) {
      return false;
    }

    const [, replayId, action] = match;

    if (action === "unpublish") {
      sendJson(response, 404, { error: "Not found." });
      return true;
    }

    const record = await replayArchive.readReplayRecord(replayId);

    if (!record) {
      sendJson(response, 404, { error: "Replay not found." });
      return true;
    }

    if (request.method === "GET" && !action) {
      sendJson(response, 200, {
        replay: record.replay,
        visibility: record.visibility,
        summary: replayArchive.replaySummary(record)
      });
      return true;
    }

    if (request.method === "POST" && action === "publish") {
      let body: Record<string, unknown>;

      try {
        body = await readJsonBody(request);
      } catch {
        sendJson(response, 400, { error: "Invalid request." });
        return true;
      }

      const shareToken = typeof body.shareToken === "string"
        ? body.shareToken
        : "";

      if (!replayArchive.verifyShareToken(record, shareToken)) {
        sendJson(response, 403, {
          error: "You don't have permission to publish this replay."
        });
        return true;
      }

      const summary = await replayArchive.publishReplay(record, replayId);
      sendJson(response, 200, {
        published: true,
        url: "/?replay=" + replayId,
        summary
      });
      return true;
    }

    sendText(
      response,
      405,
      "Method not allowed.",
      { allow: action ? "POST" : "GET" }
    );
    return true;
  };
}
