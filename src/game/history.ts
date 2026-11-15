import type { GameState } from "./types";

const HISTORY_SECONDS = 30;
const MAX_HISTORY_STEPS = Math.ceil(HISTORY_SECONDS / (1 / 30));

export interface GameHistory {
  canStepBack(): boolean;
  record(state: GameState): void;
  reset(state: GameState): void;
  stepBack(): GameState | null;
}

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

export function createGameHistory(initialState: GameState): GameHistory {
  const snapshots: GameState[] = [cloneState(initialState)];

  return {
    canStepBack(): boolean {
      return snapshots.length > 1;
    },

    record(state: GameState): void {
      snapshots.push(cloneState(state));

      if (snapshots.length > MAX_HISTORY_STEPS + 1) {
        snapshots.shift();
      }
    },

    reset(state: GameState): void {
      snapshots.length = 0;
      snapshots.push(cloneState(state));
    },

    stepBack(): GameState | null {
      if (snapshots.length <= 1) return null;

      snapshots.pop();
      return cloneState(snapshots[snapshots.length - 1]);
    }
  };
}
