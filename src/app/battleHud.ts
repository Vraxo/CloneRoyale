import type { CardId, GameState, Side } from "../game/types";
import type { ArenaRenderer } from "../render/arenaRenderer";

interface HudElements {
  pauseButton: HTMLButtonElement;
  stepBackButton: HTMLButtonElement;
  statusLabel: HTMLSpanElement;
  blueUnitsLabel: HTMLSpanElement;
  redUnitsLabel: HTMLSpanElement;
  blueTowersLabel: HTMLSpanElement;
  redTowersLabel: HTMLSpanElement;
  bluePlayedLabel: HTMLSpanElement;
  redPlayedLabel: HTMLSpanElement;
  eventFeed: HTMLOListElement;
  matchResult: HTMLDivElement;
  resultTitle: HTMLHeadingElement;
  resultSummary: HTMLParagraphElement;
}

export interface BattleHud {
  update(game: GameState, selectedCard: CardId | null, paused: boolean, placementMessage: string, canStepBack: boolean): void;
  setPaused(paused: boolean, game: GameState): void;
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error("Missing required element: #" + id);
  return found as T;
}

function findElements(): HudElements {
  return {
    pauseButton: element<HTMLButtonElement>("pause"),
    stepBackButton: element<HTMLButtonElement>("step-back"),
    statusLabel: element<HTMLSpanElement>("match-status"),
    blueUnitsLabel: element<HTMLSpanElement>("blue-units"),
    redUnitsLabel: element<HTMLSpanElement>("red-units"),
    blueTowersLabel: element<HTMLSpanElement>("blue-towers"),
    redTowersLabel: element<HTMLSpanElement>("red-towers"),
    bluePlayedLabel: element<HTMLSpanElement>("blue-played"),
    redPlayedLabel: element<HTMLSpanElement>("red-played"),
    eventFeed: element<HTMLOListElement>("event-feed"),
    matchResult: element<HTMLDivElement>("match-result"),
    resultTitle: element<HTMLHeadingElement>("result-title"),
    resultSummary: element<HTMLParagraphElement>("result-summary")
  };
}

export function phaseLabel(state: GameState): string {
  switch (state.phase) {
    case "regulation": return "Regulation";
    case "overtime": return "Overtime";
    case "tiebreaker": return "Tiebreaker";
    case "finished": return "Battle complete";
  }
}

function towerHealth(game: GameState, side: Side): number {
  return game.towers.filter((tower) => tower.side === side && tower.hp > 0).length;
}

function crownCount(game: GameState, side: Side): number {
  const enemyKing = game.towers.find((tower) => tower.side !== side && tower.kind === "king");
  if (enemyKing && enemyKing.hp <= 0) return 3;

  return game.towers.filter((tower) =>
    tower.side !== side && tower.kind === "princess" && tower.hp <= 0
  ).length;
}

function updateStatistics(elements: HudElements, game: GameState): void {
  const blue = game.sides.blue;
  const red = game.sides.red;

  elements.blueUnitsLabel.textContent = game.units.filter((unit) => unit.side === "blue").length.toString();
  elements.redUnitsLabel.textContent = game.units.filter((unit) => unit.side === "red").length.toString();
  elements.blueTowersLabel.textContent = towerHealth(game, "blue").toString();
  elements.redTowersLabel.textContent = towerHealth(game, "red").toString();
  elements.bluePlayedLabel.textContent = blue.cardsPlayed.toString();
  elements.redPlayedLabel.textContent = red.cardsPlayed.toString();
}

function updateEventFeed(elements: HudElements, game: GameState): void {
  elements.eventFeed.replaceChildren(...game.events.map((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    return item;
  }));
}

function updateMatchResult(elements: HudElements, game: GameState, paused: boolean): void {
  if (!game.gameOver) {
    if (!paused) elements.statusLabel.textContent = phaseLabel(game);
    elements.matchResult.hidden = true;
    return;
  }

  elements.statusLabel.textContent = game.winner === "draw"
    ? "Draw"
    : (game.winner === "blue" ? "Blue" : "Red") + " wins";
  elements.resultTitle.textContent = game.winner === "draw"
    ? "Draw"
    : game.winner === "blue" ? "Victory" : "Defeat";
  elements.resultSummary.textContent = "Crowns " + crownCount(game, "blue") + " – " + crownCount(game, "red");
  elements.matchResult.hidden = false;
}

function placementStatus(game: GameState, paused: boolean, placementMessage: string): string {
  if (game.gameOver) return "Match complete.";
  if (paused) return "Resume to continue playing.";
  return placementMessage;
}

export function createBattleHud(renderer: ArenaRenderer): BattleHud {
  const elements = findElements();

  return {
    setPaused(paused, game): void {
      elements.pauseButton.innerHTML = paused ? "▶ &nbsp; Resume" : "Ⅱ &nbsp; Pause";
      elements.statusLabel.textContent = game.gameOver
        ? phaseLabel(game)
        : paused ? "Paused" : phaseLabel(game);
    },

    update(game, selectedCard, paused, placementMessage, canStepBack): void {
      elements.stepBackButton.disabled = !canStepBack || game.gameOver;

      updateStatistics(elements, game);
      updateEventFeed(elements, game);
      updateMatchResult(elements, game, paused);

      renderer.updateBattleHud(game, selectedCard, placementStatus(game, paused, placementMessage));
    }
  };
}
