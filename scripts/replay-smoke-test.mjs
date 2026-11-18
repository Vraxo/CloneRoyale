import assert from "node:assert/strict";
import { createGame, playCard, stepGame, SIMULATION_STEP } from "../dist-server/simulation.js";
import { ReplayPlayer, ReplayRecorder, isBattleReplay } from "../dist-server/simulation.js";

const seed = 123456;
const deck = ["archers", "giant", "mini-pekka", "baby-dragon", "knight", "fireball", "cannon", "skeleton-army"];
const original = createGame(seed);
original.sides.blue.hand = deck.slice(0, 4);
original.sides.blue.drawPile = deck.slice(4);
const recorder = new ReplayRecorder(seed, deck, "replay-smoke-test");

for (let tick = 0; tick < 900; tick += 1) {
  if (tick === 30) {
    assert.equal(playCard(original, "blue", "archers", "left", 180, 700, { x: 180, y: 700 }), true);
    recorder.record(original, "blue", "archers", 180, 700);
  }
  if (tick === 300) {
    assert.equal(playCard(original, "blue", "giant", "right", 450, 700, { x: 450, y: 700 }), true);
    recorder.record(original, "blue", "giant", 450, 700);
  }
  stepGame(original, SIMULATION_STEP, "red");
  if (original.gameOver) break;
}

const replay = recorder.finish(original);
assert.equal(isBattleReplay(replay), true);
const playback = new ReplayPlayer(replay);
while (!playback.isFinished) playback.step();
assert.equal(playback.state.time, original.time);
assert.equal(playback.state.winner, original.winner);
assert.deepEqual(
  playback.state.towers.map(tower => Math.round(tower.hp * 100) / 100),
  original.towers.map(tower => Math.round(tower.hp * 100) / 100)
);
const halfway = Math.floor(replay.durationTicks / 2);
playback.seek(halfway);
assert.equal(playback.tick, halfway);
playback.seek(replay.durationTicks);
assert.equal(playback.state.winner, original.winner);

const onlineOriginal = createGame(seed + 1);
const onlineRecorder = new ReplayRecorder(seed + 1, deck, "online-replay-smoke-test", "online");
for (let tick = 0; tick < 900; tick += 1) {
  if (tick === 30) {
    assert.equal(playCard(onlineOriginal, "blue", "archers", "left", 180, 700, { x: 180, y: 700 }), true);
    onlineRecorder.record(onlineOriginal, "blue", "archers", 180, 700);
  }
  if (tick === 300) {
    assert.equal(playCard(onlineOriginal, "red", "giant", "right", 450, 250, { x: 450, y: 250 }), true);
    onlineRecorder.record(onlineOriginal, "red", "giant", 450, 250);
  }
  stepGame(onlineOriginal, SIMULATION_STEP, null, true);
  if (onlineOriginal.gameOver) break;
}
const onlineReplay = onlineRecorder.finish(onlineOriginal);
assert.equal(isBattleReplay(onlineReplay), true);
assert.equal(onlineReplay.mode, "online");
const onlinePlayback = new ReplayPlayer(onlineReplay);
while (!onlinePlayback.isFinished) onlinePlayback.step();
assert.equal(onlinePlayback.state.winner, onlineOriginal.winner);
assert.deepEqual(
  onlinePlayback.state.towers.map(tower => Math.round(tower.hp * 100) / 100),
  onlineOriginal.towers.map(tower => Math.round(tower.hp * 100) / 100)
);
assert.equal(
  onlinePlayback.state.units.length,
  onlineOriginal.units.length
);

console.log("Replay smoke test passed: solo and multiplayer reconstruction, both-side actions, seeking, and replay validation.");
