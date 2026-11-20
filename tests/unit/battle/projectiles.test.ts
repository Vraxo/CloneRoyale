import assert from "node:assert/strict";
import test from "node:test";
import { addProjectile, updateProjectiles } from "../../../src/game/projectiles.js";
import { createGame } from "../../../src/game/simulation.js";
import type { TroopUnit } from "../../../src/game/types/index.js";

function makeTroop(
  id: number,
  side: "blue" | "red",
  x: number,
  y: number,
  overrides: Partial<TroopUnit> = {}
): TroopUnit {
  return {
    id,
    side,
    cardId: "giant",
    type: "giant",
    kind: "troop",
    lane: "left",
    transform: { x, y, facing: 0 },
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
    movement: { speed: 0, isAir: false },
    targeting: { canTargetAir: true, targetsBuildingsOnly: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 },
    presentation: { animationOffset: 0, attackAnim: 0 },
    ...overrides
  };
}

test("projectiles travel over their duration and deal damage only on impact", () => {
  const game = createGame();
  const target = makeTroop(100, "red", 100, 500);
  game.units.push(target);

  addProjectile(game, "blue", 0, 500, target.id, 100, 500, 125, 0, "arrow", 0.2);

  updateProjectiles(game, 0.1);

  assert.equal(game.projectiles.length, 1);
  assert.equal(game.projectiles[0].x, 50);
  assert.equal(target.health.hp, 500);

  updateProjectiles(game, 0.1);

  assert.equal(game.projectiles.length, 0);
  assert.equal(game.projectiles[0], undefined);
  assert.equal(target.health.hp, 375);
});

test("splash damage respects radius and excludes allies, defeated, and deploying units", () => {
  const game = createGame();
  const edgeTarget = makeTroop(100, "red", 132, 500);
  const outsideTarget = makeTroop(101, "red", 133, 500);
  const ally = makeTroop(102, "blue", 100, 500);
  const defeated = makeTroop(103, "red", 100, 500, {
    health: { hp: 0, maxHp: 500 }
  });
  const appearing = makeTroop(104, "red", 100, 500, {
    deployment: { appearanceDelay: 0.1, duration: 0, remaining: 0 }
  });
  game.units.push(edgeTarget, outsideTarget, ally, defeated, appearing);

  addProjectile(game, "blue", 100, 500, null, 100, 500, 100, 20, "fireball", 0.12);
  updateProjectiles(game, 0.12);

  assert.equal(edgeTarget.health.hp, 400);
  assert.equal(outsideTarget.health.hp, 500);
  assert.equal(ally.health.hp, 500);
  assert.equal(defeated.health.hp, 0);
  assert.equal(appearing.health.hp, 500);
});

test("projectile duration has a minimum of 0.12 seconds", () => {
  const game = createGame();

  addProjectile(game, "blue", 0, 0, null, 100, 0, 100, 0, "arrow", 0.01);

  assert.equal(game.projectiles[0].duration, 0.12);
});

test("non-spell splash projectiles deal full damage to enemy towers", () => {
  const game = createGame();
  const tower = game.towers.find((candidate) =>
    candidate.side === "red" && candidate.kind === "princess" && candidate.lane === "left"
  );
  assert.ok(tower);
  const originalHp = tower.hp;

  addProjectile(
    game,
    "blue",
    tower.x,
    tower.y - 100,
    null,
    tower.x,
    tower.y,
    100,
    1,
    "fire",
    0.12
  );
  updateProjectiles(game, 0.12);

  assert.equal(tower.hp, originalHp - 100);
});


test("direct projectiles emit tower-hit audio when a tower survives the impact", () => {
  const game = createGame();
  const tower = game.towers.find((candidate) =>
    candidate.side === "red" && candidate.kind === "princess" && candidate.lane === "left"
  );
  assert.ok(tower);
  const originalHp = tower.hp;

  addProjectile(game, "blue", 100, tower.y, tower.id, tower.x, tower.y, 100, 0, "arrow", 0.12);
  updateProjectiles(game, 0.12);

  assert.equal(tower.hp, originalHp - 100);
  assert.ok(game.audioEvents.includes("tower-hit"));
  assert.equal(game.audioEvents.includes("projectile-impact"), false);
});
