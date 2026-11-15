import type { TroopCardDefinition } from "./TroopCardDefinition";
import type { BuildingCardDefinition } from "./BuildingCardDefinition";
import type { SpellCardDefinition } from "./SpellCardDefinition";

export type CardDefinition =
  | TroopCardDefinition
  | BuildingCardDefinition
  | SpellCardDefinition;
