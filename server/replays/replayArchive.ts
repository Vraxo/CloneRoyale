import { readFile, mkdir, readdir, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { isBattleReplay } from "../simulation.js";
import type { BattleReplay } from "../src/game/replay.js";

const MAX_PUBLIC_REPLAYS = 100;

interface ReplayRecord {
  replay: BattleReplay;
  visibility: "public" | "private";
  shareTokenHash?: string;
}

export function createReplayArchive(directory: string) {
  const replayFile = (id: string): string | null => {
    if (!/^[a-f0-9]{32}$/.test(id)) return null;
    return resolve(directory, id + ".json");
  };

  async function readReplayRecord(id: string): Promise<ReplayRecord | null> {
    const path = replayFile(id);
    if (!path) return null;
    try {
      const record = JSON.parse(await readFile(path, "utf8")) as ReplayRecord;
      if (!record || !isBattleReplay(record.replay) || record.replay.id !== id) return null;
      return record;
    } catch {
      return null;
    }
  }

  function replaySummary(record: ReplayRecord) {
    const replay = record.replay;
    return {
      id: replay.id,
      createdAt: replay.createdAt,
      durationSeconds: Math.round(replay.durationTicks / 30),
      winner: replay.winner,
      players: replay.players ?? { blue: "Blue", red: "Red" }
    };
  }

  async function saveReplay(replay: BattleReplay, shareToken: string): Promise<void> {
    if (!isBattleReplay(replay) || replay.mode !== "online" || replay.actions.length > 10000) {
      throw new Error("Replay failed validation.");
    }
    await mkdir(directory, { recursive: true });
    const path = replayFile(replay.id);
    if (!path) throw new Error("Invalid replay identifier.");
    const record: ReplayRecord = {
      replay,
      visibility: "public",
      shareTokenHash: createHash("sha256").update(shareToken).digest("hex")
    };
    const temporary = path + "." + randomBytes(6).toString("hex") + ".tmp";
    await writeFile(temporary, JSON.stringify(record), { flag: "wx" });
    await rename(temporary, path);
  }

  async function listPublicReplays() {
    let names: string[];
    try {
      names = await readdir(directory);
    } catch {
      return [];
    }
    const records = await Promise.all(names
      .filter(name => /^[a-f0-9]{32}\.json$/.test(name))
      .map(async name => {
        const record = await readReplayRecord(name.slice(0, -5));
        return record?.visibility === "public" ? replaySummary(record) : null;
      }));
    return records.filter((record): record is NonNullable<typeof record> => record !== null)
      .sort((first, second) => second.createdAt - first.createdAt)
      .slice(0, MAX_PUBLIC_REPLAYS);
  }

  function verifyShareToken(record: ReplayRecord, supplied: string): boolean {
    const expectedHash = Buffer.from(record.shareTokenHash ?? "", "hex");
    const suppliedHash = createHash("sha256").update(supplied).digest();
    return expectedHash.length === suppliedHash.length && timingSafeEqual(expectedHash, suppliedHash);
  }

  async function publishReplay(record: ReplayRecord, id: string) {
    record.visibility = "public";
    const path = replayFile(id);
    if (!path) throw new Error("Invalid replay identifier.");
    const temporary = path + "." + randomBytes(6).toString("hex") + ".tmp";
    await writeFile(temporary, JSON.stringify(record), { flag: "wx" });
    await rename(temporary, path);
    return replaySummary(record);
  }

  return { readReplayRecord, replaySummary, saveReplay, listPublicReplays, verifyShareToken, publishReplay };
}
