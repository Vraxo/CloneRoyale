import { ReplayRecorder, type BattleReplay } from "./replay";
import type { CardId, GameState, Side } from "./types";

export class ReplayRecordingSession {
  private recorder: ReplayRecorder;

  public constructor(seed: number, deck: CardId[]) {
    this.recorder = new ReplayRecorder(seed, deck);
  }

  public reset(seed: number, deck: CardId[]): void {
    this.recorder = new ReplayRecorder(seed, deck);
  }

  public recordDeployment(state: GameState, side: Side, cardId: CardId, x: number, y: number): void {
    this.recorder.record(state, side, cardId, x, y);
  }

  public finish(state: GameState): BattleReplay {
    return this.recorder.finish(state);
  }
}
