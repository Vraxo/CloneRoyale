import type { UnitDefinition, UnitType } from "../types";

export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  giant: {
    type: "giant", hp: 1850, damage: 125, speed: 31, range: 27, attackInterval: 1.55,
    radius: 22, splashRadius: 0, isAir: false, targetsBuildingsOnly: true, lifetime: 0
  },
  archer: {
    type: "archer", hp: 285, damage: 48, speed: 48, range: 155, attackInterval: 1.15,
    radius: 10, splashRadius: 0, isAir: false, targetsBuildingsOnly: false, lifetime: 0
  },
  "mini-pekka": {
    type: "mini-pekka", hp: 900, damage: 245, speed: 55, range: 27, attackInterval: 1.45,
    radius: 14, splashRadius: 0, isAir: false, targetsBuildingsOnly: false, lifetime: 0
  },
  "baby-dragon": {
    type: "baby-dragon", hp: 850, damage: 88, speed: 43, range: 125, attackInterval: 1.4,
    radius: 17, splashRadius: 42, isAir: true, targetsBuildingsOnly: false, lifetime: 0
  },
  skeleton: {
    type: "skeleton", hp: 115, damage: 54, speed: 67, range: 21, attackInterval: 1.05,
    radius: 7, splashRadius: 0, isAir: false, targetsBuildingsOnly: false, lifetime: 0
  },
  cannon: {
    type: "cannon", hp: 1050, damage: 78, speed: 0, range: 185, attackInterval: 1.05,
    radius: 15, splashRadius: 0, isAir: false, targetsBuildingsOnly: false, lifetime: 32
  }
};

export function unitDefinition(type: UnitType): UnitDefinition {
  return UNIT_DEFINITIONS[type];
}
