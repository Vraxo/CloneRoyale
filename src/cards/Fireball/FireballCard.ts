import type { SpellCardDefinition } from "../../game/types";

export const FIREBALL_CARD: SpellCardDefinition = {
  id: "fireball",
  name: "Fireball",
  cost: 4,
  category: "spell",
  effect: {
    damage: 325,
    radius: 92,
    projectile: {
      style: "fireball",
      duration: 0.55
    }
  }
};
