const SIMULATION_STEP = 1 / 30;
const MAX_FRAME_SECONDS = 0.1;

export class BattleSimulationClock {
  private accumulator = 0;
  private speed = 1;

  public setSpeed(speed: number): void {
    this.speed = speed;
  }

  public reset(): void {
    this.accumulator = 0;
  }

  public advance(
    elapsedSeconds: number,
    shouldAdvance: boolean,
    step: () => void,
    isComplete: () => boolean
  ): void {
    if (!shouldAdvance) return;

    this.accumulator += Math.min(elapsedSeconds, MAX_FRAME_SECONDS) * this.speed;

    while (this.accumulator >= SIMULATION_STEP) {
      this.accumulator -= SIMULATION_STEP;
      step();
      if (isComplete()) break;
    }
  }
}
