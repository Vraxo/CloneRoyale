import type { UnitType } from "./Unit";

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
  unitType?: UnitType;
  spellDamage?: number;
  spellRadius?: number;
}
