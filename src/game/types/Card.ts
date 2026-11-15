import type { UnitDefinition } from "./UnitDefinition";

export type CardId =
  | "giant"
  | "archers"
  | "mini-pekka"
  | "baby-dragon"
  | "skeleton-army"
  | "cannon"
  | "fireball"
  | "arrows";

export interface CardDefinition {
  id: CardId;
  name: string;
  cost: number;
  category: "troop" | "building" | "spell";
  count: number;
  unit?: UnitDefinition;
  spellDamage?: number;
  spellRadius?: number;
  projectileStyle?: "fireball" | "arrows";
  projectileDuration?: number;
}
