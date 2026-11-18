import type { BattleMusic } from "../audio/battleMusic";
import type { SoundEffects } from "../audio/soundEffects";
import type { CardId, GameState, Side } from "../game/types";
import type { ArenaRenderer } from "../render/arenaRenderer";
import type { OnlineClient } from "../net/onlineClient";
import type { BattleHud } from "./battleHud";
import { clearOnlineResumeToken } from "./onlineResumeToken";

interface BattleOnlineOptions {
  renderer: ArenaRenderer;
  music: BattleMusic;
  soundEffects: SoundEffects;
  hud: BattleHud;
  setGame(state: GameState): void;
  getSelectedCard(): CardId | null;
  setSelectedCard(cardId: CardId | null): void;
  setHistoryDisabled(): void;
  setPaused(value: boolean): void;
  resetSimulation(): void;
  setPreviousGameOver(value: boolean): void;
  updateHud(): void;
}

export class BattleOnline {
  private onlineClient: OnlineClient | null = null;
  private playerSide: Side = "blue";
  private previousGameOver = false;

  public constructor(private readonly options: BattleOnlineOptions) {}

  public get isActive(): boolean {
    return this.onlineClient !== null;
  }

  public get side(): Side {
    return this.playerSide;
  }

  public get client(): OnlineClient | null {
    return this.onlineClient;
  }

  public activate(side: Side, state: GameState, client: OnlineClient): void {
    this.onlineClient = client;
    this.playerSide = side;
    this.options.setGame(state);
    this.options.setHistoryDisabled();
    this.options.setSelectedCard(null);
    this.options.setPaused(false);
    this.options.resetSimulation();
    this.previousGameOver = state.gameOver;
    this.options.setPreviousGameOver(state.gameOver);

    document.body.dataset.online = "true";
    const modeDescription = document.getElementById("mode-description");
    if (modeDescription) {
      modeDescription.textContent = "Online match · " + side.toUpperCase();
    }

    this.options.music.start(state.time, state.phase);
    this.options.renderer.setDeploymentArea(state, side, null);
    this.options.renderer.render(state);
    this.options.updateHud();
    this.options.hud.setPaused(false, state);
  }

  public applyState(state: GameState): void {
    if (!this.onlineClient) return;

    const previousGameOver = this.previousGameOver;
    this.options.setGame(state);
    this.options.music.update(state.time, state.phase);

    for (const event of state.audioEvents) {
      this.options.soundEffects.play(event);
    }

    if (state.gameOver && !previousGameOver) {
      this.options.music.stop();
      this.options.soundEffects.play(
        state.winner === "draw"
          ? "match-draw"
          : state.winner === this.playerSide
            ? "match-victory"
            : "match-defeat"
      );
    }

    this.previousGameOver = state.gameOver;
    this.options.setPreviousGameOver(state.gameOver);

    if (state.gameOver) {
      this.options.setSelectedCard(null);
      this.options.renderer.setDeploymentArea(state, this.playerSide, null);
      this.options.renderer.clearUnitPreview();
    } else {
      this.options.renderer.setDeploymentArea(
        state,
        this.playerSide,
        this.options.getSelectedCard()
      );
    }
  }

  public leave(): boolean {
    if (!this.onlineClient) return false;

    this.onlineClient.leave();
    clearOnlineResumeToken();
    this.onlineClient = null;
    this.playerSide = "blue";

    document.body.dataset.online = "false";
    const modeDescription = document.getElementById("mode-description");
    if (modeDescription) {
      modeDescription.textContent = "Player vs AI · Live match";
    }

    return true;
  }
}
