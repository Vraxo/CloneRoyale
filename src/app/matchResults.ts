import type { BattleController } from "./battleController";
import type { OnlineClient } from "../net/onlineClient";

type MatchResultsOptions = {
  battle: BattleController;
  client: OnlineClient;
  startSoloBattle: () => void;
  setLobbyStatus: (message: string) => void;
};

export function initializeMatchResults(options: MatchResultsOptions): void {
  const { battle, client, startSoloBattle, setLobbyStatus } = options;
  const playAgainButton = document.getElementById("play-again");

  playAgainButton?.addEventListener("click", () => {
    if (battle.isOnline) {
      client.requestRematch();
      if (playAgainButton instanceof HTMLButtonElement) {
        playAgainButton.disabled = true;
        playAgainButton.textContent = "Waiting for opponent…";
      }
      setLobbyStatus("Rematch requested. Waiting for your opponent…");
    } else {
      startSoloBattle();
    }
  });
}
