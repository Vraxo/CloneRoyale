import type { UnitType } from "./Unit";
import type { UnitAttack } from "./UnitAttack";

export interface UnitIdentityDefinition {
  type: UnitType;
}

export interface UnitHealthDefinition {
  hp: number;
}

export interface UnitCollisionDefinition {
  radius: number;
  collisionMass?: number;
}

export interface UnitMovementDefinition {
  speed: number;
  isAir: boolean;
}

export interface UnitCombatDefinition {
  damage: number;
  range: number;
  attackInterval: number;
  attack: UnitAttack;
  splashRadius: number;
}

export interface UnitTargetingDefinition {
  canTargetAir: boolean;
  targetsBuildingsOnly: boolean;
}

export interface UnitLifetimeDefinition {
  lifetime: number;
}

export interface UnitDefinition
  extends UnitIdentityDefinition,
    UnitHealthDefinition,
    UnitCollisionDefinition,
    UnitMovementDefinition,
    UnitCombatDefinition,
    UnitTargetingDefinition,
    UnitLifetimeDefinition {}
