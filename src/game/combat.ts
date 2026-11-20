import type { GameState, Side, Tower, Unit } from "./types";
import { addProjectile } from "./projectiles";
import { damageTarget } from "./effects";
import { otherSide } from "./state";
import { moveUnitTowardTarget, resolveUnitCollisions } from "./movement";
import { updateUnitLifetime } from "./lifetime";

function positionOf(target: Unit | Tower): { x: number; y: number } {
  return "transform" in target ? target.transform : target;
}

type TargetingUnit = Pick<Unit, "side" | "transform" | "targeting">;
type LaneUnit = Pick<Unit, "side" | "lane" | "transform">;

function findEnemyUnit(
  state: GameState,
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

function enemyTowerFor(state: GameState, unit: LaneUnit): Tower | null {
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

type TowerTarget = Pick<Unit, "id" | "side" | "health" | "deployment" | "transform" | "collision">;

function findTowerTarget(
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

type PendingMeleeAttack = { unit: Unit; target: Unit | Tower };

function attackUnit(
  state: GameState,
  unit: Unit,
  target: Unit | Tower,
  pendingMeleeAttacks: PendingMeleeAttack[]
): void {
  unit.combat.attackCooldown = unit.combat.attackInterval;
  unit.presentation.attackAnim = 0.32;
  if (unit.audio?.attack) state.audioEvents.push(unit.audio?.attack);

  if (unit.combat.attack.type === "melee") {
    pendingMeleeAttacks.push({ unit, target });
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

export function updateUnits(state: GameState, dt: number): void {
  const pendingMeleeAttacks: PendingMeleeAttack[] = [];

  for (const unit of state.units) {
    if (unit.health.hp <= 0) continue;

    const appearanceDelay = unit.deployment.appearanceDelay;
    if (appearanceDelay > 0) {
      const remaining = Math.max(0, appearanceDelay - dt);
      unit.deployment.appearanceDelay = remaining;
      if (remaining > 0) continue;

      if (unit.audio?.deploy) state.audioEvents.push(unit.audio?.deploy);

      state.effects.push({
        id: state.nextId++,
        x: unit.transform.x,
        y: unit.transform.y,
        age: 0,
        lifetime: 0.62,
        radius: Math.max(22, unit.collision.radius * 2.2),
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

    const tower = enemyTowerFor(state, unit);
    if (!tower) continue;

    const towerDistance = Math.hypot(tower.x - unit.transform.x, tower.y - unit.transform.y);
    if (towerDistance <= unit.combat.range + tower.radius) {
      if (unit.combat.attackCooldown <= 0) attackUnit(state, unit, tower, pendingMeleeAttacks);
    } else {
      moveUnitTowardTarget(state, unit, tower.x, tower.y, dt, tower.id);
    }
  }

  for (const attack of pendingMeleeAttacks) {
    damageTarget(state, attack.target.id, attack.unit.combat.damage);
  }

  for (const unit of state.units) {
    if (unit.health.hp <= 0 || unit.kind === "building") continue;

    const movementSound = unit.audio?.movement;
    if (!movementSound) continue;

    if (unit.movement.isMoving) {
      unit.movement.footstepCooldown = (unit.movement.footstepCooldown ?? 0) - dt;
      if (unit.movement.footstepCooldown <= 0) {
        state.audioEvents.push(movementSound.event);
        unit.movement.footstepCooldown = movementSound.interval;
      }
    } else {
      unit.movement.footstepCooldown = Math.min(unit.movement.footstepCooldown ?? 0.12, 0.12);
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

    const target = findTowerTarget(tower, state.units);
    if (!target) continue;

    const nearestDistance = Math.hypot(target.transform.x - tower.x, target.transform.y - tower.y)
      - target.collision.radius;

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
      target.transform.x,
      target.transform.y,
      tower.damage,
      0,
      "arrow",
      nearestDistance / 480
    );
  }
}
