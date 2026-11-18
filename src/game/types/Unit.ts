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

export interface Unit {
  id: number;
  side: Side;
  cardId: CardId;
  type: UnitType;
  kind: "troop" | "building";
  lane: Lane;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  collisionMass?: number;
  formationSlot?: -1 | 1;
  damage: number;
  speed: number;
  range: number;
  attackInterval: number;
  attackCooldown: number;
  attack: UnitAttack;
  splashRadius: number;
  isAir: boolean;
  canTargetAir: boolean;
  targetsBuildingsOnly: boolean;
  lifetime: number;
  age: number;
  appearanceDelayRemaining?: number;
  deploymentDuration?: number;
  deploymentRemaining?: number;
  isMoving?: boolean;
  facing: number;
  animationOffset: number;
  attackAnim: number;
  footstepCooldown?: number;
}
