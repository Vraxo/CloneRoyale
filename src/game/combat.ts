import type { GameState, Side, Tower, Unit } from "./types";
import { addProjectile } from "./projectiles";
import { damageTarget } from "./effects";
import { FIELD_HEIGHT, FIELD_WIDTH, otherSide } from "./state";

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
  unit.isMoving = true;
  const amount = Math.min(distance, unit.speed * dt);
  unit.x += (dx / distance) * amount;
  unit.y += (dy / distance) * amount;
}

function separateUnits(units: Unit[]): void {
  for (let iteration = 0; iteration < 3; iteration += 1) {
    for (let firstIndex = 0; firstIndex < units.length; firstIndex += 1) {
      const first = units[firstIndex];
      if (first.hp <= 0) continue;

      for (let secondIndex = firstIndex + 1; secondIndex < units.length; secondIndex += 1) {
        const second = units[secondIndex];
        if (second.hp <= 0 || first.isAir !== second.isAir) continue;

        const firstDeploying = (first.deploymentRemaining ?? 0) > 0;
        const secondDeploying = (second.deploymentRemaining ?? 0) > 0;
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function attackUnit(state: GameState, unit: Unit, target: Unit | Tower): void {
  unit.attackCooldown = unit.attackInterval;
  unit.attackAnim = 0.32;
  if (unit.type === "mini-pekka") state.audioEvents.push("mini-pekka-attack");

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
      const remaining = Math.max(0, deploymentRemaining - dt);
      unit.deploymentRemaining = remaining;
      if (remaining === 0 && unit.type === "mini-pekka") {
        state.audioEvents.push("mini-pekka-deploy");
      }
      continue;
    }

    unit.isMoving = false;
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

  for (const unit of state.units) {
    if (unit.type !== "mini-pekka" || unit.hp <= 0) continue;

    if (unit.isMoving) {
      unit.footstepCooldown = (unit.footstepCooldown ?? 0) - dt;
      if (unit.footstepCooldown <= 0) {
        state.audioEvents.push("mini-pekka-step");
        unit.footstepCooldown = 0.42;
      }
    } else {
      unit.footstepCooldown = Math.min(unit.footstepCooldown ?? 0.12, 0.12);
    }
  }

  separateUnits(state.units);
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
      if ((unit.deploymentRemaining ?? 0) > 0) continue;

      const distance = Math.hypot(unit.x - tower.x, unit.y - tower.y);
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
