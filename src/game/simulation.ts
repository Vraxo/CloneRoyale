import { STARTER_DECK } from "./cards";
import { chooseBotAction } from "./bot";
import { updateUnits, updateTowers } from "./combat";
import { playCard } from "./deployment";
import { updateEffects } from "./effects";
import { updateProjectiles } from "./projectiles";
import {
  addEvent,
  LANE_X,
  MATCH_LENGTH,
  MAX_ELIXIR,
  nextRandom
} from "./state";
import type { GameState, Side, SideState, Tower } from "./types";

function makeSideState(): SideState {
  return {
    elixir: 5,
    hand: STARTER_DECK.slice(0, 4),
    drawPile: [...STARTER_DECK],
    drawIndex: 4,
    thinkIn: 0.55,
    cardsPlayed: 0
  };
}

function addTower(
  state: GameState,
  side: Side,
  kind: Tower["kind"],
  lane: Tower["lane"],
  x: number,
  y: number
): void {
  const king = kind === "king";
  state.towers.push({
    id: state.nextId++,
    side,
    kind,
    lane,
    x,
    y,
    hp: king ? 2800 : 1650,
    maxHp: king ? 2800 : 1650,
    radius: king ? 27 : 23,
    damage: king ? 92 : 76,
    range: king ? 275 : 245,
    attackInterval: king ? 0.95 : 1.05,
    attackCooldown: 0.3
  });
}

export function createGame(seed = 20261115): GameState {
  const safeSeed = seed >>> 0;
  const state: GameState = {
    time: 0,
    gameOver: false,
    winner: null,
    units: [],
    towers: [],
    projectiles: [],
    effects: [],
    sides: {
      blue: makeSideState(),
      red: makeSideState()
    },
    nextId: 1,
    seed: safeSeed === 0 ? 1 : safeSeed,
    events: ["Both commanders are ready."]
  };

  addTower(state, "red", "princess", "left", LANE_X.left, 150);
  addTower(state, "red", "princess", "right", LANE_X.right, 150);
  addTower(state, "red", "king", "center", 360, 78);
  addTower(state, "blue", "princess", "left", LANE_X.left, 810);
  addTower(state, "blue", "princess", "right", LANE_X.right, 810);
  addTower(state, "blue", "king", "center", 360, 882);

  return state;
}

function checkGameEnd(state: GameState): void {
  const blueKing = state.towers.find((tower) => tower.side === "blue" && tower.kind === "king");
  const redKing = state.towers.find((tower) => tower.side === "red" && tower.kind === "king");

  if (blueKing && blueKing.hp <= 0) {
    state.gameOver = true;
    state.winner = "red";
  } else if (redKing && redKing.hp <= 0) {
    state.gameOver = true;
    state.winner = "blue";
  } else if (state.time >= MATCH_LENGTH) {
    const blueHp = state.towers
      .filter((tower) => tower.side === "blue")
      .reduce((sum, tower) => sum + tower.hp, 0);
    const redHp = state.towers
      .filter((tower) => tower.side === "red")
      .reduce((sum, tower) => sum + tower.hp, 0);

    state.gameOver = true;
    state.winner = blueHp === redHp ? "draw" : blueHp > redHp ? "blue" : "red";
  }

  if (state.gameOver) {
    const result = state.winner === "draw"
      ? "The battle ended in a draw."
      : `${state.winner === "blue" ? "Blue" : "Red"} wins the battle!`;
    addEvent(state, result);
  }
}

export function stepGame(state: GameState, dt: number): void {
  if (state.gameOver) return;

  state.time += dt;
  const elixirInterval = state.time >= 120 ? 1.4 : 2.8;

  for (const side of ["blue", "red"] as const) {
    const runtime = state.sides[side];
    runtime.elixir = Math.min(MAX_ELIXIR, runtime.elixir + dt / elixirInterval);
    runtime.thinkIn -= dt;

    if (runtime.thinkIn <= 0) {
      runtime.thinkIn = 0.75 + nextRandom(state) * 0.3;
      const decision = chooseBotAction(state, side);
      if (decision) {
        playCard(state, side, decision.cardId, decision.lane, decision.targetX, decision.targetY);
      }
    }
  }

  updateUnits(state, dt);
  updateTowers(state, dt);
  updateProjectiles(state, dt);
  updateEffects(state, dt);

  state.units = state.units.filter((unit) =>
    unit.hp > 0
    && unit.x > -40
    && unit.x < 760
    && unit.y > -40
    && unit.y < 1000
  );

  checkGameEnd(state);
}

export const SIMULATION_STEP = 1 / 30;
