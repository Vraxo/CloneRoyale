import type { UnitDefinition } from "./UnitDefinition";
import type { CardDefinitionBase } from "./CardDefinitionBase";

export interface TroopCardDefinition extends CardDefinitionBase {
  category: "troop";
  count: number;
  unit: UnitDefinition;
}
