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


test("destroying a princess tower awards a crown and activates its king tower", () => {
  const game = createGame();
  const princess = game.towers.find((tower) =>
    tower.side === "red" && tower.kind === "princess" && tower.lane === "left"
  );
  const king = game.towers.find((tower) => tower.side === "red" && tower.kind === "king");
  assert.ok(princess);
  assert.ok(king);
  princess.hp = 50;

  damageTarget(game, princess.id, 50);

  assert.equal(princess.hp, 0);
  assert.equal(king.activated, true);
  assert.ok(game.events.some((event) => event.includes("Red princess tower destroyed")));
  assert.ok(game.audioEvents.includes("tower-destroyed"));
  assert.ok(game.audioEvents.includes("crown-earned"));
  assert.ok(game.audioEvents.includes("king-activation"));
});


test("lethal damage to a unit without death audio emits no sound", () => {
  const game = createGame();
  const unit = makeTroop(101, 50);
  delete unit.audio;
  game.units.push(unit);

  damageTarget(game, unit.id, 50);

  assert.equal(unit.health.hp, 0);
  assert.deepEqual(game.audioEvents, []);
  assert.equal(game.effects.length, 1);
});

test("ignores missing targets and towers that are already destroyed", () => {
  const game = createGame();
  const destroyedTower = game.towers.find((tower) =>
    tower.side === "red" && tower.kind === "princess" && tower.lane === "left"
  );
  assert.ok(destroyedTower);
  destroyedTower.hp = 0;
  const before = structuredClone(game);

  damageTarget(game, -1, 100);
  damageTarget(game, destroyedTower.id, 100);

  assert.deepEqual(game, before);
});


test("damaging an already activated king tower does not repeat activation audio", () => {
  const game = createGame();
  const king = game.towers.find((tower) => tower.side === "red" && tower.kind === "king");
  assert.ok(king);
  king.activated = true;

  damageTarget(game, king.id, 100);

  assert.equal(king.hp, king.maxHp - 100);
  assert.equal(game.audioEvents.includes("king-activation"), false);
});
