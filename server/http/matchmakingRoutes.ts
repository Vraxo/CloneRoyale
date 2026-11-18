import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "./httpUtils.js";

interface MatchmakingRouteOptions {
  getMatchmakingStatus: () => Record<string, number>;
  pruneMatchmakingQueue: () => unknown;
}

export function createMatchmakingRoutes(options: MatchmakingRouteOptions) {
  const { getMatchmakingStatus, pruneMatchmakingQueue } = options;

  return function handleMatchmakingRoute(
    request: IncomingMessage,
    response: ServerResponse,
    pathname: string
  ): boolean {
    if (pathname !== "/matchmaking-status") {
      return false;
    }


    pruneMatchmakingQueue();
    sendJson(response, 200, getMatchmakingStatus());
    return true;
  };
}
