import type { GameState } from "./types";
import { damageTarget } from "./effects";
import { moveUnitTowardTarget, resolveUnitCollisions } from "./movement";
import { updateUnitLifetime } from "./lifetime";
import { updateUnitDeployment } from "./unitDeployment";
import { updateMovementAudio } from "./unitAudio";
import { findEnemyUnit, findEnemyTower } from "./targeting";

import { attackUnit, type PendingMeleeAttack } from "./unitAttacks";

export function updateUnits(state: GameState, dt: number): void {
  const pendingMeleeAttacks: PendingMeleeAttack[] = [];

  for (const unit of state.units) {
    if (unit.health.hp <= 0) continue;

    if (updateUnitDeployment(state, unit, dt)) continue;

    unit.combat.attackCooldown = Math.max(0, unit.combat.attackCooldown - dt);
    unit.presentation.attackAnim = Math.max(0, unit.presentation.attackAnim - dt);

    if (updateUnitLifetime(unit, dt)) continue;

    if (unit.kind === "building") {
      const target = findEnemyUnit(state, unit, unit.combat.range, false, true);
      if (target && unit.combat.attackCooldown <= 0) attackUnit(state, unit, target, pendingMeleeAttacks);
      continue;
    }

    unit.movement.isMoving = false;

    const detectionRange = Math.max(105, unit.combat.range + 65);
    const enemy = findEnemyUnit(state, unit, detectionRange, unit.targeting.targetsBuildingsOnly);

    if (enemy) {
      const distance = Math.hypot(enemy.transform.x - unit.transform.x, enemy.transform.y - unit.transform.y);
      if (distance <= unit.combat.range + enemy.collision.radius) {
        if (unit.combat.attackCooldown <= 0) attackUnit(state, unit, enemy, pendingMeleeAttacks);
      } else {
        moveUnitTowardTarget(state, unit, enemy.transform.x, enemy.transform.y, dt, enemy.id);
      }
      continue;
    }

    const tower = findEnemyTower(state, unit);
    if (!tower) continue;

    const towerDistance = Math.hypot(tower.x - unit.transform.x, tower.y - unit.transform.y);
    if (towerDistance <= unit.combat.range + tower.radius) {
      if (unit.combat.attackCooldown <= 0) attackUnit(state, unit, tower, pendingMeleeAttacks);
    } else {
      moveUnitTowardTarget(state, unit, tower.x, tower.y, dt, tower.id);
    }
  }

  for (const attack of pendingMeleeAttacks) {
    damageTarget(state, attack.targetId, attack.damage);
  }

  for (const unit of state.units) {
    if (unit.health.hp <= 0 || unit.kind === "building") continue;

    updateMovementAudio(unit, state.audioEvents, dt);
  }

  resolveUnitCollisions(state);
}
