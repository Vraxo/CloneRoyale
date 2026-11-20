import type { CardId } from "./CardId";
import type { Lane } from "./Lane";
import type { Side } from "./Side";
import type { UnitAttack } from "./UnitAttack";
import type { AudioEvent } from "./AudioEvent";

export type UnitType =
  | "giant"
  | "archer"
  | "mini-pekka"
  | "baby-dragon"
  | "skeleton"
  | "cannon"
  | "knight";

export interface UnitIdentity {
  id: number;
  side: Side;
  cardId: CardId;
  type: UnitType;
  lane: Lane;
}

export interface UnitTransform {
  x: number;
  y: number;
  facing: number;
}

export interface UnitHealth {
  hp: number;
  maxHp: number;
}

export interface UnitCollision {
  radius: number;
  mass?: number;
}

export interface UnitMovement {
  speed: number;
  isAir: boolean;
  formationSlot?: -1 | 1;
  isMoving?: boolean;
  footstepCooldown?: number;
}

export interface UnitCombat {
  damage: number;
  range: number;
  attackInterval: number;
  attackCooldown: number;
  attack: UnitAttack;
  splashRadius: number;
}

export interface UnitTargeting {
  canTargetAir: boolean;
  targetsBuildingsOnly: boolean;
}

export interface UnitLifetime {
  duration: number;
  elapsed: number;
}

export interface UnitDeployment {
  appearanceDelay: number;
  duration: number;
  remaining: number;
}

export interface UnitAudio {
  attack?: AudioEvent;
  hit?: AudioEvent;
  deploy?: AudioEvent;
  death?: AudioEvent;
  movement?: { event: AudioEvent; interval: number };
}

export interface UnitPresentation {
  animationOffset: number;
  attackAnim: number;
}

interface UnitBase extends UnitIdentity {
  transform: UnitTransform;
  combat: UnitCombat;
  lifetime?: UnitLifetime;
  targeting: UnitTargeting;
  collision: UnitCollision;
  health: UnitHealth;
  deployment: UnitDeployment;
  stunRemaining?: number;
  audio?: UnitAudio;
  presentation: UnitPresentation;
}

export interface TroopUnit extends UnitBase {
  kind: "troop";
  movement: UnitMovement;
}

export interface BuildingUnit extends UnitBase {
  kind: "building";
  movement?: never;
}

export type Unit = TroopUnit | BuildingUnit;
