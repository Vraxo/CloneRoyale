import type { GameState } from "./types";
import { addEvent } from "./state";

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
