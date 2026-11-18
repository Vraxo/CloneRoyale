import { isBattleReplay, type BattleReplay } from "./replay";

const REPLAY_STORAGE_KEY = "cloneroyale.replays";
const SHARE_TOKEN_STORAGE_KEY = "cloneroyale.replay-share-tokens";
const MAX_SAVED_REPLAYS = 20;

export function readSavedBattleReplays(): BattleReplay[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(REPLAY_STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter(isBattleReplay) : [];
  } catch { return []; }
}

export function readReplayShareTokens(): Record<string, string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SHARE_TOKEN_STORAGE_KEY) ?? "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    return Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch { return {}; }
}

export function readReplayShareToken(replayId: string): string | null {
  return readReplayShareTokens()[replayId] ?? null;
}

export function saveBattleReplay(replay: BattleReplay): void {
  if (!isBattleReplay(replay)) return;
  try {
    const replays = readSavedBattleReplays().filter(saved => saved.id !== replay.id);
    replays.unshift(replay);
    localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(replays.slice(0, MAX_SAVED_REPLAYS)));
  } catch { /* Storage may be unavailable. */ }
}

export function saveReplayShareToken(replayId: string, token: string): void {
  if (!replayId || !token) return;
  try {
    const tokens = readReplayShareTokens();
    tokens[replayId] = token;
    localStorage.setItem(SHARE_TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } catch { /* Sharing remains available for the current session. */ }
}
