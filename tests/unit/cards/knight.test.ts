import assert from "node:assert/strict";
import test from "node:test";
import { KNIGHT } from "../../../src/cards/Knight/Knight.js";

test("Knight defines deployment, attack, hit, death, and movement audio", () => {
  assert.deepEqual(KNIGHT.audio, {
    attack: "knight-attack",
    hit: "knight-hit",
    deploy: "knight-deploy",
    death: "knight-death",
    movement: { event: "knight-step", interval: 0.56 }
  });
});
