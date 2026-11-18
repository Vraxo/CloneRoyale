import { readFile, mkdir, readdir, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { isBattleReplay } from "../dist-server/simulation.js";

const MAX_PUBLIC_REPLAYS = 100;

export function createReplayArchive(directory) {
  const replayFile = id => {
    if (typeof id !== "string" || !/^[a-f0-9]{32}$/.test(id)) return null;
    return resolve(directory, id + ".json");
  };

  async function readReplayRecord(id) {
    const path = replayFile(id);
    if (!path) return null;
    try {
      const record = JSON.parse(await readFile(path, "utf8"));
      if (!record || !isBattleReplay(record.replay) || record.replay.id !== id) return null;
      return record;
    } catch { return null; }
  }

  function replaySummary(record) {
    const replay = record.replay;
    return {
      id: replay.id,
      createdAt: replay.createdAt,
      durationSeconds: Math.round(replay.durationTicks / 30),
      winner: replay.winner,
      players: replay.players ?? { blue: "Blue", red: "Red" }
    };
  }

  async function saveReplay(replay, shareToken) {
    if (!isBattleReplay(replay) || replay.mode !== "online" || replay.actions.length > 10000) {
      throw new Error("Replay failed validation.");
    }
    await mkdir(directory, { recursive: true });
    const path = replayFile(replay.id);
    if (!path) throw new Error("Invalid replay identifier.");
    const record = {
      replay,
      visibility: "public",
      shareTokenHash: createHash("sha256").update(shareToken).digest("hex")
    };
    const temporary = path + "." + randomBytes(6).toString("hex") + ".tmp";
    await writeFile(temporary, JSON.stringify(record), { flag: "wx" });
    await rename(temporary, path);
  }

  async function listPublicReplays() {
    let names;
    try { names = await readdir(directory); } catch { return []; }
    const records = await Promise.all(names.filter(name => /^[a-f0-9]{32}\.json$/.test(name)).map(async name => {
      const record = await readReplayRecord(name.slice(0, -5));
      return record?.visibility === "public" ? replaySummary(record) : null;
    }));
    return records.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_PUBLIC_REPLAYS);
  }

  function verifyShareToken(record, supplied) {
    const expectedHash = Buffer.from(record.shareTokenHash ?? "", "hex");
    const suppliedHash = createHash("sha256").update(supplied).digest();
    return expectedHash.length === suppliedHash.length && timingSafeEqual(expectedHash, suppliedHash);
  }

  async function publishReplay(record, id) {
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
