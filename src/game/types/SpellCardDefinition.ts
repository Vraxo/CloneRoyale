import type { CardDefinitionBase } from "./CardDefinitionBase";

export interface SpellCardDefinition extends CardDefinitionBase {
  category: "spell";
  effect: {
    damage: number;
    radius: number;
    projectile: {
      style: "fireball" | "arrows";
      duration: number;
    };
  };
}
