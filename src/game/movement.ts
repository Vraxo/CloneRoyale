import type { GameState, Tower, TroopUnit, Unit } from "./types";
import { ARENA_TILE_SIZE, FIELD_HEIGHT, FIELD_WIDTH, LANE_X, RIVER_BOTTOM, RIVER_TOP } from "./state";

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

function keepGroundUnitsOnBridges(units: Unit[]): void {
  for (const unit of units) {
    if (unit.kind === "building" || unit.health.hp <= 0 || unit.movement.isAir || (unit.deployment.appearanceDelay) > 0) continue;
    if (unit.transform.y < RIVER_TOP || unit.transform.y > RIVER_BOTTOM) continue;

    const bridgeX = LANE_X[unit.lane];
    const halfWidth = Math.max(0, BRIDGE_HALF_WIDTH - unit.collision.radius);
    unit.transform.x = clamp(unit.transform.x, bridgeX - halfWidth, bridgeX + halfWidth);
  }
}

function separateUnits(units: Unit[]): void {
  for (let iteration = 0; iteration < 3; iteration += 1) {
    for (let firstIndex = 0; firstIndex < units.length; firstIndex += 1) {
      const first = units[firstIndex];
      if (first.health.hp <= 0 || (first.deployment.appearanceDelay) > 0) continue;

      for (let secondIndex = firstIndex + 1; secondIndex < units.length; secondIndex += 1) {
        const second = units[secondIndex];
        if (
          second.health.hp <= 0
          || (second.deployment.appearanceDelay) > 0
          || (first.kind === "troop" && first.movement.isAir) !== (second.kind === "troop" && second.movement.isAir)
        ) continue;

        const firstDeploying = (first.deployment.appearanceDelay) > 0
          || (first.deployment.remaining) > 0;
        const secondDeploying = (second.deployment.appearanceDelay) > 0
          || (second.deployment.remaining) > 0;
        const firstCanMove = first.kind === "troop" && first.movement.speed > 0;
        const secondCanMove = second.kind === "troop" && second.movement.speed > 0;
        if (!firstCanMove && !secondCanMove) continue;

        const dx = second.transform.x - first.transform.x;
        const dy = second.transform.y - first.transform.y;
        const distanceSquared = dx * dx + dy * dy;
        const minimumDistance = first.collision.radius + second.collision.radius + 2;
        if (distanceSquared >= minimumDistance * minimumDistance) continue;

        const distance = Math.sqrt(distanceSquared);
        const directionX = distance > 0.001
          ? dx / distance
          : first.id < second.id ? 1 : -1;
        const directionY = distance > 0.001 ? dy / distance : 0;
        const overlap = minimumDistance - distance;

        let firstDisplacement = 0;
        let secondDisplacement = 0;

        if (firstDeploying && !secondDeploying) {
          secondDisplacement = secondCanMove ? overlap : 0;
        } else if (secondDeploying && !firstDeploying) {
          firstDisplacement = firstCanMove ? overlap : 0;
        } else if (firstCanMove && secondCanMove) {
          const firstMass = first.collision.mass ?? 1;
          const secondMass = second.collision.mass ?? 1;
          const totalMass = firstMass + secondMass;
          firstDisplacement = overlap * secondMass / totalMass;
          secondDisplacement = overlap * firstMass / totalMass;
        } else if (firstCanMove) {
          firstDisplacement = overlap;
        } else if (secondCanMove) {
          secondDisplacement = overlap;
        }

        if (firstDisplacement > 0) {
          first.transform.x = clamp(first.transform.x - directionX * firstDisplacement, first.collision.radius, FIELD_WIDTH - first.collision.radius);
          first.transform.y = clamp(first.transform.y - directionY * firstDisplacement, first.collision.radius, FIELD_HEIGHT - first.collision.radius);
        }

        if (secondDisplacement > 0) {
          second.transform.x = clamp(second.transform.x + directionX * secondDisplacement, second.collision.radius, FIELD_WIDTH - second.collision.radius);
          second.transform.y = clamp(second.transform.y + directionY * secondDisplacement, second.collision.radius, FIELD_HEIGHT - second.collision.radius);
        }
      }
    }
  }
}

function separateUnitsFromTowers(units: Unit[], towers: Tower[]): void {
  for (let iteration = 0; iteration < 2; iteration += 1) {
    for (const unit of units) {
      if (unit.kind === "building" || unit.health.hp <= 0 || unit.movement.isAir || (unit.deployment.appearanceDelay) > 0) continue;

      for (const tower of towers) {
        if (tower.hp <= 0) continue;

        const dx = unit.transform.x - tower.x;
        const dy = unit.transform.y - tower.y;
        const distanceSquared = dx * dx + dy * dy;
        const minimumDistance = unit.collision.radius + tower.radius + 2;
        if (distanceSquared >= minimumDistance * minimumDistance) continue;

        const distance = Math.sqrt(distanceSquared);
        const directionX = distance > 0.001
          ? dx / distance
          : unit.side === "blue" ? 0 : 0;
        const directionY = distance > 0.001
          ? dy / distance
          : unit.side === "blue" ? 1 : -1;
        const overlap = minimumDistance - distance;

        unit.transform.x = clamp(
          unit.transform.x + directionX * overlap,
          unit.collision.radius,
          FIELD_WIDTH - unit.collision.radius
        );
        unit.transform.y = clamp(
          unit.transform.y + directionY * overlap,
          unit.collision.radius,
          FIELD_HEIGHT - unit.collision.radius
        );
      }
    }
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function resolveUnitCollisions(state: GameState): void {
  separateUnits(state.units);
  separateUnitsFromTowers(state.units, state.towers);
  keepGroundUnitsOnBridges(state.units);
}
