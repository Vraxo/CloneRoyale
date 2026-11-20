import type { GameState, Side } from "./types";
import { damageTarget } from "./health";

export function resolveZap(
  state: GameState,
  side: Side,
  x: number,
  y: number,
  damage: number,
  radius: number,
  stunDuration: number
): void {
  for (const unit of state.units) {
    if (unit.side === side || unit.health.hp <= 0 || unit.deployment.appearanceDelay > 0) continue;
    if (Math.hypot(unit.transform.x - x, unit.transform.y - y) > radius + unit.collision.radius) continue;

    damageTarget(state, unit.id, damage);
    if (unit.health.hp > 0) {
      unit.stunRemaining = Math.max(unit.stunRemaining ?? 0, stunDuration);
    }
  }

  for (const tower of state.towers) {
    if (tower.side === side || tower.hp <= 0) continue;
    if (Math.hypot(tower.x - x, tower.y - y) > radius + tower.radius) continue;

    damageTarget(state, tower.id, Math.round(damage * 0.28));
    if (tower.hp > 0) {
      tower.stunRemaining = Math.max(tower.stunRemaining ?? 0, stunDuration);
    }
  }

  state.audioEvents.push("zap-impact");
  state.effects.push({
    id: state.nextId++,
    x,
    y,
    age: 0,
    lifetime: 0.42,
    radius,
    side,
    style: "zap"
  });
}
