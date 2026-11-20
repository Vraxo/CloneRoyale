import type { GameState } from "./types";
import { addProjectile } from "./projectiles";
import { findTowerTarget } from "./targeting";

export function updateTowers(state: GameState, dt: number): void {
  for (const tower of state.towers) {
    if (tower.hp <= 0) continue;

    if ((tower.stunRemaining ?? 0) > 0) {
      tower.stunRemaining = Math.max(0, (tower.stunRemaining ?? 0) - dt);
      continue;
    }

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
