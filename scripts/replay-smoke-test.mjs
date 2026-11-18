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
console.log("Replay smoke test passed: deterministic reconstruction, action playback, seeking, and replay validation.");
