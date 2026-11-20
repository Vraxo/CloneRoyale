import type { GameState, Tower, Unit } from "./types";
import { addProjectile } from "./projectiles";

type AttackTarget = Pick<Unit, "id" | "transform"> | Pick<Tower, "id" | "x" | "y">;
type AttackingUnit = Pick<Unit, "side" | "transform" | "combat" | "presentation" | "audio">;

function positionOf(target: AttackTarget): { x: number; y: number } {
  return "transform" in target ? target.transform : target;
}

type PendingMeleeAttack = { targetId: number; damage: number };

export function attackUnit(
  state: GameState,
  unit: AttackingUnit,
  target: AttackTarget,
  pendingMeleeAttacks: PendingMeleeAttack[]
): void {
  unit.combat.attackCooldown = unit.combat.attackInterval;
  unit.presentation.attackAnim = 0.32;
  if (unit.audio?.attack) state.audioEvents.push(unit.audio?.attack);

  if (unit.combat.attack.type === "melee") {
    pendingMeleeAttacks.push({ targetId: target.id, damage: unit.combat.damage });
    if (unit.audio?.hit) state.audioEvents.push(unit.audio?.hit);
    return;
  }

  const targetPosition = positionOf(target);
  const distance = Math.hypot(targetPosition.x - unit.transform.x, targetPosition.y - unit.transform.y);
  addProjectile(
    state,
    unit.side,
    unit.transform.x,
    unit.transform.y,
    target.id,
    targetPosition.x,
    targetPosition.y,
    unit.combat.damage,
    unit.combat.splashRadius,
    unit.combat.attack.style,
    distance / unit.combat.attack.speed
  );
}

