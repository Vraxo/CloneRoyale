import assert from "node:assert/strict";
import test from "node:test";
import { resolveUnitCollisions } from "../../../src/game/collision.js";
import { playCard } from "../../../src/game/deployment.js";
import { createGame } from "../../../src/game/simulation.js";
import type { TroopUnit } from "../../../src/game/types/index.js";

function makeTroop(
  id: number,
  x: number,
  overrides: Partial<TroopUnit> = {}
): TroopUnit {
  return {
    id,
    side: "blue",
    cardId: "giant",
    type: "giant",
    kind: "troop",
    lane: "left",
    transform: { x, y: 500, facing: 0 },
    health: { hp: 500, maxHp: 500 },
    collision: { radius: 12 },
    combat: {
      damage: 100,
      range: 55,
      attackInterval: 1,
      attackCooldown: 0,
      attack: { type: "melee" },
      splashRadius: 0
    },
    movement: { speed: 80, isAir: false },
    targeting: { canTargetAir: true, targetsBuildingsOnly: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 },
    presentation: { animationOffset: 0, attackAnim: 0 },
    ...overrides
  };
}

test("collision separation distributes movement according to unit mass", () => {
  const game = createGame();
  const heavy = makeTroop(100, 100, { collision: { radius: 12, mass: 3 } });
  const light = makeTroop(101, 110, { collision: { radius: 12, mass: 1 } });
  game.units.push(heavy, light);

  resolveUnitCollisions(game);

  assert.equal(heavy.transform.x, 96);
  assert.equal(light.transform.x, 122);
});

test("collision separation moves an active unit around a deploying unit", () => {
  const game = createGame();
  const deploying = makeTroop(100, 100, {
    movement: { speed: 0, isAir: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 1 }
  });
  const active = makeTroop(101, 110);
  game.units.push(deploying, active);

  resolveUnitCollisions(game);

  assert.equal(deploying.transform.x, 100);
  assert.equal(active.transform.x, 126);
  assert.ok(Math.hypot(
    active.transform.x - deploying.transform.x,
    active.transform.y - deploying.transform.y
  ) >= deploying.collision.radius + active.collision.radius + 2);
});


test("moves a troop away from a stationary building when the troop is first", () => {
  const game = createGame();
  game.sides.blue.hand = ["cannon"];
  game.sides.blue.elixir = 10;
  assert.equal(playCard(game, "blue", "cannon", "left"), true);

  const building = game.units[0];
  assert.equal(building.kind, "building");
  building.transform.x = 100;
  building.transform.y = 500;
  building.deployment.appearanceDelay = 0;
  building.deployment.remaining = 0;
  const troop = makeTroop(100, 110);
  game.units.unshift(troop);

  resolveUnitCollisions(game);

  assert.equal(building.transform.x, 100);
  assert.ok(troop.transform.x > 110);
});

test("moves a troop away from a stationary building when the building is first", () => {
  const game = createGame();
  game.sides.blue.hand = ["cannon"];
  game.sides.blue.elixir = 10;
  assert.equal(playCard(game, "blue", "cannon", "left"), true);

  const building = game.units[0];
  assert.equal(building.kind, "building");
  building.transform.x = 110;
  building.transform.y = 500;
  building.deployment.appearanceDelay = 0;
  building.deployment.remaining = 0;
  const troop = makeTroop(100, 100);
  game.units.unshift(troop);

  resolveUnitCollisions(game);

  assert.equal(building.transform.x, 110);
  assert.ok(troop.transform.x < 100);
});


test("moves an active troop away from a deploying troop when the active troop is first", () => {
  const game = createGame();
  const active = makeTroop(100, 100);
  const deploying = makeTroop(101, 110, {
    movement: { speed: 0, isAir: false },
    deployment: { appearanceDelay: 0, duration: 1, remaining: 1 }
  });
  game.units.push(active, deploying);

  resolveUnitCollisions(game);

  assert.ok(active.transform.x < 100);
  assert.equal(deploying.transform.x, 110);
});
