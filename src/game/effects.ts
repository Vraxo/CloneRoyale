import type { GameState } from "./types";
import { addEvent } from "./state";

export function damageTarget(state: GameState, targetId: number, damage: number): void {
  const unit = state.units.find((candidate) => candidate.id === targetId);
  if (unit) {
    unit.hp -= damage;
    unit.attackAnim = Math.max(unit.attackAnim, 0.09);
    state.effects.push({
      id: state.nextId++,
      x: unit.x,
      y: unit.y,
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
  if (tower.hp === 0) {
    addEvent(state, `${tower.side === "blue" ? "Blue" : "Red"} ${tower.kind} tower destroyed!`);
  }
}

export function updateEffects(state: GameState, dt: number): void {
  for (const effect of state.effects) effect.age += dt;
  state.effects = state.effects.filter((effect) => effect.age < effect.lifetime);
}
