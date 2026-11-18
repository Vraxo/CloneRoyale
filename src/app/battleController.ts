import { createBattleMusic, type BattleMusic } from "../audio/battleMusic";
import { createSoundEffects, type SoundEffects } from "../audio/soundEffects";
import { SIMULATION_STEP } from "../game/simulation";
import { SimulationRuntime } from "../runtime/simulationRuntime";
import { createGameHistory } from "../game/history";
import { isBattleReplay, type BattleReplay } from "../game/replay";
import { ReplayRecordingSession } from "../game/replayRecording";
import { ReplayPlaybackSession } from "../game/replayPlayback";
import { saveBattleReplay, saveReplayShareToken } from "../game/replayStorage";
import { STARTER_DECK } from "../game/cards";
import type { CardId, GameState, Side } from "../game/types";
import type { ArenaRenderer } from "../render/arenaRenderer";
import type { OnlineClient } from "../net/onlineClient";
import { createBattleHud, type BattleHud } from "./battleHud";
import { BattleActions } from "./battleActions";
import { BattleSimulationClock } from "./battleSimulation";
import { BattleOnline } from "./battleOnline";

export class BattleController {
  private game: GameState;
  private readonly runtime: SimulationRuntime;
  private history: ReturnType<typeof createGameHistory> | null;
  private paused = false;
  private readonly simulation = new BattleSimulationClock();
  private lastHudUpdate = 0;
  private previousGameOver = false;
  private selectedCard: CardId | null = null;
  private playerDeck: CardId[] = STARTER_DECK.slice();
  private battleSeed: number;
  private readonly replayRecording: ReplayRecordingSession;
  private readonly replayPlayback = new ReplayPlaybackSession();
  private lastReplay: BattleReplay | null = null;
  private lastReplayShareToken: string | null = null;
  private readonly online: BattleOnline;
  private readonly hud: BattleHud;
  private readonly actions: BattleActions;

  public readonly music: BattleMusic;
  public readonly soundEffects: SoundEffects;

  public constructor(
    public readonly renderer: ArenaRenderer,
    enableDebugTools = false
  ) {
    this.battleSeed = Date.now() >>> 0;
    this.runtime = new SimulationRuntime(this.battleSeed);
    this.game = this.runtime.state;
    this.replayRecording = new ReplayRecordingSession(this.battleSeed, this.playerDeck);
    this.history = enableDebugTools ? createGameHistory(this.game) : null;
    this.music = createBattleMusic();
    this.soundEffects = createSoundEffects();
    this.hud = createBattleHud(renderer);
    this.online = new BattleOnline({
      renderer,
      music: this.music,
      soundEffects: this.soundEffects,
      hud: this.hud,
      getGame: () => this.game,
      setGame: (state) => { this.game = state; },
      getSelectedCard: () => this.selectedCard,
      setSelectedCard: (cardId) => { this.selectedCard = cardId; },
      setHistoryDisabled: () => { this.history = null; },
      setPaused: (value) => { this.paused = value; },
      resetSimulation: () => this.simulation.reset(),
      setPreviousGameOver: (value) => { this.previousGameOver = value; },
      updateHud: () => this.updateHud()
    });
    this.actions = new BattleActions({
      renderer,
      soundEffects: this.soundEffects,
      replayRecording: this.replayRecording,
      getGame: () => this.game,
      getSide: () => this.online.side,
      getSelectedCard: () => this.selectedCard,
      setSelectedCard: (cardId) => { this.selectedCard = cardId; },
      isPaused: () => this.paused,
      isReplayActive: () => this.replayPlayback.isActive,
      getOnlineClient: () => this.online.client,
      getHistory: () => this.history,
      updateHud: () => this.updateHud()
    });
    document.addEventListener("pointerdown", () => this.soundEffects.unlock(), {
      capture: true,
      once: true
    });
    document.addEventListener("keydown", () => this.soundEffects.unlock(), {
      capture: true,
      once: true
    });
  }

  public enableDebugTools(): void {
    if (this.history) return;
    this.history = createGameHistory(this.game);
  }

  public get isOnline(): boolean { return this.online.isActive; }

  public get side(): Side { return this.online.side; }

  public get currentSelectedCard(): CardId | null {
    return this.selectedCard;
  }

  public setPlayerDeck(deck: CardId[]): void {
    if (deck.length !== 8 || new Set(deck).size !== 8) return;
    this.playerDeck = deck.slice();
    this.applyPlayerDeck();
    this.updateHud();
  }

  private applyPlayerDeck(): void {
    const player = this.game.sides.blue;
    player.hand = this.playerDeck.slice(0, 4);
    player.drawPile = this.playerDeck.slice(4);
  }

  public get state(): GameState {
    return this.game;
  }

  public get isReplaying(): boolean { return this.replayPlayback.isActive; }
  public get replayTick(): number { return this.replayPlayback.tick; }
  public get replayDurationTicks(): number { return this.replayPlayback.durationTicks; }
  public get completedReplay(): BattleReplay | null { return this.lastReplay; }
  public get completedReplayShareToken(): string | null { return this.lastReplayShareToken; }

  public applyOnlineReplay(replay: unknown, shareToken?: string): void {
    if (!this.isOnline || !isBattleReplay(replay) || replay.mode !== "online") return;
    this.lastReplay = replay;
    this.lastReplayShareToken = typeof shareToken === "string" && /^[a-f0-9]{64}$/.test(shareToken) ? shareToken : null;
    document.body.dataset.replayAvailable = "true";
    if (this.lastReplayShareToken) saveReplayShareToken(replay.id, this.lastReplayShareToken);
    saveBattleReplay(replay);
    this.updateHud();
  }

  public startReplay(replay: unknown): boolean {
    const replayState = this.replayPlayback.start(this.game, replay);
    if (!replayState) return false;
    document.body.dataset.replaying = "true";
    this.game = replayState;
    this.selectedCard = null;
    this.paused = false;
    this.simulation.setSpeed(1);
    this.simulation.reset();
    this.renderer.setPlacementPreview(null);
    this.renderer.setDeploymentArea(this.game, "blue", null);
    this.renderer.clearUnitPreview();
    this.music.stop();
    this.renderer.render(this.game);
    this.updateHud();
    return true;
  }

  public seekReplay(tick: number): void {
    const replayState = this.replayPlayback.seek(tick);
    if (!replayState) return;
    this.game = replayState;
    this.simulation.reset();
    this.renderer.render(this.game);
    this.updateHud();
  }

  public exitReplay(): void {
    const liveState = this.replayPlayback.exit();
    if (!liveState) return;
    this.game = liveState;
    document.body.dataset.replaying = "false";
    this.paused = true;
    this.simulation.reset();
    this.renderer.setDeploymentArea(this.game, "blue", null);
    this.renderer.render(this.game);
    this.updateHud();
  }

  public get isPaused(): boolean {
    return this.paused;
  }

  public get isGameOver(): boolean {
    return this.game.gameOver;
  }

  public get canStepBack(): boolean {
    return this.history?.canStepBack() === true && !this.game.gameOver;
  }

  public activateOnline(side: Side, state: GameState, client: OnlineClient): void {
    this.lastReplay = null;
    this.lastReplayShareToken = null;
    document.body.dataset.replayAvailable = "false";
    this.online.activate(side, state, client);
  }

  public setOnlineNotice(message: string): void {
    if (!this.isOnline) return;
    this.actions.setNotice(message);
    this.updateHud();
  }

  public applyOnlineState(state: GameState): void {
    this.online.applyState(state);
  }

  public leaveOnline(): void {
    if (!this.online.leave()) return;
    this.startNewBattle();
  }

  public initialize(): void {
    this.renderer.render(this.game);
    this.updateHud();
  }

  public setPaused(value: boolean): void {
    if (this.isOnline && !this.replayPlayback.isActive) return;
    this.paused = value;
    this.hud.setPaused(value, this.game);
    this.music.setPaused(this.paused || this.game.gameOver);
    if (value) {
      this.renderer.setPlacementPreview(null);
      this.renderer.setDeploymentArea(this.game, this.online.side, null);
      this.renderer.clearUnitPreview();
    } else {
      this.renderer.setDeploymentArea(this.game, this.online.side, this.selectedCard);
    }
  }

  public togglePaused(): void {
    if (this.isOnline) return;
    this.setPaused(!this.paused);
  }

  public startNewBattle(): void {
    if (this.isOnline) return;
    this.soundEffects.stopAll();
    this.battleSeed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
    this.runtime.reset(this.battleSeed);
    this.game = this.runtime.state;
    this.applyPlayerDeck();
    this.replayRecording.reset(this.battleSeed, this.playerDeck);
    this.lastReplay = null;
    this.lastReplayShareToken = null;
    document.body.dataset.replayAvailable = "false";
    this.replayPlayback.exit();
    this.selectedCard = null;
    this.actions.reset();
    this.renderer.setPlacementPreview(null);
    this.renderer.setDeploymentArea(this.game, this.online.side, null);
    this.renderer.clearUnitPreview();
    this.simulation.reset();
    this.history?.reset(this.game);
    this.previousGameOver = false;
    this.setPaused(false);
    this.music.start(this.game.time, this.game.phase);
    this.renderer.render(this.game);
    this.updateHud();
  }

  public selectCard(cardId: CardId): void {
    this.actions.selectCard(cardId);
  }

  public playSelectedCardAt(clientX: number, clientY: number): void {
    this.actions.playSelectedCardAt(clientX, clientY);
  }

  public updatePlacementPreview(event: PointerEvent): void {
    this.actions.updatePlacementPreview(event);
  }

  public clearPointerPreview(): void {
    this.actions.clearPointerPreview();
  }

  public stepForward(): void {
    this.advanceOneStep();
    this.renderer.render(this.game);
    this.updateHud();
  }

  public stepBackward(): void {
    const previousState = this.history?.stepBack() ?? null;
    if (!previousState) return;
    this.game = previousState;
    this.selectedCard = null;
    this.actions.reset();
    this.renderer.setPlacementPreview(null);
    this.soundEffects.stopAll();
    this.simulation.reset();
    this.setPaused(true);
    this.previousGameOver = this.game.gameOver;
    this.music.seek(this.game.time, this.game.phase);
    this.music.setPaused(true);
    this.renderer.render(this.game);
    this.updateHud();
  }

  public setSpeed(speed: number): void {
    this.simulation.setSpeed(speed);
    this.music.setSpeed(speed);
    this.soundEffects.setSpeed(speed);
  }

  public update(elapsedSeconds: number): void {
    this.simulation.advance(
      elapsedSeconds,
      (!this.isOnline || this.replayPlayback.isActive) && !this.paused && !this.game.gameOver,
      () => this.advanceOneStep(),
      () => this.game.gameOver
    );

    if (this.game.gameOver && !this.previousGameOver) {
      this.music.stop();
      this.soundEffects.play(this.game.winner === "draw" ? "match-draw" : this.game.winner === "blue" ? "match-victory" : "match-defeat");
    }
    this.previousGameOver = this.game.gameOver;
    this.renderer.render(this.game);

    const now = performance.now();
    if (now - this.lastHudUpdate >= 150) {
      this.updateHud();
      this.lastHudUpdate = now;
    }
  }

  public updateHud(): void {
    this.hud.update(
      this.game,
      this.selectedCard,
      this.paused,
      this.actions.currentPlacementMessage,
      this.history?.canStepBack() ?? false,
      this.online.side,
      this.replayTick,
      this.replayDurationTicks
    );
  }

  private advanceOneStep(): void {
    if (this.game.gameOver) return;
    if (this.replayPlayback.isActive) {
      this.game = this.replayPlayback.step() ?? this.game;
      this.renderer.setDeploymentArea(this.game, "blue", null);
      if (this.replayPlayback.isFinished) this.paused = true;
      return;
    }
    const previousTime = this.game.time;
    this.runtime.step(SIMULATION_STEP, "red");
    this.renderer.setDeploymentArea(this.game, "blue", this.selectedCard);
    if (this.game.time === previousTime) return;

    this.music.update(this.game.time, this.game.phase);
    for (const event of this.game.audioEvents) this.soundEffects.play(event);
    this.game.audioEvents = [];
    this.history?.record(this.game);

    if (this.game.gameOver) {
      this.lastReplay = this.replayRecording.finish(this.game);
      document.body.dataset.replayAvailable = "true";
      saveBattleReplay(this.lastReplay);
      this.selectedCard = null;
      this.renderer.setPlacementPreview(null);
      this.renderer.setDeploymentArea(this.game, "blue", null);
      this.renderer.clearUnitPreview();
      this.music.stop();
      this.soundEffects.play(this.game.winner === "draw" ? "match-draw" : this.game.winner === "blue" ? "match-victory" : "match-defeat");
      this.previousGameOver = true;
      this.simulation.reset();
      this.updateHud();
    }
  }
}
