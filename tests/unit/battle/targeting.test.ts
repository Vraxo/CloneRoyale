import assert from "node:assert/strict";
import test from "node:test";
import { findEnemyTower, findEnemyUnit, findTowerTarget } from "../../../src/game/targeting.js";
import { createGame } from "../../../src/game/simulation.js";
import type { BuildingUnit, GameState, TroopUnit, Unit } from "../../../src/game/types/index.js";

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

function makeBuilding(id: number, side: "blue" | "red", x: number, y: number): BuildingUnit {
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
    presentation: { animationOffset: 0, attackAnim: 0 }
  };
}

function addUnits(state: GameState, ...units: Unit[]): void {
  state.units.push(...units);
}

test("unit targeting skips allies, defeated units, and units still appearing", () => {
  const state = createGame();
  const attacker = makeTroop(100, "blue", 100, 100);
  const ally = makeTroop(101, "blue", 101, 100);
  const defeated = makeTroop(102, "red", 102, 100, { health: { hp: 0, maxHp: 500 } });
  const appearing = makeTroop(103, "red", 103, 100, {
    deployment: { appearanceDelay: 0.1, duration: 0, remaining: 0 }
  });
  const valid = makeTroop(104, "red", 120, 100);

  addUnits(state, ally, defeated, appearing, valid);

  assert.equal(findEnemyUnit(state, attacker, 50), valid);
});

test("unit targeting respects air capability and buildings-only restrictions", () => {
  const state = createGame();
  const attacker = makeTroop(100, "blue", 100, 100, {
    targeting: { canTargetAir: false, targetsBuildingsOnly: true }
  });
  const airTroop = makeTroop(101, "red", 101, 100, {
    movement: { speed: 0, isAir: true }
  });
  const groundTroop = makeTroop(102, "red", 102, 100);
  const building = makeBuilding(103, "red", 110, 100);

  addUnits(state, airTroop, groundTroop, building);

  assert.equal(findEnemyUnit(state, attacker, 50, true), building);
  assert.equal(findEnemyUnit(state, attacker, 50, false), groundTroop);
});

test("unit targeting uses a strict range boundary and can include target radius", () => {
  const state = createGame();
  const attacker = makeTroop(100, "blue", 100, 100);
  const target = makeTroop(101, "red", 125, 100);

  addUnits(state, target);

  assert.equal(findEnemyUnit(state, attacker, 25), null);
  assert.equal(findEnemyUnit(state, attacker, 20, false, true), target);
});

test("unit targeting chooses the nearest valid target regardless of array order", () => {
  const state = createGame();
  const attacker = makeTroop(100, "blue", 100, 100);
  const farther = makeTroop(101, "red", 140, 100);
  const nearer = makeTroop(102, "red", 115, 100);

  addUnits(state, farther, nearer);

  assert.equal(findEnemyUnit(state, attacker, 60), nearer);
});

test("lane targeting prefers its living princess tower and falls back to the king", () => {
  const state = createGame();
  const unit = makeTroop(100, "blue", 135, 800);
  const princess = state.towers.find((tower) =>
    tower.side === "red" && tower.kind === "princess" && tower.lane === "left"
  );
  const king = state.towers.find((tower) => tower.side === "red" && tower.kind === "king");

  assert.ok(princess);
  assert.ok(king);
  assert.equal(findEnemyTower(state, unit), princess);

  princess.hp = 0;

  assert.equal(findEnemyTower(state, unit), king);
});

test("tower targeting skips allies, defeated units, and deploying units", () => {
  const state = createGame();
  const tower = state.towers.find((candidate) =>
    candidate.side === "red" && candidate.kind === "princess" && candidate.lane === "left"
  );
  assert.ok(tower);

  const ally = makeTroop(100, "red", tower.x + 1, tower.y);
  const defeated = makeTroop(101, "blue", tower.x + 2, tower.y, {
    health: { hp: 0, maxHp: 500 }
  });
  const appearing = makeTroop(102, "blue", tower.x + 3, tower.y, {
    deployment: { appearanceDelay: 0.1, duration: 0, remaining: 0 }
  });
  const valid = makeTroop(103, "blue", tower.x + 20, tower.y);

  assert.equal(findTowerTarget(tower, [ally, defeated, appearing, valid])?.id, valid.id);
});

test("tower targeting includes the target collision radius at the range boundary", () => {
  const state = createGame();
  const tower = state.towers.find((candidate) =>
    candidate.side === "red" && candidate.kind === "princess" && candidate.lane === "left"
  );
  assert.ok(tower);

  const target = makeTroop(
    100,
    "blue",
    tower.x + tower.range + 12 - 1,
    tower.y
  );

  assert.equal(findTowerTarget(tower, [target])?.id, target.id);
});
