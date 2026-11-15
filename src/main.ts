import { createBattleMusic } from "./audio/battleMusic";
import { ArenaRenderer } from "./render/arenaRenderer";
import { createGame, SIMULATION_STEP, stepGame } from "./game/simulation";
import { MATCH_RULES } from "./game/matchRules";
import { createGameHistory } from "./game/history";
import type { GameState, Side } from "./game/types";
import "./style.css";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing required element: #${id}`);
  return found as T;
}

const host = element<HTMLDivElement>("game");
const renderer = new ArenaRenderer();
const music = createBattleMusic();
let game: GameState = createGame(Date.now() >>> 0);
const history = createGameHistory(game);
let paused = false;
let speed = 1;
let accumulator = 0;
let lastHudUpdate = 0;
let previousGameOver = false;

await renderer.initialize(host);

const pauseButton = element<HTMLButtonElement>("pause");
const speedButton = element<HTMLButtonElement>("speed");
const stepBackButton = element<HTMLButtonElement>("step-back");
const musicButton = element<HTMLButtonElement>("music");
const statusLabel = element<HTMLSpanElement>("match-status");
const clockLabel = element<HTMLSpanElement>("match-clock");

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
}

function startNewBattle(): void {
  soundEffects.stopAll();
  game = createGame((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0);
  accumulator = 0;
  history.reset(game);
  previousGameOver = false;
  setPaused(false);
  music.start(game.time);
  updateHud();
}

function towerHealth(state: GameState, side: Side): number {
  return state.towers.filter((tower) => tower.side === side && tower.hp > 0).length;
}

function updateHud(): void {
  stepBackButton.disabled = !history.canStepBack();

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
  } else if (!paused) {
    statusLabel.textContent = phaseLabel(game);
  }
}

element<HTMLButtonElement>("new-battle").addEventListener("click", startNewBattle);
pauseButton.addEventListener("click", () => setPaused(!paused));
function advanceOneStep(): void {
  if (game.gameOver) return;

  const previousTime = game.time;
  stepGame(game, SIMULATION_STEP);
  if (game.time === previousTime) return;

  history.record(game);

  if (game.gameOver) {
    music.stop();
    previousGameOver = true;
    accumulator = 0;
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

const stepButton = element<HTMLButtonElement>("step");
bindHoldControl(stepButton, stepForward, () => !game.gameOver);
bindHoldControl(stepBackButton, stepBackward, () => history.canStepBack());
speedButton.addEventListener("click", () => {
  const speeds = [0.5, 1, 2, 4, 8];
  const currentIndex = speeds.indexOf(speed);
  speed = speeds[(currentIndex + 1) % speeds.length];
  speedButton.textContent = `${speed}×`;
  music.setSpeed(speed);
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
updateHud();
