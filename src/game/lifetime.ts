import type { Unit } from "./types";

type LifetimeUnit = Pick<Unit, "health" | "lifetime">;

export function updateUnitLifetime(unit: LifetimeUnit, dt: number): boolean {
  if (!unit.lifetime) return false;

  unit.lifetime.elapsed += dt;
  if (unit.lifetime.duration <= 0 || unit.lifetime.elapsed < unit.lifetime.duration) {
    return false;
  }

  unit.health.hp = 0;
  return true;
}
