import type { CardId } from "./CardId";
import type { Lane } from "./Lane";
import type { Side } from "./Side";
import type { UnitAttack } from "./UnitAttack";

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
  kind: "troop" | "building";
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
  collisionMass?: number;
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
  lifetime: number;
  age: number;
}

export interface UnitDeployment {
  appearanceDelay: number;
  duration: number;
  remaining: number;
}

export interface UnitPresentation {
  animationOffset: number;
  attackAnim: number;
}

export interface Unit
  extends UnitIdentity,
    UnitTransform,
    UnitCollision,
    UnitMovement,
    UnitCombat,
    UnitTargeting,
    UnitLifetime {
  health: UnitHealth;
  deployment: UnitDeployment;
  presentation: UnitPresentation;
}
