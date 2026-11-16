import { createBattleMusic, type BattleMusic } from "../audio/battleMusic";
import { createSoundEffects, type SoundEffects } from "../audio/soundEffects";
import { SIMULATION_STEP } from "../game/simulation";
import { SimulationRuntime } from "../runtime/simulationRuntime";
import { createGameHistory } from "../game/history";
import { cardById } from "../game/cards";
import { playCard } from "../game/deployment";
import { canPlaceCard, snapToArenaTile } from "../game/placement";
import type { CardId, GameState, Lane, Side } from "../game/types";
import type { ArenaRenderer } from "../render/arenaRenderer";
import type { OnlineClient } from "../net/onlineClient";
import { createBattleHud, type BattleHud } from "./battleHud";

export class BattleController {
  private game: GameState;
  private readonly runtime: SimulationRuntime;
  private history: ReturnType<typeof createGameHistory> | null;
  private paused = false;
  private speed = 1;
  private accumulator = 0;
  private lastHudUpdate = 0;
  private previousGameOver = false;
  private selectedCard: CardId | null = null;
  private onlineClient: OnlineClient | null = null;
  private playerSide: Side = "blue";
  private placementMessage = "Choose a card, then deploy on your side.";
  private readonly hud: BattleHud;

  public readonly music: BattleMusic;
  public readonly soundEffects: SoundEffects;

  public constructor(
    public readonly renderer: ArenaRenderer,
    enableDebugTools = false
  ) {
    this.runtime = new SimulationRuntime(Date.now() >>> 0);
    this.game = this.runtime.state;
    this.history = enableDebugTools ? createGameHistory(this.game) : null;
    this.music = createBattleMusic();
    this.soundEffects = createSoundEffects();
    this.hud = createBattleHud(renderer);
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

  public get isOnline(): boolean { return this.onlineClient !== null; }

  public get side(): Side { return this.playerSide; }

  public get currentSelectedCard(): CardId | null {
    return this.selectedCard;
  }

  public get state(): GameState {
    return this.game;
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
    this.onlineClient = client;
    this.playerSide = side;
    this.game = state;
    this.history = null;
    this.selectedCard = null;
    this.paused = false;
    this.accumulator = 0;
    this.previousGameOver = state.gameOver;
    document.body.dataset.online = "true";
    const modeDescription = document.getElementById("mode-description");
    if (modeDescription) modeDescription.textContent = "Online match · " + side.toUpperCase();
    this.music.start(state.time, state.phase);
    this.renderer.setDeploymentArea(state, side, null);
    this.renderer.render(state);
    this.updateHud();
    this.hud.setPaused(false, state);
  }

  public setOnlineNotice(message: string): void {
    if (!this.isOnline) return;
    this.placementMessage = message;
    this.updateHud();
  }

  public applyOnlineState(state: GameState): void {
    if (!this.onlineClient) return;
    this.game = state;
    this.music.update(state.time, state.phase);
    for (const event of state.audioEvents) this.soundEffects.play(event);
    if (state.gameOver && !this.previousGameOver) this.music.stop();
    this.previousGameOver = state.gameOver;
    if (state.gameOver) {
      this.selectedCard = null;
      this.renderer.setDeploymentArea(state, this.playerSide, null);
      this.renderer.clearUnitPreview();
    }
    this.renderer.render(state);
    this.updateHud();
  }

  public leaveOnline(): void {
    if (!this.onlineClient) return;
    this.onlineClient.leave();
    this.onlineClient = null;
    this.playerSide = "blue";
    document.body.dataset.online = "false";
    const modeDescription = document.getElementById("mode-description");
    if (modeDescription) modeDescription.textContent = "Player vs AI · Live match";
    this.startNewBattle();
  }

  public initialize(): void {
    this.music.start(this.game.time, this.game.phase);
    this.renderer.render(this.game);
    this.updateHud();
  }

  public setPaused(value: boolean): void {
    if (this.isOnline) return;
    this.paused = value;
    this.hud.setPaused(value, this.game);
    this.music.setPaused(this.paused || this.game.gameOver);
    if (value) {
      this.renderer.setPlacementPreview(null);
      this.renderer.setDeploymentArea(this.game, this.playerSide, null);
      this.renderer.clearUnitPreview();
    } else {
      this.renderer.setDeploymentArea(this.game, this.playerSide, this.selectedCard);
    }
  }

  public togglePaused(): void {
    if (this.isOnline) return;
    this.setPaused(!this.paused);
  }

  public startNewBattle(): void {
    if (this.isOnline) return;
    this.soundEffects.stopAll();
    this.runtime.reset((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0);
    this.game = this.runtime.state;
    this.selectedCard = null;
    this.placementMessage = "Choose a card, then deploy on your side.";
    this.renderer.setPlacementPreview(null);
    this.renderer.setDeploymentArea(this.game, this.playerSide, null);
    this.renderer.clearUnitPreview();
    this.accumulator = 0;
    this.history?.reset(this.game);
    this.previousGameOver = false;
    this.setPaused(false);
    this.music.start(this.game.time, this.game.phase);
    this.renderer.render(this.game);
    this.updateHud();
  }

  public selectCard(cardId: CardId): void {
    if (this.paused || this.game.gameOver) return;

    if (this.selectedCard === cardId) {
      this.soundEffects.play("ui-click");
      this.selectedCard = null;
      this.placementMessage = "Choose a card, then deploy on your side.";
    } else {
      const card = cardById(cardId);
      if (this.game.sides[this.playerSide].elixir < card.cost) {
        this.soundEffects.play("ui-invalid");
        this.placementMessage = `You need ${card.cost} elixir to play ${card.name}.`;
        this.updateHud();
        return;
      }

      this.soundEffects.play("ui-click");
      this.selectedCard = cardId;
      this.placementMessage = card.category === "spell"
        ? `Click anywhere on the arena to cast ${card.name}.`
        : `Place ${card.name} in your deployment area.`;
    }

    this.renderer.setPlacementPreview(null);
    this.renderer.setDeploymentArea(this.game, this.playerSide, this.selectedCard);
    this.renderer.clearUnitPreview();
    this.updateHud();
  }

  public playSelectedCardAt(clientX: number, clientY: number): void {
    if (this.paused || this.game.gameOver) return;
    const worldPoint = this.renderer.screenToWorld(clientX, clientY);
    if (!worldPoint) return;
    const point = snapToArenaTile(worldPoint);

    if (!this.selectedCard) {
      this.soundEffects.play("ui-invalid");
      this.placementMessage = "Select a card first.";
      this.updateHud();
      return;
    }

    const cardId = this.selectedCard;
    if (!canPlaceCard(this.game, this.playerSide, cardId, point.x, point.y)) {
      this.soundEffects.play("ui-invalid");
      this.placementMessage = cardById(cardId).category === "spell"
        ? "That spell target is outside the arena or the card is unavailable."
        : "Invalid deployment. Place troops and buildings in an unlocked deployment area.";
      this.updateHud();
      this.renderer.setPlacementPreview(point, false);
      return;
    }

    if (this.onlineClient) {
      this.onlineClient.playCard(cardId, point.x, point.y);
      this.selectedCard = null;
      this.placementMessage = `${cardById(cardId).name} deployed.`;
      this.renderer.setPlacementPreview(null);
      this.renderer.clearUnitPreview();
      this.renderer.setDeploymentArea(this.game, this.playerSide, null);
      this.updateHud();
      return;
    }

    const lane: Lane = point.x < 360 ? "left" : "right";
    if (!playCard(this.game, this.playerSide, cardId, lane, point.x, point.y, point)) {
      this.soundEffects.play("ui-invalid");
      this.placementMessage = "That card can no longer be played.";
      this.updateHud();
      return;
    }

    for (const event of this.game.audioEvents) this.soundEffects.play(event);
    this.game.audioEvents = [];
    this.history?.record(this.game);
    this.selectedCard = null;
    this.placementMessage = `${cardById(cardId).name} deployed.`;
    this.renderer.setPlacementPreview(null);
    this.renderer.clearUnitPreview();
    this.renderer.setDeploymentArea(this.game, "blue", null);
    this.renderer.render(this.game);
    this.updateHud();
  }

  public updatePlacementPreview(event: PointerEvent): void {
    if (!this.selectedCard || this.paused || this.game.gameOver) {
      this.renderer.setPlacementPreview(null);
      this.renderer.setDeploymentArea(this.game, "blue", null);
      this.renderer.clearUnitPreview();
      return;
    }

    this.renderer.setDeploymentArea(this.game, "blue", this.selectedCard);
    const point = this.renderer.screenToWorld(event.clientX, event.clientY);
    if (!point) {
      this.renderer.setPlacementPreview(null);
      this.renderer.clearUnitPreview();
      return;
    }
    this.renderer.setUnitPreview(this.selectedCard, snapToArenaTile(point), this.playerSide);
    this.renderer.setPlacementPreview(null);
  }

  public clearPointerPreview(): void {
    this.renderer.setPlacementPreview(null);
    this.renderer.clearUnitPreview();
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
    this.placementMessage = "Choose a card, then deploy on your side.";
    this.renderer.setPlacementPreview(null);
    this.soundEffects.stopAll();
    this.accumulator = 0;
    this.setPaused(true);
    this.previousGameOver = this.game.gameOver;
    this.music.seek(this.game.time, this.game.phase);
    this.music.setPaused(true);
    this.renderer.render(this.game);
    this.updateHud();
  }

  public setSpeed(speed: number): void {
    this.speed = speed;
    this.music.setSpeed(speed);
    this.soundEffects.setSpeed(speed);
  }

  public update(elapsedSeconds: number): void {
    if (!this.isOnline && !this.paused && !this.game.gameOver) {
      this.accumulator += Math.min(elapsedSeconds, 0.1) * this.speed;
      while (this.accumulator >= SIMULATION_STEP) {
        this.advanceOneStep();
        this.accumulator -= SIMULATION_STEP;
        if (this.game.gameOver) break;
      }
    }

    if (this.game.gameOver && !this.previousGameOver) this.music.stop();
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
      this.placementMessage,
      this.history?.canStepBack() ?? false,
      this.playerSide
    );
  }

  private advanceOneStep(): void {
    if (this.game.gameOver) return;
    const previousTime = this.game.time;
    this.runtime.step(SIMULATION_STEP, "red");
    this.renderer.setDeploymentArea(this.game, "blue", this.selectedCard);
    if (this.game.time === previousTime) return;

    this.music.update(this.game.time, this.game.phase);
    for (const event of this.game.audioEvents) this.soundEffects.play(event);
    this.game.audioEvents = [];
    this.history?.record(this.game);

    if (this.game.gameOver) {
      this.selectedCard = null;
      this.renderer.setPlacementPreview(null);
      this.renderer.setDeploymentArea(this.game, "blue", null);
      this.renderer.clearUnitPreview();
      this.music.stop();
      this.previousGameOver = true;
      this.accumulator = 0;
      this.updateHud();
    }
  }
}
