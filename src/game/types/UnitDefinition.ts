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

export interface UnitFormationDefinition {
  pattern: "paired";
}

interface UnitDefinitionBase {
  identity: UnitIdentityDefinition;
  health: UnitHealthDefinition;
  collision: UnitCollisionDefinition;
  combat: UnitCombatDefinition;
  targeting: UnitTargetingDefinition;
  lifetime?: UnitLifetimeDefinition;
  audio: UnitAudio;
  formation?: UnitFormationDefinition;
}

export interface MovableUnitDefinition extends UnitDefinitionBase {
  movement: UnitMovementDefinition;
}

export interface StationaryUnitDefinition extends UnitDefinitionBase {
  movement?: never;
}

export type UnitDefinition = MovableUnitDefinition | StationaryUnitDefinition;
