import type { GameState, Side } from "../game/types";
import { isBattleReplay, type BattleReplay } from "../game/replay";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export type OnlineMessage =
  | { type: "connection-status"; state: ConnectionState }
  | { type: "connected" }
  | { type: "assigned"; side: Side; code: string | null; publicMatch?: boolean; resumeToken?: string; name?: string }
  | { type: "players-updated"; players: { side: Side; name: string }[] }
  | { type: "resumed"; side: Side; code: string | null; publicMatch?: boolean; state: GameState | null; resumeToken: string; name?: string; players?: { side: Side; name: string }[] }
  | { type: "resume-failed" }
  | { type: "connection-lost" }
  | { type: "opponent-disconnected"; graceSeconds: number }
  | { type: "opponent-reconnected"; side: Side }
  | { type: "queue-status"; waiting: number; position?: number }
  | { type: "queue-cancelled" }
  | { type: "room"; code: string; players: { side: Side; name: string }[]; status: "waiting" | "playing" }
  | { type: "match-start"; state: GameState; players?: { side: Side; name: string }[] }
  | { type: "rematch-status"; ready: number; total: number }
  | { type: "rematch-start"; state: GameState; players?: { side: Side; name: string }[] }
  | { type: "state"; state: GameState }
  | { type: "match-replay"; replay: BattleReplay; shareToken?: string }
  | { type: "emote"; side: Side; emoteId: number; name: string }
  | { type: "global-chat-history"; messages: { id: string; name: string; text: string; timestamp: number }[] }
  | { type: "global-chat-message"; message: { id: string; name: string; text: string; timestamp: number } }
  | { type: "opponent-left" }
  | { type: "action-error"; message: string }
  | { type: "error"; message: string };

const connectionStates = new Set<ConnectionState>([
  "connecting",
  "connected",
  "reconnecting",
  "disconnected"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSide(value: unknown): value is Side {
  return value === "blue" || value === "red";
}

function isPlayers(value: unknown): value is { side: Side; name: string }[] {
  return Array.isArray(value) && value.every(player =>
    isRecord(player) && isSide(player.side) && typeof player.name === "string"
  );
}

function isChatMessage(value: unknown): value is { id: string; name: string; text: string; timestamp: number } {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.text === "string"
    && typeof value.timestamp === "number"
    && Number.isFinite(value.timestamp);
}

function isGameState(value: unknown): value is GameState {
  return isRecord(value)
    && isRecord(value.sides)
    && isRecord(value.sides.blue)
    && isRecord(value.sides.red)
    && Array.isArray(value.units)
    && typeof value.time === "number"
    && typeof value.gameOver === "boolean";
}

function isReplay(value: unknown): value is BattleReplay {
  return isBattleReplay(value);
}

export function isOnlineMessage(value: unknown): value is OnlineMessage {
  if (!isRecord(value) || typeof value.type !== "string") return false;

  switch (value.type) {
    case "connection-status":
      return connectionStates.has(value.state as ConnectionState);
    case "connected":
    case "resume-failed":
    case "connection-lost":
    case "queue-cancelled":
    case "opponent-left":
      return true;
    case "assigned":
      return isSide(value.side)
        && (typeof value.code === "string" || value.code === null)
        && (value.publicMatch === undefined || typeof value.publicMatch === "boolean")
        && (value.resumeToken === undefined || typeof value.resumeToken === "string")
        && (value.name === undefined || typeof value.name === "string");
    case "players-updated":
      return isPlayers(value.players);
    case "resumed":
      return isSide(value.side)
        && (typeof value.code === "string" || value.code === null)
        && (value.state === null || isGameState(value.state))
        && typeof value.resumeToken === "string"
        && (value.publicMatch === undefined || typeof value.publicMatch === "boolean")
        && (value.name === undefined || typeof value.name === "string")
        && (value.players === undefined || isPlayers(value.players));
    case "opponent-disconnected":
      return typeof value.graceSeconds === "number" && Number.isFinite(value.graceSeconds);
    case "opponent-reconnected":
      return isSide(value.side);
    case "queue-status":
      return Number.isInteger(value.waiting)
        && (value.position === undefined || Number.isInteger(value.position));
    case "room":
      return typeof value.code === "string"
        && isPlayers(value.players)
        && (value.status === "waiting" || value.status === "playing");
    case "match-start":
    case "rematch-start":
      return isGameState(value.state)
        && (value.players === undefined || isPlayers(value.players));
    case "rematch-status":
      return Number.isInteger(value.ready) && Number.isInteger(value.total);
    case "state":
      return isGameState(value.state);
    case "match-replay":
      return isReplay(value.replay)
        && (value.shareToken === undefined || typeof value.shareToken === "string");
    case "global-chat-history":
      return Array.isArray(value.messages) && value.messages.length <= 50 && value.messages.every(isChatMessage);
    case "global-chat-message":
      return isChatMessage(value.message);
    case "emote":
      return isSide(value.side)
        && Number.isInteger(value.emoteId)
        && typeof value.name === "string";
    case "action-error":
    case "error":
      return typeof value.message === "string";
    default:
      return false;
  }
}

export function parseOnlineMessage(data: unknown): OnlineMessage | null {
  try {
    const value: unknown = JSON.parse(String(data));
    return isOnlineMessage(value) ? value : null;
  } catch {
    return null;
  }
}
