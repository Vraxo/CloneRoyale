import type { GameState, Lane, Side } from "./types";

export const FIELD_WIDTH = 540;
export const FIELD_HEIGHT = 960;
export const ARENA_TILE_SIZE = 30;
export const RIVER_TOP = FIELD_HEIGHT / 2 - ARENA_TILE_SIZE;
export const RIVER_BOTTOM = FIELD_HEIGHT / 2 + ARENA_TILE_SIZE;
export const LANE_X: Record<Lane, number> = { left: FIELD_WIDTH * 7 / 36, right: FIELD_WIDTH * 29 / 36 };
export const MAX_ELIXIR = 10;
export const MATCH_LENGTH = 180;

export function otherSide(side: Side): Side {
  return side === "blue" ? "red" : "blue";
}

export function directionFor(side: Side): number {
  return side === "blue" ? -1 : 1;
}

export function addEvent(state: GameState, message: string): void {
  state.events.unshift(message);
  state.events.length = Math.min(state.events.length, 5);
}

export function nextRandom(state: GameState): number {
  let value = state.seed += 0x6D2B79F5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
