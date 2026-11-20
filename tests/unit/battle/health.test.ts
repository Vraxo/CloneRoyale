import assert from "node:assert/strict";
import test from "node:test";
import { damageTarget } from "../../../src/game/health.js";
import { createGame } from "../../../src/game/simulation.js";
import type { TroopUnit } from "../../../src/game/types/index.js";

function makeTroop(id: number, hp: number): TroopUnit {
  return {
    id,
    side: "blue",
    cardId: "giant",
    type: "giant",
    kind: "troop",
    lane: "left",
    transform: { x: 135, y: 700, facing: 0 },
    health: { hp, maxHp: 500 },
    collision: { radius: 12 },
    combat: {
      damage: 100,
      range: 55,
      attackInterval: 1,
      attackCooldown: 0,
      attack: { type: "melee" },
      splashRadius: 0
    },
    movement: { speed: 0, isAir: false },
    targeting: { canTargetAir: true, targetsBuildingsOnly: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 },
    audio: { death: "giant-death" },
    presentation: { animationOffset: 0, attackAnim: 0 }
  };
}

test("lethal unit damage triggers death audio and a hit effect", () => {
  const game = createGame();
  const unit = makeTroop(100, 100);
  game.units.push(unit);

  damageTarget(game, unit.id, 100);

  assert.equal(unit.health.hp, 0);
  assert.ok(game.audioEvents.includes("giant-death"));
  assert.equal(game.effects.length, 1);
  assert.equal(game.effects[0].style, "hit");
  assert.equal(unit.presentation.attackAnim, 0.09);
});

test("nonlethal unit damage does not trigger death audio", () => {
  const game = createGame();
  const unit = makeTroop(100, 500);
  game.units.push(unit);

  damageTarget(game, unit.id, 125);

  assert.equal(unit.health.hp, 375);
  assert.equal(game.audioEvents.includes("giant-death"), false);
  assert.equal(game.effects.length, 1);
  assert.equal(unit.presentation.attackAnim, 0.09);
});
