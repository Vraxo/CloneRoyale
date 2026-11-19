import { isBattleReplay, type BattleReplay } from "../game/replay";

export interface PublicReplaySummary {
  id: string;
  createdAt: number;
  durationSeconds: number;
  winner: "blue" | "red" | "draw" | null;
  players: { blue: string; red: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublicReplaySummary(value: unknown): value is PublicReplaySummary {
  return isRecord(value)
    && typeof value.id === "string" && /^[a-f0-9]{32}$/.test(value.id)
    && typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
    && typeof value.durationSeconds === "number" && Number.isFinite(value.durationSeconds)
    && (value.winner === null || value.winner === "blue" || value.winner === "red" || value.winner === "draw")
    && isRecord(value.players)
    && typeof value.players.blue === "string" && typeof value.players.red === "string";
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json() as unknown; }
  catch { throw new Error("The replay server returned an invalid response."); }
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const payload = await readJson(response).catch(() => null);
  return new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback);
}

export function createReplayLibraryApi(api: (path: string) => string) {
  async function listPublicReplays(): Promise<PublicReplaySummary[]> {
    const response = await fetch(api("/api/replays"), { cache: "no-store" });
    if (!response.ok) throw new Error("Replay library is unavailable.");
    const payload = await readJson(response);
    if (!isRecord(payload) || !Array.isArray(payload.replays) || !payload.replays.every(isPublicReplaySummary)) {
      throw new Error("The replay server returned an invalid library.");
    }
    return payload.replays;
  }

  async function getPublicReplay(id: string): Promise<BattleReplay> {
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("Invalid replay identifier.");
    const response = await fetch(api("/api/replays/" + encodeURIComponent(id)));
    if (!response.ok) throw new Error("Replay not found.");
    const payload = await readJson(response);
    if (!isRecord(payload) || !isBattleReplay(payload.replay) || payload.replay.id !== id
      || !Number.isFinite(payload.replay.createdAt)
      || !(payload.replay.winner === null || payload.replay.winner === "blue"
        || payload.replay.winner === "red" || payload.replay.winner === "draw")) {
      throw new Error("The replay server returned an invalid replay.");
    }
    return payload.replay;
  }

  async function publishReplay(id: string, token: string): Promise<string> {
    if (!/^[a-f0-9]{32}$/.test(id) || !token) throw new Error("Invalid replay sharing details.");
    const response = await fetch(api("/api/replays/" + encodeURIComponent(id) + "/publish"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shareToken: token })
    });
    if (!response.ok) throw await responseError(response, "Could not publish replay.");
    const payload = await readJson(response);
    if (!isRecord(payload) || typeof payload.url !== "string") throw new Error("The replay server returned an invalid sharing link.");
    const url = new URL(payload.url, window.location.origin);
    if (url.origin !== window.location.origin) throw new Error("The replay server returned an unsafe sharing link.");
    return url.toString();
  }

  return { listPublicReplays, getPublicReplay, publishReplay };
}
