import type { UnitDefinition } from "../../game/types";
export const SKELETON: UnitDefinition = {
  type: "skeleton", hp: 115, damage: 54, speed: 67, range: 21,
  attackInterval: 1.05, radius: 7, splashRadius: 0, isAir: false,
  targetsBuildingsOnly: false, lifetime: 0
};