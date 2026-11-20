import assert from "node:assert/strict";
import test from "node:test";
import { updateUnits } from "../../../src/game/combat.js";
import { createGame } from "../../../src/game/simulation.js";
import { ARENA_TILE_SIZE, LANE_X, RIVER_BOTTOM, RIVER_TOP } from "../../../src/game/state.js";
import type { GameState, Unit } from "../../../src/game/types/index.js";

function makeUnit(
  id: number,
  side: "blue" | "red",
  x: number,
  y: number,
  overrides: Partial<Unit> = {}
): Unit {
  return {
    id,
    side,
    cardId: "giant",
    type: "giant",
    kind: "troop",
    lane: "left",
    x,
    y,
    hp: 500,
    maxHp: 500,
    radius: 12,
    damage: 100,
    speed: 0,
    range: 55,
    attackInterval: 1,
    attackCooldown: 100,
    attack: { type: "melee" },
    splashRadius: 0,
    isAir: false,
    canTargetAir: true,
    targetsBuildingsOnly: false,
    lifetime: 0,
    age: 0,
    deployment: { appearanceDelay: 0, duration: 0, remaining: 10 },
    facing: 0,
    presentation: { animationOffset: 0, attackAnim: 0 },
    ...overrides
  };
}

function addUnit(state: GameState, unit: Unit): void {
  state.units.push(unit);
}

test("separates overlapping ground units without leaving them intersecting", () => {
  const game = createGame();
  const first = makeUnit(100, "blue", 180, 700, { speed: 80 });
  const second = makeUnit(101, "blue", 180, 700, { speed: 80 });

  addUnit(game, first);
  addUnit(game, second);
  updateUnits(game, 1 / 30);

  const distance = Math.hypot(second.x - first.x, second.y - first.y);
  assert.ok(distance >= first.radius + second.radius + 2 - 0.01);
});

test("does not separate air units from ground units", () => {
  const game = createGame();
  const ground = makeUnit(100, "blue", 180, 700, { speed: 80 });
  const air = makeUnit(101, "blue", 180, 700, { speed: 80, isAir: true });

  addUnit(game, ground);
  addUnit(game, air);
  updateUnits(game, 1 / 30);

  assert.equal(ground.x, 180);
  assert.equal(ground.y, 700);
  assert.equal(air.x, 180);
  assert.equal(air.y, 700);
});

test("keeps ground units inside their lane's bridge corridor while crossing the river", () => {
  const game = createGame();
  const bridgeX = LANE_X.left;
  const halfBridgeWidth = 1.5 * ARENA_TILE_SIZE;
  const unit = makeUnit(100, "blue", 300, RIVER_BOTTOM + 10, {
    speed: 90,
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
    lane: "left"
  });
  addUnit(game, unit);

  let enteredRiver = false;
  let crossedRiver = false;

  for (let step = 0; step < 80; step += 1) {
    const previousY = unit.y;
    updateUnits(game, 0.1);

    if (unit.y <= RIVER_BOTTOM && unit.y >= RIVER_TOP) {
      enteredRiver = true;
      assert.ok(Math.abs(unit.x - bridgeX) <= halfBridgeWidth - unit.radius + 0.01);
    }

    if (previousY > RIVER_TOP && unit.y <= RIVER_TOP) {
      crossedRiver = true;
      assert.ok(Math.abs(unit.x - bridgeX) <= halfBridgeWidth - unit.radius + 0.01);
      break;
    }
  }

  assert.equal(enteredRiver, true);
  assert.equal(crossedRiver, true);
});

test("routes ground troops around blocking buildings instead of moving straight through", () => {
  const game = createGame();
  const troop = makeUnit(100, "blue", 105, 800, {
    speed: 100,
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
    lane: "left"
  });
  const blocker = makeUnit(200, "blue", 105, 650, {
    cardId: "cannon",
    type: "cannon",
    kind: "building",
    radius: 20,
    speed: 0,
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });

  addUnit(game, troop);
  addUnit(game, blocker);
  updateUnits(game, 0.1);

  assert.ok(troop.x > 105, "the troop should take a lateral waypoint around the building");
  assert.ok(Math.hypot(troop.x - blocker.x, troop.y - blocker.y) > troop.radius + blocker.radius);
});

test("pushes ground units out of tower collision space", () => {
  const game = createGame();
  const tower = game.towers.find((candidate) =>
    candidate.side === "blue" && candidate.kind === "princess" && candidate.lane === "left"
  );
  assert.ok(tower);

  const unit = makeUnit(100, "blue", tower.x, tower.y, {
    speed: 100,
    deploymentRemaining: 10
  });
  addUnit(game, unit);
  updateUnits(game, 1 / 30);

  const distance = Math.hypot(unit.x - tower.x, unit.y - tower.y);
  assert.ok(distance >= unit.radius + tower.radius + 2 - 0.01);
});
