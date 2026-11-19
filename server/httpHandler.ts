import { createAuthRoutes } from "./account/authRoutes.js";
import { createMatchmakingRoutes } from "./multiplayer/matchmakingRoutes.js";
import { createReplayRoutes } from "./replays/replayRoutes.js";
import { createStaticFileHandler } from "./app/staticFiles.js";
import type { createReplayArchive } from "./replays/replayArchive.js";
import type { createAccountStore } from "./account/accounts.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { sendText } from "./core/httpUtils.js";

type ReplayArchive = ReturnType<typeof createReplayArchive>;
type AccountStore = ReturnType<typeof createAccountStore>;

interface HttpHandlerOptions {
  root: string;
  replayArchive: ReplayArchive;
  accountStore: AccountStore;
  getMatchmakingStatus: () => Record<string, number>;
  pruneMatchmakingQueue: () => unknown;
}

export function createHttpHandler(options: HttpHandlerOptions) {
  const authRoutes = createAuthRoutes({
    accountStore: options.accountStore
  });

  const replayRoutes = createReplayRoutes({
    replayArchive: options.replayArchive
  });

  const matchmakingRoutes = createMatchmakingRoutes({
    getMatchmakingStatus: options.getMatchmakingStatus,
    pruneMatchmakingQueue: options.pruneMatchmakingQueue
  });

  const serveStaticFile = createStaticFileHandler({
    root: options.root
  });

  return async function handleHttpRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    if (request.url === "/healthz") {
      sendText(response, 200, "ok", {
        "content-type": "text/plain"
      });
      return;
    }

    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const { pathname } = requestUrl;

    if (await authRoutes(request, response, pathname)) {
      return;
    }

    if (await replayRoutes(request, response, pathname)) {
      return;
    }

    if (matchmakingRoutes(request, response, pathname)) {
      return;
    }

    await serveStaticFile(request, response, pathname);
  };
}
