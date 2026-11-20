import type { GameState } from "./types";
import { addEvent } from "./state";

export function damageTarget(state: GameState, targetId: number, damage: number): void {
  const unit = state.units.find((candidate) => candidate.id === targetId);
  if (unit) {
    const wasAlive = unit.health.hp > 0;
    unit.health.hp -= damage;
    if (wasAlive && unit.health.hp <= 0) {
      if (unit.audio.death) state.audioEvents.push(unit.audio.death);
    }
    unit.presentation.attackAnim = Math.max(unit.presentation.attackAnim, 0.09);
    state.effects.push({
      id: state.nextId++,
      x: unit.transform.x,
      y: unit.transform.y,
      age: 0,
      lifetime: 0.22,
      radius: 9,
      style: "hit"
    });
    return;
  }

  const tower = state.towers.find((candidate) => candidate.id === targetId);
  if (!tower || tower.hp <= 0) return;

  tower.hp = Math.max(0, tower.hp - damage);

  if (tower.kind === "king" && !tower.activated) {
    tower.activated = true;
    state.audioEvents.push("king-activation");
  }

  if (tower.hp === 0) {
    addEvent(state, `${tower.side === "blue" ? "Blue" : "Red"} ${tower.kind} tower destroyed!`);

    if (tower.kind === "princess") {
      state.audioEvents.push("tower-destroyed", "crown-earned");
      const king = state.towers.find((candidate) =>
        candidate.side === tower.side && candidate.kind === "king"
      );
      if (king && !king.activated) {
        king.activated = true;
        state.audioEvents.push("king-activation");
      }
    } else {
      state.audioEvents.push("king-tower-destroyed");
    }
  }
}

const ARROWS_VOLLEY_TIMES = [0, 0.18, 0.36] as const;

export function updateEffects(state: GameState, dt: number): void {
  for (const effect of state.effects) {
    const previousAge = effect.age;
    effect.age += dt;

    if (effect.style !== "arrows") continue;

    for (const volleyTime of ARROWS_VOLLEY_TIMES) {
      if (previousAge <= volleyTime && effect.age > volleyTime) {
        state.audioEvents.push("arrows-impact");
      }
    }
  }

  state.effects = state.effects.filter((effect) => effect.age < effect.lifetime);
}
