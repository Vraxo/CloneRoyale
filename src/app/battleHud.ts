import { MATCH_RULES } from "../game/matchRules";
import type { GameState, Side } from "../game/types";
import type { ArenaRenderer } from "../render/arenaRenderer";
import type { GameHistory } from "../game/history";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing required element: #${id}`);
  return found as T;
}

export function phaseLabel(state: GameState): string {
  switch (state.phase) {
    case "regulation": return "Regulation";
    case "overtime": return "Overtime";
    case "tiebreaker": return "Tiebreaker";
    case "finished": return "Battle complete";
  }
}

function formatClock(seconds: number): string {
  const remaining = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const rest = (remaining % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function towerHealth(state: GameState, side: Side): number {
  return state.towers.filter((tower) => tower.side === side && tower.hp > 0).length;
}

function crownCount(state: GameState, side: Side): number {
  const enemyKing = state.towers.find((tower) =>
    tower.side !== side && tower.kind === "king"
  );
  if (enemyKing && enemyKing.hp <= 0) return 3;

  return state.towers.filter((tower) =>
    tower.side !== side && tower.kind === "princess" && tower.hp <= 0
  ).length;
}

export interface BattleHud {
  update(
    game: GameState,
    selectedCard: import("../game/types").CardId | null,
    paused: boolean,
    placementMessage: string,
    canStepBack: boolean
  ): void;
  setPaused(paused: boolean, game: GameState): void;
}

export function createBattleHud(renderer: ArenaRenderer): BattleHud {
  const pauseButton = element<HTMLButtonElement>("pause");
  const statusLabel = element<HTMLSpanElement>("match-status");
  const clockLabel = element<HTMLSpanElement>("match-clock");
  const matchResult = element<HTMLDivElement>("match-result");

  return {
    setPaused(paused, game): void {
      pauseButton.innerHTML = paused ? "▶ &nbsp; Resume" : "Ⅱ &nbsp; Pause";
      statusLabel.textContent = game.gameOver
        ? phaseLabel(game)
        : paused ? "Paused" : phaseLabel(game);
    },

    update(game, selectedCard, paused, placementMessage, canStepBack): void {
      element<HTMLButtonElement>("step-back").disabled = !canStepBack || game.gameOver;

      const blue = game.sides.blue;
      const red = game.sides.red;

      if (game.phase === "regulation") {
        clockLabel.textContent = formatClock(MATCH_RULES.regulationSeconds - game.time);
      } else if (game.phase === "overtime") {
        clockLabel.textContent = formatClock(
          MATCH_RULES.regulationSeconds + MATCH_RULES.overtimeSeconds - game.time
        );
      } else if (game.phase === "tiebreaker") {
        clockLabel.textContent = "TIE";
      } else {
        clockLabel.textContent = "00:00";
      }

      element<HTMLSpanElement>("blue-units").textContent =
        game.units.filter((unit) => unit.side === "blue").length.toString();
      element<HTMLSpanElement>("red-units").textContent =
        game.units.filter((unit) => unit.side === "red").length.toString();
      element<HTMLSpanElement>("blue-towers").textContent = towerHealth(game, "blue").toString();
      element<HTMLSpanElement>("red-towers").textContent = towerHealth(game, "red").toString();
      element<HTMLSpanElement>("blue-played").textContent = blue.cardsPlayed.toString();
      element<HTMLSpanElement>("red-played").textContent = red.cardsPlayed.toString();

      const feed = element<HTMLOListElement>("event-feed");
      feed.replaceChildren(...game.events.map((message) => {
        const item = document.createElement("li");
        item.textContent = message;
        return item;
      }));

      if (game.gameOver) {
        statusLabel.textContent = game.winner === "draw"
          ? "Draw"
          : `${game.winner === "blue" ? "Blue" : "Red"} wins`;
        element<HTMLHeadingElement>("result-title").textContent = game.winner === "draw"
          ? "Draw"
          : game.winner === "blue" ? "Victory" : "Defeat";
        element<HTMLParagraphElement>("result-summary").textContent =
          `Crowns ${crownCount(game, "blue")} – ${crownCount(game, "red")}`;
        matchResult.hidden = false;
      } else {
        if (!paused) statusLabel.textContent = phaseLabel(game);
        matchResult.hidden = true;
      }

      renderer.updateBattleHud(
        game,
        selectedCard,
        game.gameOver ? "Match complete."
          : paused ? "Resume to continue playing." : placementMessage
      );
    }
  };
}
