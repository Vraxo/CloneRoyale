import type { UnitDefinition } from "./UnitDefinition";
import type { CardDefinitionBase } from "./CardDefinitionBase";

export interface BuildingCardDefinition extends CardDefinitionBase {
  category: "building";
  count: number;
  unit: UnitDefinition;
}
