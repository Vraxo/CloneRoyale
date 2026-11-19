import type { SoundEffects } from "../audio/soundEffects";
import { cardById } from "../game/cards";
import { playCard } from "../game/deployment";
import type { GameHistory } from "../game/history";
import { canPlaceCard, snapToArenaTile } from "../game/placement";
import type { ReplayRecordingSession } from "../game/replayRecording";
import type { CardId, GameState, Side } from "../game/types";
import type { ArenaRenderer } from "../render/arenaRenderer";
import type { OnlineClient } from "../multiplayer/onlineClient";

interface BattleActionsOptions {
  renderer: ArenaRenderer;
  soundEffects: SoundEffects;
  replayRecording: ReplayRecordingSession;
  getGame(): GameState;
  getSide(): Side;
  getSelectedCard(): CardId | null;
  setSelectedCard(cardId: CardId | null): void;
  isPaused(): boolean;
  isReplayActive(): boolean;
  getOnlineClient(): OnlineClient | null;
  getHistory(): GameHistory | null;
  updateHud(): void;
}

export class BattleActions {
  private placementMessage = "Choose a card, then deploy on your side.";

  public constructor(private readonly options: BattleActionsOptions) {}

  public get currentPlacementMessage(): string {
    return this.placementMessage;
  }

  public setNotice(message: string): void {
    this.placementMessage = message;
  }

  public reset(): void {
    this.placementMessage = "Choose a card, then deploy on your side.";
    this.clearSelection();
  }

  public selectCard(cardId: CardId): void {
    const { getGame, getSide, getSelectedCard, setSelectedCard, soundEffects } = this.options;
    const game = getGame();

    if (this.options.isPaused() || game.gameOver || this.options.isReplayActive()) return;

    if (getSelectedCard() === cardId) {
      soundEffects.play("ui-click");
      setSelectedCard(null);
      this.placementMessage = "Choose a card, then deploy on your side.";
    } else {
      const card = cardById(cardId);
      if (game.sides[getSide()].elixir < card.cost) {
        soundEffects.play("ui-invalid");
        this.placementMessage = `You need ${card.cost} elixir to play ${card.name}.`;
        this.options.updateHud();
        return;
      }

      soundEffects.play("ui-click");
      setSelectedCard(cardId);
      this.placementMessage = card.category === "spell"
        ? `Click anywhere on the arena to cast ${card.name}.`
        : `Place ${card.name} in your deployment area.`;
    }

    this.clearPreview();
    this.options.renderer.setDeploymentArea(game, getSide(), getSelectedCard());
    this.options.updateHud();
  }

  public playSelectedCardAt(clientX: number, clientY: number): void {
    const { renderer, getGame, getSide, getSelectedCard, setSelectedCard, soundEffects } = this.options;
    const game = getGame();
    if (this.options.isPaused() || game.gameOver) return;

    const worldPoint = renderer.screenToWorld(clientX, clientY);
    if (!worldPoint) return;
    const point = snapToArenaTile(worldPoint);
    const selectedCard = getSelectedCard();

    if (!selectedCard) {
      soundEffects.play("ui-invalid");
      this.placementMessage = "Select a card first.";
      this.options.updateHud();
      return;
    }

    const side = getSide();
    if (!canPlaceCard(game, side, selectedCard, point.x, point.y)) {
      soundEffects.play("ui-invalid");
      this.placementMessage = cardById(selectedCard).category === "spell"
        ? "That spell target is outside the arena or the card is unavailable."
        : "Invalid deployment. Place troops and buildings in an unlocked deployment area.";
      this.options.updateHud();
      renderer.setPlacementPreview(point, false);
      return;
    }

    const card = cardById(selectedCard);
    const onlineClient = this.options.getOnlineClient();
    if (onlineClient) {
      onlineClient.playCard(selectedCard, point.x, point.y);
      setSelectedCard(null);
      this.placementMessage = `${card.name} deployed.`;
      this.clearPreview();
      renderer.setDeploymentArea(game, side, null);
      this.options.updateHud();
      return;
    }

    const lane = point.x < 360 ? "left" : "right";
    if (!playCard(game, side, selectedCard, lane, point.x, point.y, point)) {
      soundEffects.play("ui-invalid");
      this.placementMessage = "That card can no longer be played.";
      this.options.updateHud();
      return;
    }

    for (const event of game.audioEvents) soundEffects.play(event);
    game.audioEvents = [];
    this.options.replayRecording.recordDeployment(game, side, selectedCard, point.x, point.y);
    this.options.getHistory()?.record(game);
    setSelectedCard(null);
    this.placementMessage = `${card.name} deployed.`;
    this.clearPreview();
    renderer.setDeploymentArea(game, side, null);
    renderer.render(game);
    this.options.updateHud();
  }

  public updatePlacementPreview(event: PointerEvent): void {
    const { renderer, getGame, getSide, getSelectedCard } = this.options;
    const selectedCard = getSelectedCard();
    const game = getGame();

    if (!selectedCard || this.options.isPaused() || game.gameOver || this.options.isReplayActive()) {
      renderer.setPlacementPreview(null);
      renderer.setDeploymentArea(game, getSide(), null);
      renderer.clearUnitPreview();
      return;
    }

    renderer.setDeploymentArea(game, getSide(), selectedCard);
    const point = renderer.screenToWorld(event.clientX, event.clientY);
    if (!point) {
      renderer.setPlacementPreview(null);
      renderer.clearUnitPreview();
      return;
    }

    renderer.setUnitPreview(selectedCard, snapToArenaTile(point), getSide());
    renderer.setPlacementPreview(null);
  }

  public clearPointerPreview(): void {
    this.options.renderer.setPlacementPreview(null);
    this.options.renderer.clearUnitPreview();
  }

  public clearSelection(): void {
    this.options.setSelectedCard(null);
    this.clearPreview();
    this.options.renderer.setDeploymentArea(
      this.options.getGame(),
      this.options.getSide(),
      null
    );
  }

  private clearPreview(): void {
    this.options.renderer.setPlacementPreview(null);
    this.options.renderer.clearUnitPreview();
  }
}
