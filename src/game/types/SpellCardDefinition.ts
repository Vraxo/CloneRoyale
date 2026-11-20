import type { AudioEvent } from "./AudioEvent";
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
  audio?: {
    launch?: AudioEvent;
  };
  preview?: {
    style: "arrows";
  };
}
