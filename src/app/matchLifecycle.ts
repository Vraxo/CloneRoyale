import type { BattleController } from "./battleController";

type MatchLifecycleOptions = {
  battle: BattleController;
  unsubscribe: () => void;
  resetEmotes: () => void;
  getPlayerName: () => string;
  resetOpponent: () => void;
  hideLobby: () => void;
  setGameScreen: (screen: "home" | "battle") => void;
};

export function initializeMatchLifecycle(options: MatchLifecycleOptions) {
  const { battle, unsubscribe, resetEmotes, getPlayerName, resetOpponent, hideLobby, setGameScreen } = options;
  const playAgainButton = document.getElementById("play-again");
  const modeDescription = document.getElementById("mode-description");
  const overlay = document.getElementById("reconnect-overlay");
  const title = document.getElementById("reconnect-title");
  const description = document.getElementById("reconnect-description");
  const spinner = document.getElementById("reconnect-spinner");
  const leaveReconnect = document.getElementById("reconnect-leave");

  function setReconnectOverlay(visible: boolean, expired = false): void {
    if (!(overlay instanceof HTMLDivElement)) return;
    overlay.hidden = !visible;
    if (title) title.textContent = expired ? "Match unavailable" : "Reconnecting…";
    if (description) description.textContent = expired
      ? "The server could not restore your previous match. You can return to the main menu."
      : "Your match is being kept while we restore the connection. Please keep this screen open.";
    if (spinner instanceof HTMLElement) spinner.hidden = expired;
    if (leaveReconnect instanceof HTMLButtonElement) leaveReconnect.hidden = !expired;
  }

  function leaveOnlineMatch(): void {
    setReconnectOverlay(false);
    resetEmotes();
    unsubscribe();
    battle.leaveOnline();
    resetOpponent();
    if (modeDescription) modeDescription.textContent = getPlayerName() + " · Live match";
    hideLobby();
    if (playAgainButton instanceof HTMLButtonElement) {
      playAgainButton.disabled = false;
      playAgainButton.textContent = "Play again";
    }
  }

  leaveReconnect?.addEventListener("click", () => {
    if (battle.isOnline) leaveOnlineMatch();
    setGameScreen("home");
  });
  document.getElementById("leave-online")?.addEventListener("click", leaveOnlineMatch);
  document.getElementById("leave-result")?.addEventListener("click", leaveOnlineMatch);
  document.getElementById("return-main-menu")?.addEventListener("click", () => {
    if (battle.isOnline) leaveOnlineMatch();
    else battle.setPaused(true);
    setGameScreen("home");
  });

  return { leaveOnlineMatch, setReconnectOverlay };
}
