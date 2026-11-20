import type { GameState, Side, Tower, Unit } from "./types";
import { addProjectile } from "./projectiles";
import { damageTarget } from "./effects";
import { otherSide } from "./state";
import { moveUnitTowardTarget, resolveUnitCollisions } from "./movement";

function findEnemyUnit(
  state: GameState,
  unit: Unit,
  detectionRange: number,
  buildingsOnly = false,
  includeTargetRadius = false
): Unit | null {
  let nearest: Unit | null = null;
  let nearestDistance = detectionRange;

  for (const candidate of state.units) {
    if (candidate.side === unit.side || candidate.hp <= 0) continue;
    if ((candidate.deployment.appearanceDelay) > 0) continue;
    if (buildingsOnly && candidate.kind !== "building") continue;
    if (!unit.canTargetAir && candidate.isAir) continue;

    const distance = Math.hypot(candidate.x - unit.x, candidate.y - unit.y);
    const effectiveDistance = distance - (includeTargetRadius ? candidate.radius : 0);
    if (effectiveDistance < nearestDistance) {
      nearest = candidate;
      nearestDistance = effectiveDistance;
    }
  }

  return nearest;
}

function enemyTowerFor(state: GameState, unit: Unit): Tower | null {
  const enemySide = otherSide(unit.side);
  const princess = state.towers.find((tower) =>
    tower.side === enemySide && tower.kind === "princess" && tower.lane === unit.lane && tower.hp > 0
  );
  const king = state.towers.find((tower) =>
    tower.side === enemySide && tower.kind === "king" && tower.hp > 0
  );

  if (!king) return princess ?? null;
  if (!princess) return king;

  const princessDistance = Math.hypot(princess.x - unit.x, princess.y - unit.y);
  const kingDistance = Math.hypot(king.x - unit.x, king.y - unit.y);

  return kingDistance < princessDistance ? king : princess;
}

type PendingMeleeAttack = { unit: Unit; target: Unit | Tower };

function attackUnit(
  state: GameState,
  unit: Unit,
  target: Unit | Tower,
  pendingMeleeAttacks: PendingMeleeAttack[]
): void {
  unit.attackCooldown = unit.attackInterval;
  unit.presentation.attackAnim = 0.32;
  if (unit.type === "mini-pekka") state.audioEvents.push("mini-pekka-attack");
  if (unit.type === "giant") state.audioEvents.push("giant-attack");
  if (unit.type === "skeleton") state.audioEvents.push("skeleton-attack");
  if (unit.type === "cannon") state.audioEvents.push("cannon-attack");
  if (unit.type === "archer") state.audioEvents.push("archer-attack");
  if (unit.type === "baby-dragon") state.audioEvents.push("baby-dragon-attack");

  if (unit.attack.type === "melee") {
    pendingMeleeAttacks.push({ unit, target });
    if (unit.type === "mini-pekka") state.audioEvents.push("mini-pekka-hit");
    if (unit.type === "giant") state.audioEvents.push("giant-hit");
    if (unit.type === "skeleton") state.audioEvents.push("skeleton-hit");
    return;
  }

  const distance = Math.hypot(target.x - unit.x, target.y - unit.y);
  addProjectile(
    state,
    unit.side,
    unit.x,
    unit.y,
    target.id,
    target.x,
    target.y,
    unit.damage,
    unit.splashRadius,
    unit.attack.style,
    distance / unit.attack.speed
  );
}

export function updateUnits(state: GameState, dt: number): void {
  const pendingMeleeAttacks: PendingMeleeAttack[] = [];

  for (const unit of state.units) {
    if (unit.hp <= 0) continue;

    const appearanceDelay = unit.deployment.appearanceDelay;
    if (appearanceDelay > 0) {
      const remaining = Math.max(0, appearanceDelay - dt);
      unit.deployment.appearanceDelay = remaining;
      if (remaining > 0) continue;

      if (unit.type === "mini-pekka") state.audioEvents.push("mini-pekka-deploy");
      if (unit.type === "giant") state.audioEvents.push("giant-deploy");
      if (unit.type === "skeleton") state.audioEvents.push("skeleton-deploy");
      if (unit.type === "cannon") state.audioEvents.push("cannon-deploy");
      if (unit.type === "archer") state.audioEvents.push("archer-deploy");
      if (unit.type === "baby-dragon") state.audioEvents.push("baby-dragon-deploy");

      state.effects.push({
        id: state.nextId++,
        x: unit.x,
        y: unit.y,
        age: 0,
        lifetime: 0.62,
        radius: Math.max(22, unit.radius * 2.2),
        style: "deployment",
        side: unit.side
      });

      continue;
    }

    const deploymentRemaining = unit.deployment.remaining;
    if (deploymentRemaining > 0) {
      unit.deployment.remaining = Math.max(0, deploymentRemaining - dt);
      continue;
    }

    unit.isMoving = false;
    unit.age += dt;
    unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
    unit.presentation.attackAnim = Math.max(0, unit.presentation.attackAnim - dt);

    if (unit.lifetime > 0 && unit.age >= unit.lifetime) {
      unit.hp = 0;
      continue;
    }

    if (unit.kind === "building") {
      const target = findEnemyUnit(state, unit, unit.range, false, true);
      if (target && unit.attackCooldown <= 0) attackUnit(state, unit, target, pendingMeleeAttacks);
      continue;
    }

    const detectionRange = Math.max(105, unit.range + 65);
    const enemy = findEnemyUnit(state, unit, detectionRange, unit.targetsBuildingsOnly);

    if (enemy) {
      const distance = Math.hypot(enemy.x - unit.x, enemy.y - unit.y);
      if (distance <= unit.range + enemy.radius) {
        if (unit.attackCooldown <= 0) attackUnit(state, unit, enemy, pendingMeleeAttacks);
      } else {
        moveUnitTowardTarget(state, unit, enemy.x, enemy.y, dt, enemy.id);
      }
      continue;
    }

    const tower = enemyTowerFor(state, unit);
    if (!tower) continue;

    const towerDistance = Math.hypot(tower.x - unit.x, tower.y - unit.y);
    if (towerDistance <= unit.range + tower.radius) {
      if (unit.attackCooldown <= 0) attackUnit(state, unit, tower, pendingMeleeAttacks);
    } else {
      moveUnitTowardTarget(state, unit, tower.x, tower.y, dt, tower.id);
    }
  }

  for (const attack of pendingMeleeAttacks) {
    damageTarget(state, attack.target.id, attack.unit.damage);
  }

  for (const unit of state.units) {
    if (unit.hp <= 0) continue;

    const hasMovementSound = unit.type === "mini-pekka"
      || unit.type === "giant"
      || unit.type === "skeleton"
      || unit.type === "archer"
      || unit.type === "baby-dragon";
    if (!hasMovementSound) continue;

    const stepInterval = unit.type === "giant"
      ? 0.62
      : unit.type === "skeleton" ? 0.5
        : unit.type === "baby-dragon" ? 0.58
          : unit.type === "archer" ? 0.48 : 0.42;
    const stepEvent = unit.type === "giant"
      ? "giant-step"
      : unit.type === "skeleton" ? "skeleton-step"
        : unit.type === "baby-dragon" ? "baby-dragon-wing"
          : unit.type === "archer" ? "archer-step" : "mini-pekka-step";

    if (unit.isMoving) {
      unit.footstepCooldown = (unit.footstepCooldown ?? 0) - dt;
      if (unit.footstepCooldown <= 0) {
        state.audioEvents.push(stepEvent);
        unit.footstepCooldown = stepInterval;
      }
    } else {
      unit.footstepCooldown = Math.min(unit.footstepCooldown ?? 0.12, 0.12);
    }
  }

  resolveUnitCollisions(state);
}

export function updateTowers(state: GameState, dt: number): void {
  for (const tower of state.towers) {
    if (tower.hp <= 0) continue;

    if (tower.kind === "king") {
      const princessDestroyed = state.towers.some((candidate) =>
        candidate.side === tower.side
        && candidate.kind === "princess"
        && candidate.hp <= 0
      );
      const kingDamaged = tower.hp < tower.maxHp;

      if (!princessDestroyed && !kingDamaged) continue;
    }

    tower.attackCooldown = Math.max(0, tower.attackCooldown - dt);
    if (tower.attackCooldown > 0) continue;

    let target: Unit | null = null;
    let nearestDistance = tower.range;

    for (const unit of state.units) {
      if (unit.side === tower.side || unit.hp <= 0) continue;
      if ((unit.deployment.appearanceDelay) > 0) continue;

      const distance = Math.hypot(unit.x - tower.x, unit.y - tower.y) - unit.radius;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        target = unit;
      }
    }

    if (!target) continue;

    tower.attackCooldown = tower.attackInterval;
    state.audioEvents.push(
      tower.kind === "king" ? "king-tower-attack" : "princess-tower-attack"
    );
    addProjectile(
      state,
      tower.side,
      tower.x,
      tower.y,
      target.id,
      target.x,
      target.y,
      tower.damage,
      0,
      "arrow",
      nearestDistance / 480
    );
  }
}
