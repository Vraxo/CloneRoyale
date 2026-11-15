export type Side = "blue" | "red";
export type Lane = "left" | "right";
export type CardId = "giant" | "archers" | "mini-pekka" | "baby-dragon" | "skeleton-army" | "cannon" | "fireball" | "arrows";
export type UnitType = "giant" | "archer" | "mini-pekka" | "baby-dragon" | "skeleton" | "cannon";

export interface CardDefinition {
  id: CardId;
  name: string;
  cost: number;
  category: "troop" | "building" | "spell";
  count: number;
  unitType?: UnitType;
  spellDamage?: number;
  spellRadius?: number;
}

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

export interface Tower {
  id: number;
  side: Side;
  kind: "princess" | "king";
  lane: Lane | "center";
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  damage: number;
  range: number;
  attackInterval: number;
  attackCooldown: number;
}
export interface Projectile {
  id: number; side: Side; x: number; y: number; startX: number; startY: number;
  targetId: number | null; targetX: number; targetY: number; age: number; duration: number;
  damage: number; splashRadius: number; style: "arrow" | "fire" | "cannon" | "fireball" | "arrows";
}
export interface Effect {
  id: number; x: number; y: number; age: number; lifetime: number; radius: number;
  style: "hit" | "explosion" | "arrows";
}
export interface SideState {
  elixir: number; hand: CardId[]; drawPile: CardId[]; drawIndex: number; thinkIn: number; cardsPlayed: number;
}
export interface GameState {
  time: number; gameOver: boolean; winner: Side | "draw" | null; units: Unit[]; towers: Tower[];
  projectiles: Projectile[]; effects: Effect[]; sides: Record<Side, SideState>; nextId: number;
  seed: number; events: string[];
}
export interface BotDecision { cardId: CardId; lane: Lane; targetX?: number; targetY?: number; }
