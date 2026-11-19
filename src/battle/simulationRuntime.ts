import { createGame, stepGame } from "../game/simulation";
import type { GameState, Side } from "../game/types";

export class SimulationRuntime {
  private currentState: GameState;

  public constructor(seed = 20261116) {
    this.currentState = createGame(seed);
  }

  public get state(): GameState {
    return this.currentState;
  }

  public reset(seed: number): void {
    this.currentState = createGame(seed);
  }

  public step(deltaSeconds: number, botSide: Side | null = null): void {
    stepGame(this.currentState, deltaSeconds, botSide);
  }

  public runToCompletion(
    botSide: Side | null = null,
    maxSteps = 60 * 60 * 30
  ): number {
    let steps = 0;
    const stepSeconds = 1 / 30;

    while (!this.currentState.gameOver && steps < maxSteps) {
      this.step(stepSeconds, botSide);
      steps += 1;
    }

    return steps;
  }
}
