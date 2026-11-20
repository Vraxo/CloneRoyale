import assert from "node:assert/strict";
import test from "node:test";
import { updateUnits } from "../../../src/game/combat.js";
import { keepGroundUnitsOnBridges, moveUnitTowardTarget } from "../../../src/game/movement.js";
import { createGame } from "../../../src/game/simulation.js";
import { ARENA_TILE_SIZE, LANE_X, RIVER_BOTTOM, RIVER_TOP } from "../../../src/game/state.js";
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
    combat: { damage: 100, range: 55, attackInterval: 1, attackCooldown: 100, attack: { type: "melee" }, splashRadius: 0 },
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

test("separates overlapping ground units without leaving them intersecting", () => {
  const game = createGame();
  const first = makeUnit(100, "blue", 180, 700, { movement: { speed: 80, isAir: false } });
  const second = makeUnit(101, "blue", 180, 700, { movement: { speed: 80, isAir: false } });

  addUnit(game, first);
  addUnit(game, second);
  updateUnits(game, 1 / 30);

  const distance = Math.hypot(second.transform.x - first.transform.x, second.transform.y - first.transform.y);
  assert.ok(distance >= first.collision.radius + second.collision.radius + 2 - 0.01);
});

test("does not separate air units from ground units", () => {
  const game = createGame();
  const ground = makeUnit(100, "blue", 180, 700, { movement: { speed: 80, isAir: false } });
  const air = makeUnit(101, "blue", 180, 700, { movement: { speed: 80, isAir: true } });

  addUnit(game, ground);
  addUnit(game, air);
  updateUnits(game, 1 / 30);

  assert.equal(ground.transform.x, 180);
  assert.equal(ground.transform.y, 700);
  assert.equal(air.transform.x, 180);
  assert.equal(air.transform.y, 700);
});

test("keeps ground units inside their lane's bridge corridor while crossing the river", () => {
  const game = createGame();
  const bridgeX = LANE_X.left;
  const halfBridgeWidth = 1.5 * ARENA_TILE_SIZE;
  const unit = makeUnit(100, "blue", 300, RIVER_BOTTOM + 10, {
    movement: { speed: 90, isAir: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 },
    lane: "left"
  });
  addUnit(game, unit);

  let enteredRiver = false;
  let crossedRiver = false;

  for (let step = 0; step < 80; step += 1) {
    const previousY = unit.transform.y;
    updateUnits(game, 0.1);

    if (unit.transform.y <= RIVER_BOTTOM && unit.transform.y >= RIVER_TOP) {
      enteredRiver = true;
      assert.ok(Math.abs(unit.transform.x - bridgeX) <= halfBridgeWidth - unit.collision.radius + 0.01);
    }

    if (previousY > RIVER_TOP && unit.transform.y <= RIVER_TOP) {
      crossedRiver = true;
      assert.ok(Math.abs(unit.transform.x - bridgeX) <= halfBridgeWidth - unit.collision.radius + 0.01);
      break;
    }
  }

  assert.equal(enteredRiver, true);
  assert.equal(crossedRiver, true);
});

test("routes ground troops around blocking buildings instead of moving straight through", () => {
  const game = createGame();
  const troop = makeUnit(100, "blue", 105, 800, {
    movement: { speed: 100, isAir: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 },
    lane: "left"
  });
  const blocker = makeBuilding(200, "blue", 105, 650, {
    collision: { radius: 20 }
  });

  addUnit(game, troop);
  addUnit(game, blocker);
  updateUnits(game, 0.1);

  assert.ok(troop.transform.x > 105, "the troop should take a lateral waypoint around the building");
  assert.ok(Math.hypot(troop.transform.x - blocker.transform.x, troop.transform.y - blocker.transform.y) > troop.collision.radius + blocker.collision.radius);
});

test("pushes ground units out of tower collision space", () => {
  const game = createGame();
  const tower = game.towers.find((candidate) =>
    candidate.side === "blue" && candidate.kind === "princess" && candidate.lane === "left"
  );
  assert.ok(tower);

  const unit = makeUnit(100, "blue", tower.x, tower.y, {
    movement: { speed: 100, isAir: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 10 }
  });
  addUnit(game, unit);
  updateUnits(game, 1 / 30);

  const distance = Math.hypot(unit.transform.x - tower.x, unit.transform.y - tower.y);
  assert.ok(distance >= unit.collision.radius + tower.radius + 2 - 0.01);
});


test("bridge constraints leave air, defeated, deploying, and stationary units untouched", () => {
  const game = createGame();
  const riverY = (RIVER_TOP + RIVER_BOTTOM) / 2;
  const bridgeX = LANE_X.left;
  const activeGround = makeUnit(100, "blue", 300, riverY, {
    movement: { speed: 80, isAir: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });
  const air = makeUnit(101, "blue", 300, riverY, {
    movement: { speed: 80, isAir: true },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });
  const defeated = makeUnit(102, "blue", 300, riverY, {
    health: { hp: 0, maxHp: 500 },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });
  const deploying = makeUnit(103, "blue", 300, riverY, {
    movement: { speed: 80, isAir: false },
    deployment: { appearanceDelay: 0.1, duration: 0, remaining: 0 }
  });
  const building = makeBuilding(104, "blue", 300, riverY);
  game.units.push(activeGround, air, defeated, deploying, building);

  keepGroundUnitsOnBridges(game.units);

  assert.equal(activeGround.transform.x, bridgeX + 1.5 * ARENA_TILE_SIZE - activeGround.collision.radius);
  assert.equal(air.transform.x, 300);
  assert.equal(defeated.transform.x, 300);
  assert.equal(deploying.transform.x, 300);
  assert.equal(building.transform.x, 300);
});

test("air units move directly toward targets across the river", () => {
  const game = createGame();
  const unit = makeUnit(300, "blue", 300, 700, {
    movement: { speed: 100, isAir: true },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });

  moveUnitTowardTarget(game, unit, 300, 200, 1, 999);

  assert.equal(unit.transform.x, 300);
  assert.equal(unit.transform.y, 600);
  assert.equal(unit.movement.isMoving, true);
});

test("formation slots offset troop movement perpendicular to its target", () => {
  const game = createGame();
  const unit = makeUnit(301, "blue", 200, 700, {
    movement: { speed: 100, isAir: false, formationSlot: 1 },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });

  moveUnitTowardTarget(game, unit, 200, 650, 1, 999);

  assert.equal(unit.transform.x, 185);
  assert.equal(unit.transform.y, 650);
  assert.equal(unit.movement.isMoving, true);
});


test("does not alter facing or moving state when already at the target", () => {
  const game = createGame();
  const unit = makeUnit(302, "blue", 200, 700, {
    movement: { speed: 100, isAir: false, isMoving: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });

  moveUnitTowardTarget(game, unit, 200, 700, 1, 999);

  assert.equal(unit.transform.x, 200);
  assert.equal(unit.transform.y, 700);
  assert.equal(unit.transform.facing, 0);
  assert.equal(unit.movement.isMoving, false);
});


test("does not move a troop with zero movement speed", () => {
  const game = createGame();
  const unit = makeUnit(303, "blue", 200, 700, {
    movement: { speed: 0, isAir: false, isMoving: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });

  moveUnitTowardTarget(game, unit, 200, 600, 1, 999);

  assert.equal(unit.transform.x, 200);
  assert.equal(unit.transform.y, 700);
  assert.equal(unit.transform.facing, 0);
  assert.equal(unit.movement.isMoving, false);
});


test("routes a ground troop from the river interior to the correct bridge exit", () => {
  const game = createGame();
  const unit = makeUnit(304, "blue", 300, (RIVER_TOP + RIVER_BOTTOM) / 2, {
    movement: { speed: 1000, isAir: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 },
    lane: "left"
  });

  moveUnitTowardTarget(game, unit, 300, 200, 1, 999);

  assert.equal(unit.transform.x, LANE_X.left);
  assert.equal(unit.transform.y, RIVER_TOP - 1);
});


test("ground troops in the river pursue targets directly only within the bridge corridor", () => {
  const game = createGame();
  const directTarget = makeUnit(305, "blue", LANE_X.left, 480, {
    movement: { speed: 1000, isAir: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });
  const outsideTarget = makeUnit(306, "blue", LANE_X.left, 480, {
    movement: { speed: 1000, isAir: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });

  moveUnitTowardTarget(game, directTarget, LANE_X.left + 15, 500, 1, 999);
  moveUnitTowardTarget(game, outsideTarget, 300, 500, 1, 999);

  assert.equal(directTarget.transform.x, LANE_X.left + 15);
  assert.equal(directTarget.transform.y, 500);
  assert.equal(outsideTarget.transform.x, LANE_X.left);
  assert.equal(outsideTarget.transform.y, 500);
});


test("routes a ground troop in the river interior toward the south-bank exit", () => {
  const game = createGame();
  const unit = makeUnit(307, "blue", 300, 500, {
    movement: { speed: 1000, isAir: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 },
    lane: "left"
  });

  moveUnitTowardTarget(game, unit, 300, 700, 1, 999);

  assert.equal(unit.transform.x, LANE_X.left);
  assert.equal(unit.transform.y, RIVER_BOTTOM + 1);
  assert.equal(unit.movement.isMoving, true);
});


test("routes a red ground troop from the south bank to the north-bank bridge exit", () => {
  const game = createGame();
  const unit = makeUnit(308, "red", 300, 700, {
    movement: { speed: 1000, isAir: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 },
    lane: "left"
  });

  moveUnitTowardTarget(game, unit, 300, 200, 1, 999);

  assert.equal(unit.transform.x, LANE_X.left);
  assert.equal(unit.transform.y, RIVER_BOTTOM);
  assert.equal(unit.movement.isMoving, true);
});


test("routes a ground troop from its bank to a target inside the river", () => {
  const game = createGame();
  const unit = makeUnit(309, "blue", 300, 400, {
    movement: { speed: 1000, isAir: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 },
    lane: "left"
  });

  moveUnitTowardTarget(game, unit, 300, 480, 1, 999);

  assert.equal(unit.transform.x, LANE_X.left);
  assert.equal(unit.transform.y, 480);
  assert.equal(unit.movement.isMoving, true);
});

test("chooses deterministic opposite sides for equidistant obstacle routes", () => {
  const run = (id: number) => {
    const game = createGame();
    const unit = makeUnit(id, "blue", LANE_X.left, 800, {
      movement: { speed: 100, isAir: false },
      deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
    });
    const blocker = makeBuilding(500, "blue", LANE_X.left, 700, {
      collision: { radius: 20 }
    });

    addUnit(game, unit);
    addUnit(game, blocker);
    moveUnitTowardTarget(game, unit, LANE_X.left, 600, 0.1, 999);

    return unit.transform.x;
  };

  assert.ok(run(400) > LANE_X.left, "even IDs should consistently take the left waypoint");
  assert.ok(run(401) < LANE_X.left, "odd IDs should consistently take the right waypoint");
});

test("does not divert a troop around an obstacle that is its target", () => {
  const game = createGame();
  const unit = makeUnit(402, "blue", LANE_X.left, 800, {
    movement: { speed: 100, isAir: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 }
  });
  const target = makeBuilding(403, "red", LANE_X.left, 700, {
    collision: { radius: 20 }
  });
  game.towers = [];

  addUnit(game, unit);
  addUnit(game, target);
  moveUnitTowardTarget(game, unit, target.transform.x, target.transform.y, 0.1, target.id);

  assert.equal(unit.transform.x, LANE_X.left);
  assert.equal(unit.transform.y, 790);
});
