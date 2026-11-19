import type { BattleMusic } from "../audio/battleMusic";
import type { SoundEffects } from "../audio/soundEffects";
import type { ReplayRecordingSession } from "../game/replayRecording";
import type { BattleReplay } from "../game/replay";
import type { GameState } from "../game/types";
import { saveBattleReplay } from "../game/replayStorage";
import type { ArenaRenderer } from "./render/arenaRenderer";

interface BattleCompletionOptions {
  game: GameState;
  replayRecording: ReplayRecordingSession;
  renderer: ArenaRenderer;
  music: BattleMusic;
  soundEffects: SoundEffects;
  setSelectedCard(cardId: null): void;
  setReplayAvailable(available: boolean): void;
  setLastReplay(replay: BattleReplay): void;
  setPreviousGameOver(value: boolean): void;
  resetSimulation(): void;
  updateHud(): void;
}

export function completeBattle(options: BattleCompletionOptions): BattleReplay {
  const {
    game,
    replayRecording,
    renderer,
    music,
    soundEffects,
    setSelectedCard,
    setReplayAvailable,
    setLastReplay,
    setPreviousGameOver,
    resetSimulation,
    updateHud
  } = options;

  const replay = replayRecording.finish(game);
  setLastReplay(replay);
  setReplayAvailable(true);
  saveBattleReplay(replay);

  setSelectedCard(null);
  renderer.setPlacementPreview(null);
  renderer.setDeploymentArea(game, "blue", null);
  renderer.clearUnitPreview();
  music.stop();
  soundEffects.play(
    game.winner === "draw"
      ? "match-draw"
      : game.winner === "blue" ? "match-victory" : "match-defeat"
  );

  setPreviousGameOver(true);
  resetSimulation();
  updateHud();
  return replay;
}
