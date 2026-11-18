import { playCard } from "./deployment";
import { CARDS } from "./cards";
import { createGame, SIMULATION_STEP, stepGame } from "./simulation";
import type { CardId, GameState, Lane, Side } from "./types";

export interface ReplayAction {
  tick: number;
  side: Side;
  cardId: CardId;
  x: number;
  y: number;
}

export interface BattleReplay {
  version: 1;
  id: string;
  createdAt: number;
  seed: number;
  deck: CardId[];
  durationTicks: number;
  winner: Side | "draw" | null;
  actions: ReplayAction[];
}

export class ReplayRecorder {
  private readonly actions: ReplayAction[] = [];

  public constructor(
    private readonly seed: number,
    private readonly deck: CardId[],
    private readonly id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  ) {}

  public record(state: GameState, side: Side, cardId: CardId, x: number, y: number): void {
    this.actions.push({
      tick: Math.max(0, Math.round(state.time / SIMULATION_STEP)),
      side,
      cardId,
      x,
      y
    });
  }

  public finish(state: GameState): BattleReplay {
    return {
      version: 1,
      id: this.id,
      createdAt: Date.now(),
      seed: this.seed,
      deck: this.deck.slice(),
      durationTicks: Math.max(0, Math.round(state.time / SIMULATION_STEP)),
      winner: state.winner,
      actions: this.actions.map(action => ({ ...action }))
    };
  }
}

export class ReplayPlayer {
  private currentState: GameState;
  private currentTick = 0;
  private actionIndex = 0;

  public constructor(public readonly replay: BattleReplay) {
    this.currentState = this.createInitialState();
  }

  public get state(): GameState { return this.currentState; }
  public get tick(): number { return this.currentTick; }
  public get durationTicks(): number { return this.replay.durationTicks; }
  public get isFinished(): boolean { return this.currentTick >= this.replay.durationTicks || this.currentState.gameOver; }

  public step(): GameState {
    if (this.isFinished) return this.currentState;
    while (this.actionIndex < this.replay.actions.length
      && this.replay.actions[this.actionIndex].tick <= this.currentTick) {
      const action = this.replay.actions[this.actionIndex++];
      const lane: Lane = action.x < 360 ? "left" : "right";
      playCard(this.currentState, action.side, action.cardId, lane, action.x, action.y, {
        x: action.x,
        y: action.y
      });
    }
    stepGame(this.currentState, SIMULATION_STEP, "red");
    this.currentTick += 1;
    return this.currentState;
  }

  public seek(targetTick: number): GameState {
    const target = Math.max(0, Math.min(this.replay.durationTicks, Math.floor(targetTick)));
    this.currentState = this.createInitialState();
    this.currentTick = 0;
    this.actionIndex = 0;
    while (this.currentTick < target && !this.currentState.gameOver) this.step();
    return this.currentState;
  }

  private createInitialState(): GameState {
    const state = createGame(this.replay.seed);
    state.sides.blue.hand = this.replay.deck.slice(0, 4);
    state.sides.blue.drawPile = this.replay.deck.slice(4);
    return state;
  }
}

export function isBattleReplay(value: unknown): value is BattleReplay {
  if (!value || typeof value !== "object") return false;
  const replay = value as Partial<BattleReplay>;
  return replay.version === 1
    && typeof replay.id === "string"
    && Number.isFinite(replay.seed)
    && Array.isArray(replay.deck)
    && replay.deck.length === 8
    && replay.deck.every(cardId => typeof cardId === "string" && Object.hasOwn(CARDS, cardId))
    && new Set(replay.deck).size === 8
    && typeof replay.durationTicks === "number"
    && Number.isInteger(replay.durationTicks)
    && replay.durationTicks >= 0
    && Array.isArray(replay.actions)
    && replay.actions.every(action =>
      Number.isInteger(action.tick)
      && action.tick >= 0
      && action.tick <= replay.durationTicks!
      && (action.side === "blue" || action.side === "red")
      && typeof action.cardId === "string"
      && Object.hasOwn(CARDS, action.cardId)
      && Number.isFinite(action.x)
      && Number.isFinite(action.y)
    );
}
