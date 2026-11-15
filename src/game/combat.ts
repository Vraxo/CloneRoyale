import type { GameState, Side, Tower, Unit } from "./types";
import { addProjectile } from "./projectiles";
import { damageTarget } from "./effects";
import { otherSide } from "./state";

function findEnemyUnit(
  state: GameState,
  unit: Unit,
  detectionRange: number,
  buildingsOnly = false
): Unit | null {
  let nearest: Unit | null = null;
  let nearestDistance = detectionRange;

  for (const candidate of state.units) {
    if (candidate.side === unit.side || candidate.hp <= 0) continue;
    if ((candidate.deploymentRemaining ?? 0) > 0) continue;
    if (buildingsOnly && candidate.kind !== "building") continue;
    if (!unit.canTargetAir && candidate.isAir) continue;

    const distance = Math.hypot(candidate.x - unit.x, candidate.y - unit.y);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function enemyTowerFor(state: GameState, unit: Unit): Tower | null {
  const enemySide = otherSide(unit.side);
  const princess = state.towers.find((tower) =>
    tower.side === enemySide && tower.kind === "princess" && tower.lane === unit.lane && tower.hp > 0
  );
  if (princess) return princess;

  return state.towers.find((tower) => tower.side === enemySide && tower.kind === "king" && tower.hp > 0) ?? null;
}

function moveToward(unit: Unit, x: number, y: number, dt: number): void {
  const dx = x - unit.x;
  const dy = y - unit.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001 || unit.speed <= 0) return;

  unit.facing = Math.atan2(dy, dx);
  const amount = Math.min(distance, unit.speed * dt);
  unit.x += (dx / distance) * amount;
  unit.y += (dy / distance) * amount;
}

function attackUnit(state: GameState, unit: Unit, target: Unit | Tower): void {
  unit.attackCooldown = unit.attackInterval;
  unit.attackAnim = 0.32;

  if (unit.attack.type === "melee") {
    damageTarget(state, target.id, unit.damage);
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
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;

    const deploymentRemaining = unit.deploymentRemaining ?? 0;
    if (deploymentRemaining > 0) {
      unit.deploymentRemaining = Math.max(0, deploymentRemaining - dt);
      continue;
    }

    unit.age += dt;
    unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
    unit.attackAnim = Math.max(0, unit.attackAnim - dt);

    if (unit.lifetime > 0 && unit.age >= unit.lifetime) {
      unit.hp = 0;
      continue;
    }

    if (unit.kind === "building") {
      const target = findEnemyUnit(state, unit, unit.range);
      if (target && unit.attackCooldown <= 0) attackUnit(state, unit, target);
      continue;
    }

    const detectionRange = Math.max(105, unit.range + 65);
    const enemy = findEnemyUnit(state, unit, detectionRange, unit.targetsBuildingsOnly);

    if (enemy) {
      const distance = Math.hypot(enemy.x - unit.x, enemy.y - unit.y);
      if (distance <= unit.range + enemy.radius) {
        if (unit.attackCooldown <= 0) attackUnit(state, unit, enemy);
      } else {
        moveToward(unit, enemy.x, enemy.y, dt);
      }
      continue;
    }

    const tower = enemyTowerFor(state, unit);
    if (!tower) continue;

    const towerDistance = Math.hypot(tower.x - unit.x, tower.y - unit.y);
    if (towerDistance <= unit.range + tower.radius) {
      if (unit.attackCooldown <= 0) attackUnit(state, unit, tower);
    } else {
      moveToward(unit, tower.x, tower.y, dt);
    }
  }
}

export function updateTowers(state: GameState, dt: number): void {
  for (const tower of state.towers) {
    if (tower.hp <= 0) continue;

    tower.attackCooldown = Math.max(0, tower.attackCooldown - dt);
    if (tower.attackCooldown > 0) continue;

    let target: Unit | null = null;
    let nearestDistance = tower.range;

    for (const unit of state.units) {
      if (unit.side === tower.side || unit.hp <= 0) continue;
      if ((unit.deploymentRemaining ?? 0) > 0) continue;

      const distance = Math.hypot(unit.x - tower.x, unit.y - tower.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        target = unit;
      }
    }

    if (!target) continue;

    tower.attackCooldown = tower.attackInterval;
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
