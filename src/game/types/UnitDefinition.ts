import type { UnitAttack } from "./UnitAttack";
import type { UnitType } from "./Unit";

export interface UnitDefinition {
  type: UnitType;
  hp: number;
  damage: number;
  speed: number;
  range: number;
  attackInterval: number;
  attack: UnitAttack;
  radius: number;
  collisionMass?: number;
  splashRadius: number;
  isAir: boolean;
  canTargetAir: boolean;
  targetsBuildingsOnly: boolean;
  lifetime: number;
}
