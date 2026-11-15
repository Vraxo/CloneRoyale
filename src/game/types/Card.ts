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

interface CardDefinitionBase {
  id: CardId;
  name: string;
  cost: number;
}

export interface TroopCardDefinition extends CardDefinitionBase {
  category: "troop";
  count: number;
  unit: UnitDefinition;
}

export interface BuildingCardDefinition extends CardDefinitionBase {
  category: "building";
  count: number;
  unit: UnitDefinition;
}

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

export type UnitCardDefinition = TroopCardDefinition | BuildingCardDefinition;

export type CardDefinition =
  | TroopCardDefinition
  | BuildingCardDefinition
  | SpellCardDefinition;
