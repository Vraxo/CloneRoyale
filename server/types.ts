import type { BattleReplay, ReplayRecorder } from "../src/game/replay";
import type { CardId, GameState, Side } from "../src/game/types";

export interface ServerClient {
  id: string;
  guestId: string | null;
  name: string;
  room: ServerRoom | null;
  side: Side | null;
  disconnected: boolean;
  lastEmoteAt?: number;
  resumeToken: string;
  queued: boolean;
  rematchReady: boolean;
}

export interface ServerRoom {
  code: string;
  players: Map<string, ServerClient>;
  state: GameState | null;
  publicMatch: boolean;
  replayRecorder?: ReplayRecorder | null;
  replaySent?: boolean;
  seed?: number;
  lastUpdate: number;
  accumulator: number;
}

export interface ClientMessage {
  type: string;
  [key: string]: unknown;
}

export interface MessageHandlerOptions {
  send: (client: ServerClient, payload: Record<string, unknown>) => void;
  broadcast: (room: ServerRoom, payload: Record<string, unknown>) => void;
  playerSummaries: (room: ServerRoom) => Array<{ side: Side | null; name: string }>;
  rooms: Map<string, ServerRoom>;
  matchmaking: {
    join: (client: ServerClient) => void;
    remove: (client: ServerClient, notify?: boolean) => boolean;
  };
  createRoom: (client: ServerClient) => void;
  leaveRoom: (client: ServerClient) => void;
  attachPlayer: (room: ServerRoom, client: ServerClient, side: Side) => void;
  requestRematch: (client: ServerClient) => void;
  resumePlayer: (client: ServerClient, token: unknown) => void;
  sendRoom: (room: ServerRoom) => void;
}

export type MessageHandler = (client: ServerClient, message: ClientMessage) => void;

export interface BattleActionMessage extends ClientMessage {
  cardId?: unknown;
  x?: unknown;
  y?: unknown;
}

export type { BattleReplay, CardId, GameState, Side };
