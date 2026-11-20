import assert from "node:assert/strict";
import test from "node:test";
import { updateUnits } from "../../../src/game/combat.js";
import { updateTowers } from "../../../src/game/towerCombat.js";
import { damageTarget } from "../../../src/game/effects.js";
import { addProjectile, updateProjectiles } from "../../../src/game/projectiles.js";
import { createGame } from "../../../src/game/simulation.js";
import type { BuildingUnit, GameState, TroopUnit, Unit } from "../../../src/game/types/index.js";

function makeUnit(
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
    combat: { damage: 100, range: 55, attackInterval: 1, attackCooldown: 0, attack: { type: "melee" }, splashRadius: 0 },
    movement: { speed: 0, isAir: false },
    targeting: { canTargetAir: true, targetsBuildingsOnly: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 10 },
    presentation: { animationOffset: 0, attackAnim: 0 },
    ...overrides
  };
}

function makeBuilding(
  id: number,
  side: "blue" | "red",
  x: number,
  y: number,
  overrides: Partial<BuildingUnit> = {}
): BuildingUnit {
  return {
    id,
    side,
    cardId: "cannon",
    type: "cannon",
    kind: "building",
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
    targeting: { canTargetAir: true, targetsBuildingsOnly: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 },
    presentation: { animationOffset: 0, attackAnim: 0 },
    ...overrides
  };
}

function addUnit(state: GameState, unit: Unit): void {
  state.units.push(unit);
}

test("units expire after their configured lifetime", () => {
  const game = createGame();
  const unit = makeUnit(100, "blue", 120, 700, {
    lifetime: { duration: 0.1, elapsed: 0 },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });
  addUnit(game, unit);

  updateUnits(game, 0.1);

  assert.equal(unit.health.hp, 0);
  assert.equal(unit.lifetime?.elapsed, 0.1);
});

test("deployment appearance completes before a unit can attack", () => {
  const game = createGame();
  const deploying = makeUnit(100, "blue", 120, 700, {
    audio: { deploy: "giant-deploy" },
    deployment: { appearanceDelay: 0.05, duration: 0, remaining: 0 }
  });
  const enemy = makeUnit(101, "red", 145, 700);
  addUnit(game, deploying);
  addUnit(game, enemy);

  updateUnits(game, 0.1);

  assert.equal(deploying.deployment.appearanceDelay, 0);
  assert.equal(deploying.combat.attackCooldown, 0);
  assert.equal(enemy.health.hp, 500);
  assert.ok(game.audioEvents.includes("giant-deploy"));
  assert.ok(game.effects.some((effect) => effect.style === "deployment"));
});

test("melee units damage an enemy in range and start their attack cooldown", () => {
  const game = createGame();
  const attacker = makeUnit(100, "blue", 120, 700);
  const target = makeUnit(101, "red", 145, 700);

  attacker.deployment.remaining = 0;
  target.health.hp = 250;
  addUnit(game, attacker);
  addUnit(game, target);

  updateUnits(game, 1 / 30);

  assert.equal(target.health.hp, 150);
  assert.equal(attacker.combat.attackCooldown, attacker.combat.attackInterval);
  assert.ok(attacker.presentation.attackAnim > 0);
});

test("units choose the nearest valid enemy rather than the first in the array", () => {
  const game = createGame();
  const attacker = makeUnit(100, "blue", 120, 700);
  const farther = makeUnit(101, "red", 160, 700);
  const nearer = makeUnit(102, "red", 130, 700);

  attacker.deployment.remaining = 0;
  addUnit(game, attacker);
  addUnit(game, farther);
  addUnit(game, nearer);

  updateUnits(game, 1 / 30);

  assert.equal(nearer.health.hp, 400);
  assert.equal(farther.health.hp, 500);
});

test("ground units cannot target air units unless their definition allows it", () => {
  const game = createGame();
  const attacker = makeUnit(100, "blue", 120, 700, { targeting: { canTargetAir: false, targetsBuildingsOnly: false } });
  const airTarget = makeUnit(101, "red", 140, 700, { movement: { speed: 0, isAir: true } });

  attacker.deployment.remaining = 0;
  addUnit(game, attacker);
  addUnit(game, airTarget);

  updateUnits(game, 1 / 30);

  assert.equal(airTarget.health.hp, 500);
  assert.equal(attacker.combat.attackCooldown, 0);
});

test("ranged units launch a projectile instead of applying immediate damage", () => {
  const game = createGame();
  const attacker = makeUnit(100, "blue", 120, 700, {
    combat: { damage: 100, range: 100, attackInterval: 1, attackCooldown: 0, attack: { type: "projectile", style: "arrow", speed: 300 }, splashRadius: 0 }
  });
  const target = makeUnit(101, "red", 170, 700);

  attacker.deployment.remaining = 0;
  addUnit(game, attacker);
  addUnit(game, target);

  updateUnits(game, 1 / 30);

  assert.equal(target.health.hp, 500);
  assert.equal(game.projectiles.length, 1);
  assert.equal(game.projectiles[0].targetId, target.id);
  assert.equal(game.projectiles[0].damage, attacker.combat.damage);
});

test("moving troops emit their configured footstep sound", () => {
  const game = createGame();
  const unit = makeUnit(100, "blue", 120, 700, {
    movement: { speed: 80, isAir: false },
    audio: { movement: { event: "giant-step", interval: 0.48 } },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });
  addUnit(game, unit);

  updateUnits(game, 1 / 30);

  assert.equal(unit.movement.isMoving, true);
  assert.ok(game.audioEvents.includes("giant-step"));
  assert.equal(unit.movement.footstepCooldown, 0.48);
});

test("princess towers fire at the nearest enemy troop in range", () => {
  const game = createGame();
  const target = makeUnit(100, "blue", 135, 205);
  addUnit(game, target);

  const tower = game.towers.find((candidate) =>
    candidate.side === "red" && candidate.kind === "princess" && candidate.lane === "left"
  );
  assert.ok(tower);
  tower.attackCooldown = 0;

  updateTowers(game, 1 / 30);

  assert.equal(game.projectiles.length, 1);
  assert.equal(game.projectiles[0].targetId, target.id);
  assert.equal(tower.attackCooldown, tower.attackInterval);
  assert.ok(game.audioEvents.includes("princess-tower-attack"));
});

test("king towers remain inactive until activated, then acquire targets", () => {
  const game = createGame();
  const target = makeUnit(100, "blue", 270, 180);
  addUnit(game, target);

  const king = game.towers.find((candidate) =>
    candidate.side === "red" && candidate.kind === "king"
  );
  assert.ok(king);
  king.attackCooldown = 0;

  for (const tower of game.towers) {
    if (tower.kind === "princess") tower.attackCooldown = 100;
  }

  updateTowers(game, 1 / 30);
  assert.equal(game.projectiles.length, 0);

  damageTarget(game, king.id, 1);
  assert.equal(king.activated, true);

  updateTowers(game, 1 / 30);

  assert.equal(game.projectiles.length, 1);
  assert.equal(game.projectiles[0].targetId, target.id);
  assert.ok(game.audioEvents.includes("king-tower-attack"));
});

test("projectile impacts apply damage when they reach their target", () => {
  const game = createGame();
  const target = makeUnit(100, "red", 160, 700);
  addUnit(game, target);

  addProjectile(game, "blue", 100, 700, target.id, target.transform.x, target.transform.y, 125, 0, "arrow", 0.2);
  updateProjectiles(game, 0.2);

  assert.equal(target.health.hp, 375);
  assert.equal(game.projectiles.length, 0);
  assert.ok(game.audioEvents.includes("projectile-impact"));
});

test("fireball splash damages enemy troops fully, towers partially, and spares allies", () => {
  const game = createGame();
  const enemy = makeUnit(100, "red", 140, 180);
  const ally = makeUnit(101, "blue", 150, 180);
  addUnit(game, enemy);
  addUnit(game, ally);

  const enemyPrincess = game.towers.find((tower) =>
    tower.side === "red" && tower.kind === "princess" && tower.lane === "left"
  );
  assert.ok(enemyPrincess);
  const originalTowerHp = enemyPrincess.hp;

  addProjectile(game, "blue", 135, 100, null, 135, 180, 100, 55, "fireball", 0.12);
  updateProjectiles(game, 0.12);

  assert.equal(enemy.health.hp, 400);
  assert.equal(ally.health.hp, 500);
  assert.equal(enemyPrincess.hp, originalTowerHp - 28);
  assert.equal(game.projectiles.length, 0);
  assert.ok(game.audioEvents.includes("fireball-explosion"));
});

test("destroying a princess tower activates its side's king tower", () => {
  const game = createGame();
  const princess = game.towers.find((tower) =>
    tower.side === "red" && tower.kind === "princess" && tower.lane === "left"
  );
  const king = game.towers.find((tower) =>
    tower.side === "red" && tower.kind === "king"
  );
  assert.ok(princess);
  assert.ok(king);
  princess.hp = 1;

  damageTarget(game, princess.id, 1);

  assert.equal(princess.hp, 0);
  assert.equal(king.activated, true);
  assert.ok(game.audioEvents.includes("crown-earned"));
  assert.ok(game.audioEvents.includes("king-activation"));
});


test("buildings include target radius when checking attack range", () => {
  const game = createGame();
  const building = makeBuilding(100, "blue", 120, 700, {
    combat: {
      damage: 100,
      range: 55,
      attackInterval: 1,
      attackCooldown: 0,
      attack: { type: "projectile", style: "cannon", speed: 300 },
      splashRadius: 0
    }
  });
  const target = makeUnit(101, "red", 120 + 55 + 12 - 1, 700);

  addUnit(game, building);
  addUnit(game, target);
  updateUnits(game, 1 / 30);

  assert.equal(game.projectiles.length, 1);
  assert.equal(game.projectiles[0].targetId, target.id);
});

test("towers include target radius when checking attack range", () => {
  const game = createGame();
  const tower = game.towers.find((candidate) =>
    candidate.side === "red" && candidate.kind === "princess" && candidate.lane === "left"
  );
  assert.ok(tower);
  tower.attackCooldown = 0;

  for (const candidate of game.towers) {
    if (candidate !== tower) candidate.attackCooldown = 100;
  }

  const target = makeUnit(
    100,
    "blue",
    tower.x + tower.range + 12 - 1,
    tower.y
  );
  addUnit(game, target);
  updateTowers(game, 1 / 30);

  assert.equal(game.projectiles.length, 1);
  assert.equal(game.projectiles[0].targetId, target.id);
});


test("simultaneous lethal melee attacks resolve regardless of unit order", () => {
  const game = createGame();
  const blue = makeUnit(100, "blue", 120, 700, {
    health: { hp: 100, maxHp: 100 },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });
  const red = makeUnit(101, "red", 145, 700, {
    health: { hp: 100, maxHp: 100 },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });

  addUnit(game, blue);
  addUnit(game, red);
  updateUnits(game, 1 / 30);

  assert.equal(blue.health.hp, 0);
  assert.equal(red.health.hp, 0);
});
