import type { SpellCardDefinition } from "../../game/types";

export const ZAP_CARD: SpellCardDefinition = {
  id: "zap",
  name: "Zap",
  cost: 2,
  category: "spell",
  effect: {
    damage: 100,
    radius: 92,
    stunDuration: 0.5
  }
};
