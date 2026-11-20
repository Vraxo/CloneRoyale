import type { UnitType } from "./Unit";
import type { UnitAttack } from "./UnitAttack";
import type { UnitAudio } from "./Unit";

export interface UnitIdentityDefinition {
  type: UnitType;
}

export interface UnitHealthDefinition {
  hp: number;
}

export interface UnitCollisionDefinition {
  radius: number;
  mass?: number;
}

export interface UnitMovementDefinition {
  speed: number;
  isAir: boolean;
  formationSlots?: readonly (-1 | 1)[];
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
  duration: number;
}

export interface UnitDefinition {
  identity: UnitIdentityDefinition;
  health: UnitHealthDefinition;
  collision: UnitCollisionDefinition;
  movement: UnitMovementDefinition;
  combat: UnitCombatDefinition;
  targeting: UnitTargetingDefinition;
  lifetime: UnitLifetimeDefinition;
  audio: UnitAudio;
}
