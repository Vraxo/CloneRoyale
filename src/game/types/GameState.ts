import type { Effect } from "./Effect";
import type { Projectile } from "./Projectile";
import type { Side } from "./Side";
import type { SideState } from "./SideState";
import type { Tower } from "./Tower";
import type { Unit } from "./Unit";
import type { AudioEvent } from "./AudioEvent";

export type MatchPhase = "regulation" | "overtime" | "tiebreaker" | "finished";

export interface GameState {
  time: number;
  phase: MatchPhase;
  overtimeStartCrowns: Record<Side, number> | null;
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
  audioEvents: AudioEvent[];
}
