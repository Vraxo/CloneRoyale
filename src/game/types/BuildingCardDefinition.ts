import type { StationaryUnitDefinition } from "./UnitDefinition";
import type { CardDefinitionBase } from "./CardDefinitionBase";

export interface BuildingCardDefinition extends CardDefinitionBase {
  category: "building";
  count: number;
  unit: StationaryUnitDefinition;
}
