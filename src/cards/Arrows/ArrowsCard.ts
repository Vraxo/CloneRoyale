import type { SpellCardDefinition } from "../../game/types";

export const ARROWS_CARD: SpellCardDefinition = {
  id: "arrows",
  name: "Arrows",
  cost: 3,
  category: "spell",
  effect: {
    damage: 132,
    radius: 132,
    projectile: {
      style: "arrows",
      duration: 0.36
    }
  }
};
