import type { CardDefinition } from "../../game/types";

export const FIREBALL_CARD: CardDefinition = {
  id: "fireball",
  name: "Fireball",
  cost: 4,
  category: "spell",
  count: 1,
  spellDamage: 325,
  spellRadius: 92,
  projectileStyle: "fireball",
  projectileDuration: 0.55
};
