import type { UnitDefinition } from "../../game/types";
export const MINI_PEKKA: UnitDefinition = {
  type: "mini-pekka", hp: 900, damage: 245, speed: 55, range: 27,
  attackInterval: 1.45, radius: 14, splashRadius: 0, isAir: false,
  targetsBuildingsOnly: false, lifetime: 0
};