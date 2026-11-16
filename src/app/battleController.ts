import { createBattleMusic, type BattleMusic } from "../audio/battleMusic";
import { createSoundEffects, type SoundEffects } from "../audio/soundEffects";
import { createGame, SIMULATION_STEP, stepGame } from "../game/simulation";
import { createGameHistory } from "../game/history";
import { cardById } from "../game/cards";
import { playCard } from "../game/deployment";
import { canPlaceCard } from "../game/placement";
import type { CardId, GameState, Lane } from "../game/types";
import type { ArenaRenderer } from "../render/arenaRenderer";
import { createBattleHud, type BattleHud } from "./battleHud";

export class BattleController {
  private game: GameState;
  private readonly history;
  private paused = false;
  private speed = 1;
  private accumulator = 0;
  private lastHudUpdate = 0;
  private previousGameOver = false;
  private selectedCard: CardId | null = null;
  private placementMessage = "Choose a card, then deploy on your side.";
  private readonly hud: BattleHud;

  public readonly music: BattleMusic;
  public readonly soundEffects: SoundEffects;

  public constructor(public readonly renderer: ArenaRenderer) {
    this.game = createGame(Date.now() >>> 0);
    this.history = createGameHistory(this.game);
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
    return this.history.canStepBack() && !this.game.gameOver;
  }

  public initialize(): void {
    this.music.start(this.game.time, this.game.phase);
    this.renderer.render(this.game);
    this.updateHud();
  }

  public setPaused(value: boolean): void {
    this.paused = value;
    this.hud.setPaused(value, this.game);
    this.music.setPaused(this.paused || this.game.gameOver);
    if (value) {
      this.renderer.setPlacementPreview(null);
      this.renderer.setDeploymentArea(this.game, "blue", null);
      this.renderer.clearUnitPreview();
    } else {
      this.renderer.setDeploymentArea(this.game, "blue", this.selectedCard);
    }
  }

  public togglePaused(): void {
    this.setPaused(!this.paused);
  }

  public startNewBattle(): void {
    this.soundEffects.stopAll();
    this.game = createGame(
      (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0
    );
    this.selectedCard = null;
    this.placementMessage = "Choose a card, then deploy on your side.";
    this.renderer.setPlacementPreview(null);
    this.renderer.setDeploymentArea(this.game, "blue", null);
    this.renderer.clearUnitPreview();
    this.accumulator = 0;
    this.history.reset(this.game);
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
      if (this.game.sides.blue.elixir < card.cost) {
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
    this.renderer.setDeploymentArea(this.game, "blue", this.selectedCard);
    this.renderer.clearUnitPreview();
    this.updateHud();
  }

  public playSelectedCardAt(clientX: number, clientY: number): void {
    if (this.paused || this.game.gameOver) return;
    const point = this.renderer.screenToWorld(clientX, clientY);
    if (!point) return;

    if (!this.selectedCard) {
      this.soundEffects.play("ui-invalid");
      this.placementMessage = "Select a card first.";
      this.updateHud();
      return;
    }

    const cardId = this.selectedCard;
    if (!canPlaceCard(this.game, "blue", cardId, point.x, point.y)) {
      this.soundEffects.play("ui-invalid");
      this.placementMessage = cardById(cardId).category === "spell"
        ? "That spell target is outside the arena or the card is unavailable."
        : "Invalid deployment. Place troops and buildings in an unlocked deployment area.";
      this.updateHud();
      this.renderer.setPlacementPreview(point, false);
      return;
    }

    const lane: Lane = point.x < 360 ? "left" : "right";
    if (!playCard(this.game, "blue", cardId, lane, point.x, point.y, point)) {
      this.soundEffects.play("ui-invalid");
      this.placementMessage = "That card can no longer be played.";
      this.updateHud();
      return;
    }

    for (const event of this.game.audioEvents) this.soundEffects.play(event);
    this.game.audioEvents = [];
    this.history.record(this.game);
    this.selectedCard = null;
    this.placementMessage = `${cardById(cardId).name} deployed.`;
    this.renderer.setPlacementPreview(null);
    this.renderer.setHeldCardPreview(null, 0, 0);
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
    this.renderer.setHeldCardPreview(this.selectedCard, event.clientX, event.clientY);
    const point = this.renderer.screenToWorld(event.clientX, event.clientY);
    if (!point) {
      this.renderer.setPlacementPreview(null);
      this.renderer.setHeldCardPreview(null, 0, 0);
      return;
    }
    this.renderer.setPlacementPreview(null);
  }

  public clearPointerPreview(): void {
    this.renderer.setPlacementPreview(null);
    this.renderer.setHeldCardPreview(null, 0, 0);
  }

  public stepForward(): void {
    this.advanceOneStep();
    this.renderer.render(this.game);
    this.updateHud();
  }

  public stepBackward(): void {
    const previousState = this.history.stepBack();
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
    if (!this.paused && !this.game.gameOver) {
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
      this.history.canStepBack()
    );
  }

  private advanceOneStep(): void {
    if (this.game.gameOver) return;
    const previousTime = this.game.time;
    stepGame(this.game, SIMULATION_STEP, "red");
    this.renderer.setDeploymentArea(this.game, "blue", this.selectedCard);
    if (this.game.time === previousTime) return;

    this.music.update(this.game.time, this.game.phase);
    for (const event of this.game.audioEvents) this.soundEffects.play(event);
    this.game.audioEvents = [];
    this.history.record(this.game);

    if (this.game.gameOver) {
      this.selectedCard = null;
      this.renderer.setPlacementPreview(null);
      this.renderer.setDeploymentArea(this.game, "blue", null);
      this.renderer.setHeldCardPreview(null, 0, 0);
      this.music.stop();
      this.previousGameOver = true;
      this.accumulator = 0;
      this.updateHud();
    }
  }
}
