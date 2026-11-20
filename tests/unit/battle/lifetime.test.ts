import assert from "node:assert/strict";
import test from "node:test";
import { updateUnitLifetime } from "../../../src/game/lifetime.js";

test("units without a lifetime remain unaffected", () => {
  const unit = { health: { hp: 100, maxHp: 100 } };

  assert.equal(updateUnitLifetime(unit, 5), false);
  assert.equal(unit.health.hp, 100);
});

test("lifetime advances without expiring before its duration", () => {
  const unit = {
    health: { hp: 100, maxHp: 100 },
    lifetime: { elapsed: 2, duration: 10 }
  };

  assert.equal(updateUnitLifetime(unit, 3), false);
  assert.equal(unit.lifetime.elapsed, 5);
  assert.equal(unit.health.hp, 100);
});

test("unit expires exactly when its lifetime reaches the duration", () => {
  const unit = {
    health: { hp: 100, maxHp: 100 },
    lifetime: { elapsed: 9, duration: 10 }
  };

  assert.equal(updateUnitLifetime(unit, 1), true);
  assert.equal(unit.lifetime.elapsed, 10);
  assert.equal(unit.health.hp, 0);
});
