import { createBattleMusic } from "./audio/battleMusic";
import { createSoundEffects } from "./audio/soundEffects";
import { ArenaRenderer } from "./render/arenaRenderer";
import { createGame, SIMULATION_STEP, stepGame } from "./game/simulation";
import { MATCH_RULES } from "./game/matchRules";
import { createGameHistory } from "./game/history";
import { CARDS, cardById } from "./game/cards";
import { canPlaceCard, playCard } from "./game/deployment";
import type { CardId, GameState, Lane, Side } from "./game/types";
import "./style.css";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing required element: #${id}`);
  return found as T;
}

const host = element<HTMLDivElement>("game");
const renderer = new ArenaRenderer();
const music = createBattleMusic();
const soundEffects = createSoundEffects();
document.addEventListener("pointerdown", () => soundEffects.unlock(), { capture: true, once: true });
document.addEventListener("keydown", () => soundEffects.unlock(), { capture: true, once: true });

let game: GameState = createGame(Date.now() >>> 0);
const history = createGameHistory(game);
let paused = false;
let speed = 1;
let accumulator = 0;
let lastHudUpdate = 0;
let previousGameOver = false;
let selectedCard: CardId | null = null;
let handSignature = "";
let placementMessage = "Choose a card, then deploy on your side.";

await renderer.initialize(host);

const pauseButton = element<HTMLButtonElement>("pause");
const speedButton = element<HTMLButtonElement>("speed");
const stepBackButton = element<HTMLButtonElement>("step-back");
const musicButton = element<HTMLButtonElement>("music");
const soundEffectsButton = element<HTMLButtonElement>("sound-effects");
const statusLabel = element<HTMLSpanElement>("match-status");
const clockLabel = element<HTMLSpanElement>("match-clock");
const cardHand = element<HTMLDivElement>("card-hand");
const placementHint = element<HTMLParagraphElement>("placement-hint");
const matchResult = element<HTMLDivElement>("match-result");

function phaseLabel(state: GameState): string {
  switch (state.phase) {
    case "regulation":
      return "Regulation";
    case "overtime":
      return "Overtime";
    case "tiebreaker":
      return "Tiebreaker";
    case "finished":
      return "Battle complete";
  }
}

function formatClock(seconds: number): string {
  const remaining = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const rest = (remaining % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function setPaused(value: boolean): void {
  paused = value;
  pauseButton.innerHTML = paused ? "▶ &nbsp; Resume" : "Ⅱ &nbsp; Pause";
  statusLabel.textContent = game.gameOver
    ? phaseLabel(game)
    : paused ? "Paused" : phaseLabel(game);
  music.setPaused(paused || game.gameOver);
  if (paused) renderer.setPlacementPreview(null);
}

function startNewBattle(): void {
  soundEffects.stopAll();
  game = createGame((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0);
  selectedCard = null;
  handSignature = "";
  placementMessage = "Choose a card, then deploy on your side.";
  renderer.setPlacementPreview(null);
  accumulator = 0;
  history.reset(game);
  previousGameOver = false;
  setPaused(false);
  music.start(game.time);
  renderer.render(game);
  updateHud();
}

function towerHealth(state: GameState, side: Side): number {
  return state.towers.filter((tower) => tower.side === side && tower.hp > 0).length;
}

function crownCount(state: GameState, side: Side): number {
  return state.towers.filter((tower) =>
    tower.side !== side && tower.kind === "princess" && tower.hp <= 0
  ).length;
}

function selectCard(cardId: CardId): void {
  if (paused || game.gameOver) return;

  if (selectedCard === cardId) {
    selectedCard = null;
    placementMessage = "Choose a card, then deploy on your side.";
  } else {
    const card = cardById(cardId);
    if (game.sides.blue.elixir < card.cost) {
      placementMessage = `You need ${card.cost} elixir to play ${card.name}.`;
      updateHud();
      return;
    }

    selectedCard = cardId;
    placementMessage = card.category === "spell"
      ? `Click anywhere on the arena to cast ${card.name}.`
      : `Place ${card.name} anywhere on your side of the river.`;
  }

  renderer.setPlacementPreview(null);
  updateHud();
}

function renderHand(): void {
  const blue = game.sides.blue;
  const signature = blue.hand.join("|");

  if (signature !== handSignature) {
    cardHand.replaceChildren(...blue.hand.map((cardId) => {
      const card = cardById(cardId);
      const button = document.createElement("button");
      const name = document.createElement("span");
      const cost = document.createElement("span");

      button.type = "button";
      button.className = "hand-card";
      button.dataset.cardId = cardId;
      button.setAttribute("aria-label", `${card.name}, ${card.cost} elixir`);
      name.className = "hand-card-name";
      name.textContent = card.name;
      cost.className = "hand-card-cost";
      cost.textContent = card.cost.toString();
      button.append(name, cost);
      button.addEventListener("click", () => selectCard(cardId));
      return button;
    }));

    handSignature = signature;
  }

  for (const button of cardHand.querySelectorAll<HTMLButtonElement>(".hand-card")) {
    const cardId = button.dataset.cardId as CardId;
    const card = cardById(cardId);
    button.disabled = paused || game.gameOver || blue.elixir < card.cost;
    button.classList.toggle("is-selected", selectedCard === cardId);
    button.setAttribute("aria-pressed", (selectedCard === cardId).toString());
  }

  const nextCardId = blue.drawPile[blue.drawIndex % blue.drawPile.length];
  element<HTMLSpanElement>("next-card").textContent = cardById(nextCardId).name;
  placementHint.textContent = game.gameOver
    ? "The match is over."
    : paused ? "Resume the match to deploy cards." : placementMessage;
}

function updateHud(): void {
  stepBackButton.disabled = !history.canStepBack() || game.gameOver;

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

  element<HTMLSpanElement>("blue-elixir").textContent = blue.elixir.toFixed(1);
  element<HTMLSpanElement>("red-elixir").textContent = red.elixir.toFixed(1);
  element<HTMLElement>("blue-elixir-bar").style.width = `${blue.elixir * 10}%`;
  element<HTMLElement>("red-elixir-bar").style.width = `${red.elixir * 10}%`;
  element<HTMLSpanElement>("blue-units").textContent = game.units.filter((unit) => unit.side === "blue").length.toString();
  element<HTMLSpanElement>("red-units").textContent = game.units.filter((unit) => unit.side === "red").length.toString();
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
      : `${game.winner === "blue" ? "Victory" : "Defeat"}`;
    element<HTMLParagraphElement>("result-summary").textContent =
      `Crowns ${crownCount(game, "blue")} – ${crownCount(game, "red")}`;
    matchResult.hidden = false;
  } else {
    if (!paused) statusLabel.textContent = phaseLabel(game);
    matchResult.hidden = true;
  }

  renderHand();
}

function playSelectedCardAt(clientX: number, clientY: number): void {
  if (paused || game.gameOver) return;

  const point = renderer.screenToWorld(clientX, clientY);
  if (!point) return;

  if (!selectedCard) {
    placementMessage = "Select a card first.";
    updateHud();
    return;
  }

  const cardId = selectedCard;
  if (!canPlaceCard(game, "blue", cardId, point.x, point.y)) {
    placementMessage = cardById(cardId).category === "spell"
      ? "That spell target is outside the arena or the card is unavailable."
      : "Invalid deployment. Ground troops and buildings must be placed on your side of the river.";
    updateHud();
    renderer.setPlacementPreview(point, false);
    return;
  }

  const lane: Lane = point.x < 360 ? "left" : "right";
  if (!playCard(game, "blue", cardId, lane, point.x, point.y, point)) {
    placementMessage = "That card can no longer be played.";
    updateHud();
    return;
  }

  for (const event of game.audioEvents) soundEffects.play(event);
  game.audioEvents = [];
  history.record(game);

  selectedCard = null;
  placementMessage = `${cardById(cardId).name} deployed.`;
  renderer.setPlacementPreview(null);
  renderer.render(game);
  updateHud();
}

function updatePlacementPreview(event: PointerEvent): void {
  if (!selectedCard || paused || game.gameOver) {
    renderer.setPlacementPreview(null);
    return;
  }

  const point = renderer.screenToWorld(event.clientX, event.clientY);
  if (!point) {
    renderer.setPlacementPreview(null);
    return;
  }

  const card = cardById(selectedCard);
  const valid = canPlaceCard(game, "blue", selectedCard, point.x, point.y);
  const radius = card.category === "spell"
    ? Math.max(18, Math.min(60, card.effect.radius))
    : Math.max(18, card.unit.radius);
  renderer.setPlacementPreview(point, valid, radius);
}

function advanceOneStep(): void {
  if (game.gameOver) return;

  const previousTime = game.time;
  stepGame(game, SIMULATION_STEP, "red");
  if (game.time === previousTime) return;

  for (const event of game.audioEvents) soundEffects.play(event);
  game.audioEvents = [];
  history.record(game);

  if (game.gameOver) {
    selectedCard = null;
    renderer.setPlacementPreview(null);
    music.stop();
    previousGameOver = true;
    accumulator = 0;
    updateHud();
  }
}

function stepForward(): void {
  advanceOneStep();
  renderer.render(game);
  updateHud();
}

function stepBackward(): void {
  const previousState = history.stepBack();
  if (!previousState) return;

  game = previousState;
  selectedCard = null;
  placementMessage = "Choose a card, then deploy on your side.";
  renderer.setPlacementPreview(null);
  soundEffects.stopAll();
  accumulator = 0;
  setPaused(true);
  previousGameOver = game.gameOver;
  music.seek(game.time);
  music.setPaused(true);
  renderer.render(game);
  updateHud();
}

function bindHoldControl(
  button: HTMLButtonElement,
  action: () => void,
  canRepeat: () => boolean
): void {
  const initialDelay = 300;
  const repeatInterval = 34;
  let delayTimer = 0;
  let repeatTimer = 0;
  let activePointer: number | null = null;

  function stopHolding(): void {
    window.clearTimeout(delayTimer);
    window.clearInterval(repeatTimer);
    delayTimer = 0;
    repeatTimer = 0;
    activePointer = null;
  }

  function repeatAction(): void {
    if (!canRepeat()) {
      stopHolding();
      return;
    }

    action();
  }

  button.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0 || button.disabled || activePointer !== null) return;

    event.preventDefault();
    activePointer = event.pointerId;
    button.setPointerCapture(event.pointerId);
    action();

    delayTimer = window.setTimeout(() => {
      repeatTimer = window.setInterval(repeatAction, repeatInterval);
    }, initialDelay);
  });

  button.addEventListener("pointerup", (event: PointerEvent) => {
    if (event.pointerId === activePointer) stopHolding();
  });

  button.addEventListener("pointercancel", stopHolding);
  button.addEventListener("lostpointercapture", stopHolding);

  button.addEventListener("click", (event: MouseEvent) => {
    if (event.detail === 0 && !button.disabled) action();
  });

  window.addEventListener("blur", stopHolding);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopHolding();
  });
}

element<HTMLButtonElement>("new-battle").addEventListener("click", startNewBattle);
element<HTMLButtonElement>("play-again").addEventListener("click", startNewBattle);
pauseButton.addEventListener("click", () => setPaused(!paused));

const canvas = renderer.app.canvas;
canvas.addEventListener("pointermove", updatePlacementPreview);
canvas.addEventListener("pointerleave", () => renderer.setPlacementPreview(null));
canvas.addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.button !== 0) return;
  playSelectedCardAt(event.clientX, event.clientY);
});

const stepButton = element<HTMLButtonElement>("step");
bindHoldControl(stepButton, stepForward, () => !game.gameOver);
bindHoldControl(stepBackButton, stepBackward, () => history.canStepBack() && !game.gameOver);

speedButton.addEventListener("click", () => {
  const speeds = [0.5, 1, 2, 4, 8];
  const currentIndex = speeds.indexOf(speed);
  speed = speeds[(currentIndex + 1) % speeds.length];
  speedButton.textContent = `${speed}×`;
  music.setSpeed(speed);
  soundEffects.setSpeed(speed);
});

soundEffectsButton.addEventListener("click", () => {
  soundEffects.unlock();
  const enabled = soundEffectsButton.getAttribute("aria-pressed") !== "true";
  soundEffectsButton.setAttribute("aria-pressed", enabled.toString());
  soundEffectsButton.textContent = enabled ? "On" : "Off";
  soundEffects.setEnabled(enabled);
});

musicButton.addEventListener("click", () => {
  const enabled = musicButton.getAttribute("aria-pressed") !== "true";
  musicButton.setAttribute("aria-pressed", enabled.toString());
  musicButton.textContent = enabled ? "On" : "Off";
  music.setEnabled(enabled);
});

renderer.app.ticker.add((ticker) => {
  const elapsed = Math.min(ticker.deltaMS / 1000, 0.1);

  if (!paused && !game.gameOver) {
    accumulator += elapsed * speed;
    while (accumulator >= SIMULATION_STEP) {
      advanceOneStep();
      accumulator -= SIMULATION_STEP;
      if (game.gameOver) break;
    }
  }

  if (game.gameOver && !previousGameOver) {
    music.stop();
  }
  previousGameOver = game.gameOver;

  renderer.render(game);

  const now = performance.now();
  if (now - lastHudUpdate >= 150) {
    updateHud();
    lastHudUpdate = now;
  }
});

music.start(game.time);
renderer.render(game);
updateHud();
