import type { BattleReplay } from "../game/replay";
import type { PublicReplaySummary } from "./replayLibraryApi";

export type ReplayAction = { label: string; run: () => void | Promise<void> };

export function createReplayRow(title: string, subtitle: string, actions: ReplayAction[], onError: (error: unknown) => void): HTMLElement {
  const row = document.createElement("article");
  row.className = "replay-row";
  const details = document.createElement("div");
  details.className = "replay-row-details";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const description = document.createElement("span");
  description.textContent = subtitle;
  details.append(heading, description);
  const controls = document.createElement("div");
  controls.className = "replay-row-actions";

  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button";
    button.textContent = action.label;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try { await action.run(); }
      catch (error) { onError(error); }
      finally { button.disabled = false; }
    });
    controls.append(button);
  }

  row.append(details, controls);
  return row;
}

export function createReplayEmptyState(message: string): HTMLElement {
  const empty = document.createElement("p");
  empty.className = "replay-empty";
  empty.textContent = message;
  return empty;
}

export function formatReplayDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
}

export function replayResultLabel(winner: BattleReplay["winner"]): string {
  if (winner === "draw") return "DRAW";
  if (winner === "blue") return "BLUE VICTORY";
  if (winner === "red") return "RED VICTORY";
  return "MATCH";
}

export function describeLocalReplay(replay: BattleReplay): string {
  const players = replay.players ? replay.players.blue + " vs " + replay.players.red
    : replay.mode === "online" ? "Multiplayer match" : "Solo match";
  return players + " · " + replayResultLabel(replay.winner) + " · "
    + formatReplayDuration(replay.durationTicks / 30) + " · " + new Date(replay.createdAt).toLocaleString();
}

export function describePublicReplay(replay: PublicReplaySummary): string {
  return replay.players.blue + " vs " + replay.players.red + " · " + replayResultLabel(replay.winner)
    + " · " + formatReplayDuration(replay.durationSeconds) + " · " + new Date(replay.createdAt).toLocaleString();
}
