import type { GameState, Tower, Unit } from "./types";
import { otherSide } from "./state";

type UnitTargetingState = Pick<GameState, "units">;
type TowerTargetingState = Pick<GameState, "towers">;

type TargetingUnit = Pick<Unit, "side" | "transform" | "targeting">;
type LaneUnit = Pick<Unit, "side" | "lane" | "transform">;

export function findEnemyUnit(
  state: UnitTargetingState,
  unit: TargetingUnit,
  detectionRange: number,
  buildingsOnly = false,
  includeTargetRadius = false
): Unit | null {
  let nearest: Unit | null = null;
  let nearestDistance = detectionRange;

  for (const candidate of state.units) {
    if (candidate.side === unit.side || candidate.health.hp <= 0) continue;
    if ((candidate.deployment.appearanceDelay) > 0) continue;
    if (buildingsOnly && candidate.kind !== "building") continue;
    if (!unit.targeting.canTargetAir && candidate.kind === "troop" && candidate.movement.isAir) continue;

    const distance = Math.hypot(candidate.transform.x - unit.transform.x, candidate.transform.y - unit.transform.y);
    const effectiveDistance = distance - (includeTargetRadius ? candidate.collision.radius : 0);
    if (effectiveDistance < nearestDistance) {
      nearest = candidate;
      nearestDistance = effectiveDistance;
    }
  }

  return nearest;
}

export function findEnemyTower(state: TowerTargetingState, unit: LaneUnit): Tower | null {
  const enemySide = otherSide(unit.side);
  const princess = state.towers.find((tower) =>
    tower.side === enemySide && tower.kind === "princess" && tower.lane === unit.lane && tower.hp > 0
  );
  const king = state.towers.find((tower) =>
    tower.side === enemySide && tower.kind === "king" && tower.hp > 0
  );

  if (!king) return princess ?? null;
  if (!princess) return king;

  const princessDistance = Math.hypot(princess.x - unit.transform.x, princess.y - unit.transform.y);
  const kingDistance = Math.hypot(king.x - unit.transform.x, king.y - unit.transform.y);

  return kingDistance < princessDistance ? king : princess;
}

type TowerTarget = Pick<Unit, "id" | "transform" | "collision">;

export function findTowerTarget(
  tower: Pick<Tower, "side" | "range" | "x" | "y">,
  units: readonly Unit[]
): TowerTarget | null {
  let nearest: TowerTarget | null = null;
  let nearestDistance = tower.range;

  for (const unit of units) {
    if (unit.side === tower.side || unit.health.hp <= 0) continue;
    if (unit.deployment.appearanceDelay > 0) continue;

    const distance = Math.hypot(unit.transform.x - tower.x, unit.transform.y - tower.y)
      - unit.collision.radius;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = unit;
    }
  }

  return nearest;
}

