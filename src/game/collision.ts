import type { GameState, Tower, Unit } from "./types";
import { FIELD_HEIGHT, FIELD_WIDTH } from "./state";

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

export function resolveUnitCollisions(state: Pick<GameState, "units" | "towers">): void {
  separateUnits(state.units);
  separateUnitsFromTowers(state.units, state.towers);
}
