import type { BattleController } from "./battleController";

export function initializeDeveloperMode(battle: BattleController, enabled: boolean): void {
  const button = document.getElementById("mode-toggle");
  if (!(button instanceof HTMLButtonElement)) return;

  button.textContent = enabled ? "Player mode" : "Developer tools";
  button.addEventListener("click", () => {
    const nextEnabled = document.body.dataset.mode !== "developer";
    if (nextEnabled) battle.enableDebugTools();
    document.body.dataset.mode = nextEnabled ? "developer" : "player";
    button.textContent = nextEnabled ? "Player mode" : "Developer tools";
  });
}
