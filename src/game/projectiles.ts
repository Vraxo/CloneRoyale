import type { GameState, Projectile, Side } from "./types";
import { damageTarget } from "./effects";

export function addProjectile(
  state: GameState,
  side: Side,
  x: number,
  y: number,
  targetId: number | null,
  targetX: number,
  targetY: number,
  damage: number,
  splashRadius: number,
  style: Projectile["style"],
  duration: number
): void {
  state.projectiles.push({
    id: state.nextId++,
    side,
    x,
    y,
    startX: x,
    startY: y,
    targetId,
    targetX,
    targetY,
    age: 0,
    duration: Math.max(0.12, duration),
    damage,
    splashRadius,
    style
  });
}

function applySplash(state: GameState, projectile: Projectile, x: number, y: number): void {
  const spell = projectile.style === "fireball" || projectile.style === "arrows";

  for (const unit of state.units) {
    if (unit.side === projectile.side || unit.hp <= 0) continue;
    if ((unit.appearanceDelayRemaining ?? 0) > 0) continue;
    if (Math.hypot(unit.x - x, unit.y - y) <= projectile.splashRadius + unit.radius) {
      damageTarget(state, unit.id, projectile.damage);
    }
  }

  for (const tower of state.towers) {
    if (tower.side === projectile.side || tower.hp <= 0) continue;
    if (Math.hypot(tower.x - x, tower.y - y) <= projectile.splashRadius + tower.radius) {
      damageTarget(state, tower.id, spell ? Math.round(projectile.damage * 0.28) : projectile.damage);
    }
  }
}

export function updateProjectiles(state: GameState, dt: number): void {
  for (let index = state.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = state.projectiles[index];
    projectile.age += dt;

    const progress = Math.min(1, projectile.age / projectile.duration);
    projectile.x = projectile.startX + (projectile.targetX - projectile.startX) * progress;
    projectile.y = projectile.startY + (projectile.targetY - projectile.startY) * progress;

    if (progress < 1) continue;

    if (projectile.splashRadius > 0) {
      if (projectile.style === "arrows") state.audioEvents.push("arrows-impact");
      if (projectile.style === "fireball") state.audioEvents.push("fireball-explosion");
      applySplash(state, projectile, projectile.targetX, projectile.targetY);
      state.effects.push({
        id: state.nextId++,
        x: projectile.targetX,
        y: projectile.targetY,
        age: 0,
        lifetime: projectile.style === "arrows" ? 0.38 : 0.48,
        radius: projectile.splashRadius,
        style: projectile.style === "arrows" ? "arrows" : "explosion"
      });
    } else if (projectile.targetId !== null) {
      const unitTarget = state.units.find((unit) => unit.id === projectile.targetId);
      const towerTarget = state.towers.find((tower) => tower.id === projectile.targetId);

      if (unitTarget && unitTarget.hp > projectile.damage) {
        state.audioEvents.push("projectile-impact");
      } else if (towerTarget && towerTarget.hp > projectile.damage) {
        state.audioEvents.push("tower-hit");
      }

      damageTarget(state, projectile.targetId, projectile.damage);
    }

    state.projectiles.splice(index, 1);
  }
}
