import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createGame, ReplayRecorder } from "../dist-server/simulation.js";

const port = 31817;
const baseUrl = "http://127.0.0.1:" + port;
const directory = await mkdtemp(join(tmpdir(), "cloneroyale-replay-archive-"));
const replayId = randomBytes(16).toString("hex");
const shareToken = randomBytes(32).toString("hex");
const deck = ["archers", "giant", "mini-pekka", "baby-dragon", "knight", "fireball", "cannon", "skeleton-army"];
const replay = new ReplayRecorder(98765, deck, replayId, "online").finish(createGame(98765));
replay.players = { blue: "ArchiveBlue", red: "ArchiveRed" };
await mkdir(directory, { recursive: true });
await writeFile(join(directory, replayId + ".json"), JSON.stringify({
  replay, visibility: "public", shareTokenHash: createHash("sha256").update(shareToken).digest("hex")
}));
const server = spawn(process.execPath, ["server/index.mjs"], {
  env: { ...process.env, PORT: String(port), CLONEROYALE_REPLAY_DIR: directory },
  stdio: "ignore"
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error("Replay archive server exited during startup.");
    try { if ((await fetch(baseUrl + "/healthz")).ok) { ready = true; break; } } catch { /* Wait for server startup. */ }
    await delay(100);
  }
  assert.equal(ready, true, "Replay archive server should start.");
  const initialList = await fetch(baseUrl + "/api/replays");
  const initialEntries = (await initialList.json()).replays;
  assert.equal(initialEntries.length, 1, "Completed PvP replays should appear in the public library by default.");
  assert.equal(initialEntries[0].id, replayId);
  const publicReplay = await fetch(baseUrl + "/api/replays/" + replayId);
  assert.equal(publicReplay.status, 200);
  assert.equal((await publicReplay.json()).visibility, "public");
  const rejected = await fetch(baseUrl + "/api/replays/" + replayId + "/unpublish", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shareToken: "wrong-token" })
  });
  assert.equal(rejected.status, 403, "Hiding a replay must require the participant share token.");
  const hidden = await fetch(baseUrl + "/api/replays/" + replayId + "/unpublish", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shareToken })
  });
  assert.equal(hidden.status, 200);
  assert.equal((await hidden.json()).visibility, "unlisted");
  const hiddenList = await fetch(baseUrl + "/api/replays");
  assert.deepEqual((await hiddenList.json()).replays, [], "Hidden replays must disappear from the public library.");
  const directLink = await fetch(baseUrl + "/api/replays/" + replayId);
  assert.equal(directLink.status, 200, "Hiding removes a replay from discovery but preserves its direct link.");
  assert.equal((await directLink.json()).visibility, "unlisted");
  const republished = await fetch(baseUrl + "/api/replays/" + replayId + "/publish", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shareToken })
  });
  assert.equal(republished.status, 200);
  assert.equal((await republished.json()).visibility, "public");
  const finalList = await fetch(baseUrl + "/api/replays");
  const entries = (await finalList.json()).replays;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, replayId);
  assert.deepEqual(entries[0].players, { blue: "ArchiveBlue", red: "ArchiveRed" });
  console.log("Replay archive smoke test passed: public-by-default listing, participant-only hiding and publishing, and direct replay links.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise(resolve => server.once("exit", resolve)), delay(1000)]);
  await rm(directory, { recursive: true, force: true });
}
