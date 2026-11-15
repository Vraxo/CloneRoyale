import type { UnitDefinition } from "../../game/types";

export const ARCHER: UnitDefinition = {
  type: "archer",
  hp: 285,
  damage: 48,
  speed: 48,
  range: 155,
  attackInterval: 1.15,
  radius: 10,
  splashRadius: 0,
  isAir: false,
  targetsBuildingsOnly: false,
  lifetime: 0
};
