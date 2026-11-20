import type { GameState, TroopUnit, Unit } from "./types";
import { ARENA_TILE_SIZE, LANE_X, RIVER_BOTTOM, RIVER_TOP } from "./state";

const BRIDGE_HALF_WIDTH = 1.5 * ARENA_TILE_SIZE;

type PathingUnit = Pick<TroopUnit, "lane" | "transform" | "movement" | "collision">;
type MovingUnit = Pick<TroopUnit, "transform" | "movement">;
type ObstacleAvoidanceUnit = Pick<TroopUnit, "id" | "transform" | "movement" | "collision">;
type MovementUnit = Pick<TroopUnit, "id" | "lane" | "transform" | "movement" | "collision">;

function riverBank(y: number): -1 | 0 | 1 {
  if (y < RIVER_TOP) return -1;
  if (y > RIVER_BOTTOM) return 1;
  return 0;
}

function movementTarget(unit: PathingUnit, targetX: number, targetY: number): { x: number; y: number } {
  if (unit.movement.isAir) return { x: targetX, y: targetY };

  const currentBank = riverBank(unit.transform.y);
  const targetBank = riverBank(targetY);
  const bridgeX = LANE_X[unit.lane];

  if (currentBank === targetBank && currentBank !== 0) {
    return { x: targetX, y: targetY };
  }

  if (currentBank === 0) {
    if (targetBank === 0) {
      const targetFitsBridge = Math.abs(targetX - bridgeX) <= BRIDGE_HALF_WIDTH - unit.collision.radius;
      return {
        x: targetFitsBridge ? targetX : bridgeX,
        y: targetY
      };
    }

    return {
      x: bridgeX,
      y: targetBank < 0 ? RIVER_TOP - 1 : RIVER_BOTTOM + 1
    };
  }

  if (targetBank === 0) {
    return { x: bridgeX, y: targetY };
  }

  return {
    x: bridgeX,
    y: currentBank < 0 ? RIVER_TOP : RIVER_BOTTOM
  };
}

function moveToward(unit: MovingUnit, x: number, y: number, dt: number): void {
  const dx = x - unit.transform.x;
  const dy = y - unit.transform.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001 || unit.movement.speed <= 0) return;

  unit.transform.facing = Math.atan2(dy, dx);
  unit.movement.isMoving = true;
  const amount = Math.min(distance, unit.movement.speed * dt);
  unit.transform.x += (dx / distance) * amount;
  unit.transform.y += (dy / distance) * amount;
}

interface MovementObstacle {
  id: number;
  x: number;
  y: number;
  radius: number;
}

function findObstacleWaypoint(
  state: GameState,
  unit: ObstacleAvoidanceUnit,
  targetX: number,
  targetY: number,
  targetId: number
): { x: number; y: number } | null {
  if (unit.movement.isAir) return null;

  const dx = targetX - unit.transform.x;
  const dy = targetY - unit.transform.y;
  const pathLengthSquared = dx * dx + dy * dy;
  if (pathLengthSquared < 1) return null;

  const obstacles: MovementObstacle[] = [
    ...state.units
      .filter((candidate) =>
        candidate.id !== targetId
        && candidate.id !== unit.id
        && candidate.kind === "building"
        && candidate.health.hp > 0
        && (candidate.deployment.appearanceDelay) <= 0
      )
      .map((candidate) => ({
        id: candidate.id,
        x: candidate.transform.x,
        y: candidate.transform.y,
        radius: candidate.collision.radius
      })),
    ...state.towers
      .filter((tower) => tower.id !== targetId && tower.hp > 0)
      .map((tower) => ({
        id: tower.id,
        x: tower.x,
        y: tower.y,
        radius: tower.radius
      }))
  ];

  let firstObstacle: MovementObstacle | null = null;
  let firstProjection = Number.POSITIVE_INFINITY;

  for (const obstacle of obstacles) {
    const projection = (
      (obstacle.x - unit.transform.x) * dx + (obstacle.y - unit.transform.y) * dy
    ) / pathLengthSquared;
    if (projection <= 0 || projection >= 1 || projection >= firstProjection) continue;

    const closestX = unit.transform.x + dx * projection;
    const closestY = unit.transform.y + dy * projection;
    const clearance = unit.collision.radius + obstacle.radius + 7;
    const offsetX = obstacle.x - closestX;
    const offsetY = obstacle.y - closestY;
    if (offsetX * offsetX + offsetY * offsetY >= clearance * clearance) continue;

    firstObstacle = obstacle;
    firstProjection = projection;
  }

  if (!firstObstacle) return null;

  const pathLength = Math.sqrt(pathLengthSquared);
  const perpendicularX = -dy / pathLength;
  const perpendicularY = dx / pathLength;
  const clearance = unit.collision.radius + firstObstacle.radius + 9;
  const left = {
    x: firstObstacle.x + perpendicularX * clearance,
    y: firstObstacle.y + perpendicularY * clearance
  };
  const right = {
    x: firstObstacle.x - perpendicularX * clearance,
    y: firstObstacle.y - perpendicularY * clearance
  };
  const leftDistance = Math.hypot(left.x - unit.transform.x, left.y - unit.transform.y)
    + Math.hypot(targetX - left.x, targetY - left.y);
  const rightDistance = Math.hypot(right.x - unit.transform.x, right.y - unit.transform.y)
    + Math.hypot(targetX - right.x, targetY - right.y);

  if (Math.abs(leftDistance - rightDistance) < 0.01) {
    return unit.id % 2 === 0 ? left : right;
  }

  return leftDistance < rightDistance ? left : right;
}

export function moveUnitTowardTarget(
  state: GameState,
  unit: MovementUnit,
  x: number,
  y: number,
  dt: number,
  targetId: number
): void {
  if (unit.movement.formationSlot !== undefined) {
    const dx = unit.transform.x - x;
    const dy = unit.transform.y - y;
    const distance = Math.hypot(dx, dy) || 1;
    const offset = unit.movement.formationSlot * (unit.collision.radius + 3);
    const perpendicularX = -dy / distance;
    const perpendicularY = dx / distance;
    x += perpendicularX * offset;
    y += perpendicularY * offset;
  }

  const target = movementTarget(unit, x, y);
  const waypoint = findObstacleWaypoint(state, unit, target.x, target.y, targetId);
  moveToward(unit, waypoint?.x ?? target.x, waypoint?.y ?? target.y, dt);
}

export function keepGroundUnitsOnBridges(units: Unit[]): void {
  for (const unit of units) {
    if (unit.kind === "building" || unit.health.hp <= 0 || unit.movement.isAir || (unit.deployment.appearanceDelay) > 0) continue;
    if (unit.transform.y < RIVER_TOP || unit.transform.y > RIVER_BOTTOM) continue;

    const bridgeX = LANE_X[unit.lane];
    const halfWidth = Math.max(0, BRIDGE_HALF_WIDTH - unit.collision.radius);
    unit.transform.x = clamp(unit.transform.x, bridgeX - halfWidth, bridgeX + halfWidth);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
