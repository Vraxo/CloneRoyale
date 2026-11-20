import assert from "node:assert/strict";
import test from "node:test";
import { updateEffects } from "../../../src/game/effects.js";
import { createGame } from "../../../src/game/simulation.js";

test("arrow effects emit all three volley impact events when time crosses them", () => {
  const game = createGame();
  game.effects.push({
    id: 100,
    x: 135,
    y: 480,
    age: 0,
    lifetime: 0.94,
    radius: 55,
    side: "blue",
    style: "arrows"
  });

  updateEffects(game, 0.4);

  assert.equal(game.audioEvents.filter((event) => event === "arrows-impact").length, 3);
});

test("effects are removed when their lifetime expires", () => {
  const game = createGame();
  game.effects.push(
    {
      id: 100,
      x: 135,
      y: 480,
      age: 0.19,
      lifetime: 0.2,
      radius: 9,
      style: "hit"
    },
    {
      id: 101,
      x: 150,
      y: 480,
      age: 0.1,
      lifetime: 0.2,
      radius: 9,
      style: "hit"
    }
  );

  updateEffects(game, 0.01);

  assert.deepEqual(game.effects.map((effect) => effect.id), [101]);
});
