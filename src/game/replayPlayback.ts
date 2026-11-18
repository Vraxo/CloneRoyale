import { ReplayPlayer, isBattleReplay, type BattleReplay } from "./replay";
import type { GameState } from "./types";

export class ReplayPlaybackSession {
  private player: ReplayPlayer | null = null;
  private liveState: GameState | null = null;

  public get isActive(): boolean { return this.player !== null; }
  public get tick(): number { return this.player?.tick ?? 0; }
  public get durationTicks(): number { return this.player?.durationTicks ?? 0; }
  public get isFinished(): boolean { return this.player?.isFinished ?? false; }

  public start(liveState: GameState, replay: unknown): GameState | null {
    if (this.player || !isBattleReplay(replay)) return null;
    this.liveState = liveState;
    this.player = new ReplayPlayer(replay);
    return this.player.state;
  }

  public step(): GameState | null {
    if (!this.player) return null;
    return this.player.step();
  }

  public seek(tick: number): GameState | null {
    if (!this.player) return null;
    return this.player.seek(tick);
  }

  public exit(): GameState | null {
    if (!this.player || !this.liveState) return null;
    const state = this.liveState;
    this.player = null;
    this.liveState = null;
    return state;
  }
}
