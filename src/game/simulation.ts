import { STARTER_DECK } from "./cards";
import { chooseBotAction } from "./bot";
import { updateUnits } from "./combat";
import { updateTowers } from "./towerCombat";
import { playCard } from "./deployment";
import { updateEffects } from "./effects";
import { updateProjectiles } from "./projectiles";
import { MATCH_RULES } from "./matchRules";
import {
  addEvent,
  FIELD_HEIGHT,
  KING_TOWER_Y,
  LANE_X,
  MAX_ELIXIR,
  PRINCESS_TOWER_Y,
  nextRandom
} from "./state";
import type { GameState, Side, SideState, Tower } from "./types";

function makeSideState(): SideState {
  return {
    elixir: 5,
    hand: STARTER_DECK.slice(0, 4),
    drawPile: STARTER_DECK.slice(4),
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
    radius: king ? 60 : 45,
    damage: king ? 92 : 76,
    range: king ? 275 : 245,
    attackInterval: king ? 0.95 : 1.05,
    attackCooldown: 0.3,
    activated: false
  });
}

export function createGame(seed = 20261115): GameState {
  const safeSeed = seed >>> 0;
  const state: GameState = {
    time: 0,
    phase: "regulation",
    overtimeStartCrowns: null,
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
    events: ["Both commanders are ready."],
    audioEvents: []
  };

  addTower(state, "red", "princess", "left", LANE_X.left, PRINCESS_TOWER_Y);
  addTower(state, "red", "princess", "right", LANE_X.right, PRINCESS_TOWER_Y);
  addTower(state, "red", "king", "center", 270, KING_TOWER_Y);
  addTower(state, "blue", "princess", "left", LANE_X.left, FIELD_HEIGHT - PRINCESS_TOWER_Y);
  addTower(state, "blue", "princess", "right", LANE_X.right, FIELD_HEIGHT - PRINCESS_TOWER_Y);
  addTower(state, "blue", "king", "center", 270, FIELD_HEIGHT - KING_TOWER_Y);

  return state;
}

function crownCount(state: GameState, side: Side): number {
  return state.towers.filter((tower) =>
    tower.side !== side && tower.kind === "princess" && tower.hp <= 0
  ).length;
}

function finishGame(state: GameState, winner: Side | "draw", message: string): void {
  state.gameOver = true;
  state.phase = "finished";
  state.winner = winner;
  if (winner === "draw") state.audioEvents.push("match-draw");
  else state.audioEvents.push(winner === "blue" ? "match-victory" : "match-defeat");
  addEvent(state, message);
}

function beginOvertime(state: GameState): void {
  state.phase = "overtime";
  state.audioEvents.push("overtime-start");
  state.overtimeStartCrowns = {
    blue: crownCount(state, "blue"),
    red: crownCount(state, "red")
  };
  addEvent(state, "Overtime! The first tower destroyed wins.");
}

function beginTiebreaker(state: GameState): void {
  state.phase = "tiebreaker";
  state.units = [];
  state.projectiles = [];
  state.effects = [];
  addEvent(state, "Tiebreaker! All remaining towers are taking damage.");
}

function checkGameEnd(state: GameState): void {
  const blueKing = state.towers.find((tower) => tower.side === "blue" && tower.kind === "king");
  const redKing = state.towers.find((tower) => tower.side === "red" && tower.kind === "king");

  if (blueKing && blueKing.hp <= 0) {
    finishGame(state, "red", "Red wins by destroying the King Tower!");
    return;
  }

  if (redKing && redKing.hp <= 0) {
    finishGame(state, "blue", "Blue wins by destroying the King Tower!");
    return;
  }

  if (state.phase === "regulation" && state.time >= MATCH_RULES.regulationSeconds) {
    const blueCrowns = crownCount(state, "blue");
    const redCrowns = crownCount(state, "red");

    if (blueCrowns !== redCrowns) {
      const winner = blueCrowns > redCrowns ? "blue" : "red";
      finishGame(state, winner, `${winner === "blue" ? "Blue" : "Red"} wins on crowns!`);
      return;
    }

    beginOvertime(state);
    return;
  }

  if (state.phase === "overtime") {
    const startCrowns = state.overtimeStartCrowns;
    if (startCrowns) {
      const blueTookTower = crownCount(state, "blue") > startCrowns.blue;
      const redTookTower = crownCount(state, "red") > startCrowns.red;

      if (blueTookTower !== redTookTower) {
        const winner = blueTookTower ? "blue" : "red";
        finishGame(state, winner, `${winner === "blue" ? "Blue" : "Red"} wins in overtime!`);
        return;
      }
    }

    if (state.time >= MATCH_RULES.regulationSeconds + MATCH_RULES.overtimeSeconds) {
      beginTiebreaker(state);
    }

    return;
  }

}

function updateTiebreaker(state: GameState, dt: number): void {
  const damage = MATCH_RULES.tiebreakerDamagePerSecond * dt;
  const lowestBlueTower = Math.min(
    ...state.towers.filter((tower) => tower.side === "blue" && tower.hp > 0).map((tower) => tower.hp)
  );
  const lowestRedTower = Math.min(
    ...state.towers.filter((tower) => tower.side === "red" && tower.hp > 0).map((tower) => tower.hp)
  );
  const blueLoses = lowestBlueTower <= damage;
  const redLoses = lowestRedTower <= damage;

  for (const tower of state.towers) {
    tower.hp = Math.max(0, tower.hp - damage);
  }

  if (blueLoses && redLoses) {
    finishGame(state, "draw", "The tiebreaker ended in a draw.");
  } else if (blueLoses) {
    finishGame(state, "red", "Red wins the tiebreaker!");
  } else if (redLoses) {
    finishGame(state, "blue", "Blue wins the tiebreaker!");
  }
}

function elixirInterval(state: GameState): number {
  if (state.phase === "overtime") {
    const overtimeTime = state.time - MATCH_RULES.regulationSeconds;
    return overtimeTime >= MATCH_RULES.overtimeTripleElixirStartsAt
      ? 2.8 / 3
      : 2.8 / 2;
  }

  return state.time >= MATCH_RULES.doubleElixirStartsAt ? 2.8 / 2 : 2.8;
}

function emitCountdownEvents(
  state: GameState,
  previousTime: number,
  currentTime: number,
  endTime: number
): void {
  for (let seconds = 10; seconds >= 1; seconds -= 1) {
    const triggerTime = endTime - seconds;
    if (previousTime < triggerTime && currentTime >= triggerTime) {
      state.audioEvents.push(`countdown-${seconds}` as import("./types").AudioEvent);
    }
  }
}

export function stepGame(
  state: GameState,
  dt: number,
  botSide: Side | null = null,
  disableBots = false
): void {
  if (state.gameOver) return;

  state.audioEvents = [];
  const previousTime = state.time;
  state.time += dt;

  if (state.phase === "regulation") {
    emitCountdownEvents(state, previousTime, state.time, MATCH_RULES.regulationSeconds);
  } else if (state.phase === "overtime") {
    emitCountdownEvents(
      state,
      previousTime,
      state.time,
      MATCH_RULES.regulationSeconds + MATCH_RULES.overtimeSeconds
    );
  }

  if (
    previousTime < MATCH_RULES.doubleElixirStartsAt
    && state.time >= MATCH_RULES.doubleElixirStartsAt
  ) {
    state.audioEvents.push("double-elixir");
  }

  const tripleElixirStartsAt =
    MATCH_RULES.regulationSeconds + MATCH_RULES.overtimeTripleElixirStartsAt;
  if (previousTime < tripleElixirStartsAt && state.time >= tripleElixirStartsAt) {
    state.audioEvents.push("triple-elixir");
  }

  if (state.phase === "tiebreaker") {
    updateTiebreaker(state, dt);
    return;
  }

  const regenerationInterval = elixirInterval(state);

  for (const side of ["blue", "red"] as const) {
    const runtime = state.sides[side];
    runtime.elixir = Math.min(MAX_ELIXIR, runtime.elixir + dt / regenerationInterval);
    if (disableBots || (botSide !== null && side !== botSide)) continue;

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
    unit.health.hp > 0
    && unit.transform.x > -40
    && unit.transform.x < 760
    && unit.transform.y > -40
    && unit.transform.y < 1000
  );

  checkGameEnd(state);
}

export const SIMULATION_STEP = 1 / 30;
