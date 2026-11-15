import type { TroopCardDefinition } from "./TroopCardDefinition";
import type { BuildingCardDefinition } from "./BuildingCardDefinition";

export type UnitCardDefinition =
  | TroopCardDefinition
  | BuildingCardDefinition;
