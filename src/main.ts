import { createBattleMusic } from "./audio/battleMusic";
import { ArenaRenderer } from "./render/arenaRenderer";
import { createGame, SIMULATION_STEP, stepGame } from "./game/simulation";
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

function setPaused(value: boolean): void {
  paused = value;
  pauseButton.innerHTML = paused ? "▶ &nbsp; Resume" : "Ⅱ &nbsp; Pause";
  statusLabel.textContent = game.gameOver ? "Battle complete" : paused ? "Paused" : "Live simulation";
  music.setPaused(paused || game.gameOver);
}

function startNewBattle(): void {
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
  const clock = Math.floor(game.time);
  const minutes = Math.floor(clock / 60).toString().padStart(2, "0");
  const seconds = (clock % 60).toString().padStart(2, "0");

  element<HTMLSpanElement>("match-clock").textContent = `${minutes}:${seconds}`;
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
    statusLabel.textContent = "Live simulation";
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

element<HTMLButtonElement>("step").addEventListener("click", () => {
  advanceOneStep();
  renderer.render(game);
  updateHud();
});

stepBackButton.addEventListener("click", () => {
  const previousState = history.stepBack();
  if (!previousState) return;

  game = previousState;
  accumulator = 0;
  setPaused(true);
  previousGameOver = game.gameOver;
  music.seek(game.time);
  music.setPaused(true);
  renderer.render(game);
  updateHud();
});
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
