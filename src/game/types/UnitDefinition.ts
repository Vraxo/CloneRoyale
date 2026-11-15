import type { UnitType } from "./Unit";

export interface UnitDefinition {
  type: UnitType;
  hp: number;
  damage: number;
  speed: number;
  range: number;
  attackInterval: number;
  radius: number;
  splashRadius: number;
  isAir: boolean;
  targetsBuildingsOnly: boolean;
  lifetime: number;
}
