import type { Effect } from "./Effect";
import type { Projectile } from "./Projectile";
import type { Side } from "./Side";
import type { SideState } from "./SideState";
import type { Tower } from "./Tower";
import type { Unit } from "./Unit";

export interface GameState {
  time: number;
  gameOver: boolean;
  winner: Side | "draw" | null;
  units: Unit[];
  towers: Tower[];
  projectiles: Projectile[];
  effects: Effect[];
  sides: Record<Side, SideState>;
  nextId: number;
  seed: number;
  events: string[];
}
