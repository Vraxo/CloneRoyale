import type { CardId } from "./Card";
import type { Lane } from "./Lane";
import type { Side } from "./Side";

export type UnitType =
  | "giant"
  | "archer"
  | "mini-pekka"
  | "baby-dragon"
  | "skeleton"
  | "cannon";

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
  damage: number;
  speed: number;
  range: number;
  attackInterval: number;
  attackCooldown: number;
  splashRadius: number;
  isAir: boolean;
  targetsBuildingsOnly: boolean;
  lifetime: number;
  age: number;
  facing: number;
  animationOffset: number;
  attackAnim: number;
}
