import assert from "node:assert/strict";
import test from "node:test";
import { ReplayPlayer, type BattleReplay } from "../../../src/game/replay.js";
import { STARTER_DECK } from "../../../src/game/cards.js";

test("replay steps preserve deployment sounds emitted by recorded card actions", () => {
  const replay: BattleReplay = {
    version: 1,
    id: "replay-audio-test",
    createdAt: 0,
    seed: 123,
    deck: STARTER_DECK.slice(),
    durationTicks: 2,
    winner: null,
    actions: [{
      tick: 0,
      side: "blue",
      cardId: "giant",
      x: 180,
      y: 800
    }]
  };
  const player = new ReplayPlayer(replay);

  const state = player.step();

  assert.ok(state.audioEvents.includes("giant-deploy"));
});
