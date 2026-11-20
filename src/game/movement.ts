import type { GameState, Tower, Unit } from "./types";
import type { UnitCollision, UnitIdentity, UnitMovement, UnitTransform } from "./types/Unit";
import { ARENA_TILE_SIZE, FIELD_HEIGHT, FIELD_WIDTH, LANE_X, RIVER_BOTTOM, RIVER_TOP } from "./state";

const BRIDGE_HALF_WIDTH = 1.5 * ARENA_TILE_SIZE;

type PathingUnit =
  & Pick<UnitTransform, "x" | "y">
  & Pick<UnitMovement, "isAir">
  & Pick<UnitCollision, "radius">
  & Pick<UnitIdentity, "lane">;

type MovingUnit =
  & Pick<UnitTransform, "x" | "y" | "facing">
  & Pick<UnitMovement, "speed" | "isMoving">;

function riverBank(y: number): -1 | 0 | 1 {
  if (y < RIVER_TOP) return -1;
  if (y > RIVER_BOTTOM) return 1;
  return 0;
}

function movementTarget(unit: PathingUnit, targetX: number, targetY: number): { x: number; y: number } {
  if (unit.isAir) return { x: targetX, y: targetY };

  const currentBank = riverBank(unit.y);
  const targetBank = riverBank(targetY);
  const bridgeX = LANE_X[unit.lane];

  if (currentBank === targetBank && currentBank !== 0) {
    return { x: targetX, y: targetY };
  }

  if (currentBank === 0) {
    if (targetBank === 0) {
      const targetFitsBridge = Math.abs(targetX - bridgeX) <= BRIDGE_HALF_WIDTH - unit.radius;
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
  const dx = x - unit.x;
  const dy = y - unit.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001 || unit.speed <= 0) return;

  unit.facing = Math.atan2(dy, dx);
  unit.isMoving = true;
  const amount = Math.min(distance, unit.speed * dt);
  unit.x += (dx / distance) * amount;
  unit.y += (dy / distance) * amount;
}

interface MovementObstacle {
  id: number;
  x: number;
  y: number;
  radius: number;
}

function findObstacleWaypoint(
  state: GameState,
  unit: Unit,
  targetX: number,
  targetY: number,
  targetId: number
): { x: number; y: number } | null {
  if (unit.isAir) return null;

  const dx = targetX - unit.x;
  const dy = targetY - unit.y;
  const pathLengthSquared = dx * dx + dy * dy;
  if (pathLengthSquared < 1) return null;

  const obstacles: MovementObstacle[] = [
    ...state.units
      .filter((candidate) =>
        candidate.id !== targetId
        && candidate.id !== unit.id
        && candidate.kind === "building"
        && candidate.hp > 0
        && !candidate.isAir
        && (candidate.appearanceDelayRemaining ?? 0) <= 0
      )
      .map((candidate) => ({
        id: candidate.id,
        x: candidate.x,
        y: candidate.y,
        radius: candidate.radius
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
      (obstacle.x - unit.x) * dx + (obstacle.y - unit.y) * dy
    ) / pathLengthSquared;
    if (projection <= 0 || projection >= 1 || projection >= firstProjection) continue;

    const closestX = unit.x + dx * projection;
    const closestY = unit.y + dy * projection;
    const clearance = unit.radius + obstacle.radius + 7;
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
  const clearance = unit.radius + firstObstacle.radius + 9;
  const left = {
    x: firstObstacle.x + perpendicularX * clearance,
    y: firstObstacle.y + perpendicularY * clearance
  };
  const right = {
    x: firstObstacle.x - perpendicularX * clearance,
    y: firstObstacle.y - perpendicularY * clearance
  };
  const leftDistance = Math.hypot(left.x - unit.x, left.y - unit.y)
    + Math.hypot(targetX - left.x, targetY - left.y);
  const rightDistance = Math.hypot(right.x - unit.x, right.y - unit.y)
    + Math.hypot(targetX - right.x, targetY - right.y);

  if (Math.abs(leftDistance - rightDistance) < 0.01) {
    return unit.id % 2 === 0 ? left : right;
  }

  return leftDistance < rightDistance ? left : right;
}

export function moveUnitTowardTarget(
  state: GameState,
  unit: Unit,
  x: number,
  y: number,
  dt: number,
  targetId: number
): void {
  if (unit.formationSlot !== undefined) {
    const dx = unit.x - x;
    const dy = unit.y - y;
    const distance = Math.hypot(dx, dy) || 1;
    const offset = unit.formationSlot * (unit.radius + 3);
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
    if (unit.hp <= 0 || unit.isAir || (unit.appearanceDelayRemaining ?? 0) > 0) continue;
    if (unit.y < RIVER_TOP || unit.y > RIVER_BOTTOM) continue;

    const bridgeX = LANE_X[unit.lane];
    const halfWidth = Math.max(0, BRIDGE_HALF_WIDTH - unit.radius);
    unit.x = clamp(unit.x, bridgeX - halfWidth, bridgeX + halfWidth);
  }
}

function separateUnits(units: Unit[]): void {
  for (let iteration = 0; iteration < 3; iteration += 1) {
    for (let firstIndex = 0; firstIndex < units.length; firstIndex += 1) {
      const first = units[firstIndex];
      if (first.hp <= 0 || (first.appearanceDelayRemaining ?? 0) > 0) continue;

      for (let secondIndex = firstIndex + 1; secondIndex < units.length; secondIndex += 1) {
        const second = units[secondIndex];
        if (
          second.hp <= 0
          || (second.appearanceDelayRemaining ?? 0) > 0
          || first.isAir !== second.isAir
        ) continue;

        const firstDeploying = (first.appearanceDelayRemaining ?? 0) > 0
          || (first.deploymentRemaining ?? 0) > 0;
        const secondDeploying = (second.appearanceDelayRemaining ?? 0) > 0
          || (second.deploymentRemaining ?? 0) > 0;
        const firstCanMove = first.kind !== "building" && first.speed > 0;
        const secondCanMove = second.kind !== "building" && second.speed > 0;
        if (!firstCanMove && !secondCanMove) continue;

        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const distanceSquared = dx * dx + dy * dy;
        const minimumDistance = first.radius + second.radius + 2;
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
          const firstMass = first.collisionMass ?? 1;
          const secondMass = second.collisionMass ?? 1;
          const totalMass = firstMass + secondMass;
          firstDisplacement = overlap * secondMass / totalMass;
          secondDisplacement = overlap * firstMass / totalMass;
        } else if (firstCanMove) {
          firstDisplacement = overlap;
        } else if (secondCanMove) {
          secondDisplacement = overlap;
        }

        if (firstDisplacement > 0) {
          first.x = clamp(first.x - directionX * firstDisplacement, first.radius, FIELD_WIDTH - first.radius);
          first.y = clamp(first.y - directionY * firstDisplacement, first.radius, FIELD_HEIGHT - first.radius);
        }

        if (secondDisplacement > 0) {
          second.x = clamp(second.x + directionX * secondDisplacement, second.radius, FIELD_WIDTH - second.radius);
          second.y = clamp(second.y + directionY * secondDisplacement, second.radius, FIELD_HEIGHT - second.radius);
        }
      }
    }
  }
}

function separateUnitsFromTowers(units: Unit[], towers: Tower[]): void {
  for (let iteration = 0; iteration < 2; iteration += 1) {
    for (const unit of units) {
      if (unit.hp <= 0 || unit.isAir || (unit.appearanceDelayRemaining ?? 0) > 0) continue;

      for (const tower of towers) {
        if (tower.hp <= 0) continue;

        const dx = unit.x - tower.x;
        const dy = unit.y - tower.y;
        const distanceSquared = dx * dx + dy * dy;
        const minimumDistance = unit.radius + tower.radius + 2;
        if (distanceSquared >= minimumDistance * minimumDistance) continue;

        const distance = Math.sqrt(distanceSquared);
        const directionX = distance > 0.001
          ? dx / distance
          : unit.side === "blue" ? 0 : 0;
        const directionY = distance > 0.001
          ? dy / distance
          : unit.side === "blue" ? 1 : -1;
        const overlap = minimumDistance - distance;

        unit.x = clamp(
          unit.x + directionX * overlap,
          unit.radius,
          FIELD_WIDTH - unit.radius
        );
        unit.y = clamp(
          unit.y + directionY * overlap,
          unit.radius,
          FIELD_HEIGHT - unit.radius
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
