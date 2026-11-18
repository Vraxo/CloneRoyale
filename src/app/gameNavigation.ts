import type { BattleController } from "./battleController";
import type { createMenuAudio } from "../audio/menuAudio";

type MenuAudio = ReturnType<typeof createMenuAudio>;

type GameNavigationOptions = {
  battle: BattleController;
  menuAudio: MenuAudio;
  setGameMenuOpen: (open: boolean) => void;
  openLobby: () => void;
};

export function createGameNavigation(options: GameNavigationOptions) {
  const { battle, menuAudio, setGameMenuOpen, openLobby } = options;

  function setGameScreen(screen: "home" | "battle"): void {
    document.body.dataset.screen = screen;
    if (screen === "battle") {
      menuAudio.stopMusic();
      setGameMenuOpen(false);
    } else {
      menuAudio.startMusic();
    }
  }

  function startSoloBattle(): void {
    battle.startNewBattle();
    setGameScreen("battle");
  }

  document.body.dataset.screen = "home";
  document.addEventListener("click", event => {
    if (document.body.dataset.screen !== "home" || !(event.target instanceof Element)) return;
    const button = event.target.closest("button");
    if (!button) return;
    if (button.id === "menu-play") menuAudio.playLaunch();
    else if (button.id === "menu-settings") menuAudio.playTransition();
    else menuAudio.playButton();
  }, true);

  document.getElementById("menu-play")?.addEventListener("click", startSoloBattle);
  document.getElementById("menu-online")?.addEventListener("click", openLobby);
  document.getElementById("menu-settings")?.addEventListener("click", () => setGameMenuOpen(true));

  return { setGameScreen, startSoloBattle };
}
