import { isBattleReplay, type BattleReplay } from "./replay";

const REPLAY_STORAGE_KEY = "cloneroyale.replays";
const SHARE_TOKEN_STORAGE_KEY = "cloneroyale.replay-share-tokens";
const MAX_SAVED_REPLAYS = 20;

export function saveBattleReplay(replay: BattleReplay): void {
  try {
    const stored = JSON.parse(localStorage.getItem(REPLAY_STORAGE_KEY) ?? "[]") as unknown;
    const replays = Array.isArray(stored) ? stored.filter(isBattleReplay) : [];
    replays.unshift(replay);
    localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(replays.slice(0, MAX_SAVED_REPLAYS)));
  } catch {
    // The in-memory replay remains available when storage is unavailable.
  }
}

export function saveReplayShareToken(replayId: string, token: string): void {
  try {
    const stored = JSON.parse(localStorage.getItem(SHARE_TOKEN_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    stored[replayId] = token;
    localStorage.setItem(SHARE_TOKEN_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Sharing remains available for the current session.
  }
}
