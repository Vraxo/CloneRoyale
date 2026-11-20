import assert from "node:assert/strict";
import test from "node:test";
import { STARTER_DECK, cardById } from "../../../src/game/cards.js";
import { playCard } from "../../../src/game/deployment.js";
import { canPlaceCard, snapToArenaTile } from "../../../src/game/placement.js";
import { createGame, stepGame } from "../../../src/game/simulation.js";
import { FIELD_HEIGHT, FIELD_WIDTH } from "../../../src/game/state.js";

test("creates a complete initial arena with two matching sides", () => {
  const game = createGame();

  assert.equal(game.towers.length, 6);
  assert.equal(game.units.length, 0);
  assert.equal(game.time, 0);
  assert.equal(game.phase, "regulation");
  assert.equal(game.gameOver, false);
  assert.deepEqual(game.sides.blue.hand, STARTER_DECK.slice(0, 4));
  assert.deepEqual(game.sides.red.hand, STARTER_DECK.slice(0, 4));
  assert.equal(game.sides.blue.elixir, 5);
  assert.equal(game.sides.red.elixir, 5);
});

test("creates deterministic initial state for a given seed", () => {
  assert.deepEqual(createGame(42), createGame(42));
  assert.notDeepEqual(createGame(42), createGame(43));
});

test("keeps the starter deck at eight unique cards", () => {
  assert.equal(STARTER_DECK.length, 8);
  assert.equal(new Set(STARTER_DECK).size, 8);
  assert.equal(cardById("giant").cost, 5);
});

test("snaps positions to tile centers and clamps them inside the arena", () => {
  assert.deepEqual(snapToArenaTile({ x: 31, y: 61 }), { x: 45, y: 75 });
  assert.deepEqual(snapToArenaTile({ x: -100, y: -100 }), { x: 15, y: 15 });
  assert.deepEqual(snapToArenaTile({ x: 999, y: 999 }), {
    x: FIELD_WIDTH - 15,
    y: FIELD_HEIGHT - 15
  });
});

test("allows ground cards only in the deploying side's available area", () => {
  const game = createGame();
  const giantCard = cardById("giant");
  assert.equal(giantCard.category, "troop");
  if (giantCard.category !== "troop") assert.fail("Giant must be a troop card");
  const giantRadius = giantCard.unit.collision.radius;

  assert.equal(canPlaceCard(game, "blue", "giant", 135, 800), true);
  assert.equal(canPlaceCard(game, "blue", "giant", 135, 160), false);
  assert.equal(canPlaceCard(game, "red", "giant", 135, 160), true);
  assert.equal(canPlaceCard(game, "red", "giant", 135, 800), false);
  assert.ok(giantRadius > 0);
});

test("allows spells on either side of the arena but rejects out-of-bounds targets", () => {
  const game = createGame();
  game.sides.blue.hand.push("fireball");
  game.sides.blue.elixir = 10;

  assert.equal(canPlaceCard(game, "blue", "fireball", 270, 480), true);
  assert.equal(canPlaceCard(game, "blue", "fireball", 11, 480), false);
  assert.equal(canPlaceCard(game, "blue", "fireball", 270, 11), false);
});

test("rejects deployment without enough elixir without mutating the game", () => {
  const game = createGame();
  game.sides.blue.elixir = 4;
  const before = structuredClone(game);

  assert.equal(playCard(game, "blue", "giant", "left"), false);
  assert.deepEqual(game, before);
});

test("deploys a troop, spends elixir, and rotates the hand", () => {
  const game = createGame();

  assert.equal(playCard(game, "blue", "giant", "left"), true);
  assert.equal(game.sides.blue.elixir, 0);
  assert.equal(game.units.length, 1);
  assert.equal(game.units[0].cardId, "giant");
  assert.equal(game.units[0].side, "blue");
  assert.equal(game.sides.blue.cardsPlayed, 1);
  assert.deepEqual(game.sides.blue.hand, [
    "archers",
    "mini-pekka",
    "baby-dragon",
    "skeleton-army"
  ]);
  assert.match(game.events[0], /Blue played Giant/);
});

test("deploys archers using their configured paired formation", () => {
  const game = createGame();

  assert.equal(playCard(game, "blue", "archers", "left"), true);
  assert.equal(game.units.length, 2);
  assert.deepEqual(game.units.map((unit) => unit.kind === "troop" ? unit.movement.formationSlot : null), [-1, 1]);
});

test("configures the arrows spell preview style", () => {
  const card = cardById("arrows");
  assert.equal(card.category, "spell");
  if (card.category !== "spell") assert.fail("Arrows must be a spell card");
  assert.deepEqual(card.preview, { style: "arrows" });
});

test("plays fireball with its configured launch sound", () => {
  const game = createGame();
  game.sides.blue.hand.push("fireball");
  game.sides.blue.elixir = 10;

  assert.equal(playCard(game, "blue", "fireball", "left"), true);
  assert.ok(game.audioEvents.includes("fireball-launch"));
});

test("regenerates elixir and advances the match clock without bot actions", () => {
  const game = createGame();

  stepGame(game, 1, null, true);

  assert.equal(game.time, 1);
  assert.ok(Math.abs(game.sides.blue.elixir - (5 + 1 / 2.8)) < 0.000001);
  assert.ok(Math.abs(game.sides.red.elixir - (5 + 1 / 2.8)) < 0.000001);
  assert.equal(game.sides.blue.cardsPlayed, 0);
  assert.equal(game.sides.red.cardsPlayed, 0);
});

test("transitions from regulation to overtime when crowns are tied", () => {
  const game = createGame();

  stepGame(game, 180, null, true);

  assert.equal(game.phase, "overtime");
  assert.equal(game.gameOver, false);
  assert.deepEqual(game.overtimeStartCrowns, { blue: 0, red: 0 });
  assert.ok(game.audioEvents.includes("overtime-start"));
});

test("ends the game when a king tower is destroyed", () => {
  const game = createGame();
  const redKing = game.towers.find((tower) => tower.side === "red" && tower.kind === "king");
  assert.ok(redKing);
  redKing.hp = 0;

  stepGame(game, 1 / 30, null, true);

  assert.equal(game.gameOver, true);
  assert.equal(game.phase, "finished");
  assert.equal(game.winner, "blue");
});

test("does not advance a game that has already ended", () => {
  const game = createGame();
  game.gameOver = true;
  game.phase = "finished";
  game.winner = "blue";
  const before = structuredClone(game);

  stepGame(game, 10, null, false);

  assert.deepEqual(game, before);
});

test("runs bot decisions deterministically for the same seed", () => {
  const first = createGame(1234);
  const second = createGame(1234);

  stepGame(first, 1, null, false);
  stepGame(second, 1, null, false);

  assert.deepEqual(first, second);
});


test("tiebreaker awards the match to the side whose opponent loses a tower first", () => {
  const game = createGame();
  game.phase = "tiebreaker";

  const bluePrincess = game.towers.find((tower) =>
    tower.side === "blue" && tower.kind === "princess" && tower.lane === "left"
  );
  assert.ok(bluePrincess);
  bluePrincess.hp = 100;

  stepGame(game, 0.1, null, true);

  assert.equal(game.gameOver, true);
  assert.equal(game.phase, "finished");
  assert.equal(game.winner, "red");
});

test("tiebreaker ends in a draw when both sides lose a tower in the same step", () => {
  const game = createGame();
  game.phase = "tiebreaker";

  const bluePrincess = game.towers.find((tower) =>
    tower.side === "blue" && tower.kind === "princess" && tower.lane === "left"
  );
  const redPrincess = game.towers.find((tower) =>
    tower.side === "red" && tower.kind === "princess" && tower.lane === "left"
  );
  assert.ok(bluePrincess);
  assert.ok(redPrincess);
  bluePrincess.hp = 100;
  redPrincess.hp = 100;

  stepGame(game, 0.1, null, true);

  assert.equal(game.gameOver, true);
  assert.equal(game.phase, "finished");
  assert.equal(game.winner, "draw");
  assert.ok(game.audioEvents.includes("match-draw"));
});

test("unlocks only the left deployment pocket after the enemy left tower falls", () => {
  const game = createGame();
  const leftTower = game.towers.find((tower) =>
    tower.side === "red" && tower.kind === "princess" && tower.lane === "left"
  );
  assert.ok(leftTower);
  leftTower.hp = 0;

  assert.equal(canPlaceCard(game, "blue", "giant", 105, 220), true);
  assert.equal(canPlaceCard(game, "blue", "giant", 435, 220), false);
});

test("unlocks only the right deployment pocket after the enemy right tower falls", () => {
  const game = createGame();
  const rightTower = game.towers.find((tower) =>
    tower.side === "red" && tower.kind === "princess" && tower.lane === "right"
  );
  assert.ok(rightTower);
  rightTower.hp = 0;

  assert.equal(canPlaceCard(game, "blue", "giant", 105, 220), false);
  assert.equal(canPlaceCard(game, "blue", "giant", 435, 220), true);
});

test("deploys the full skeleton army in rows with staggered appearance", () => {
  const game = createGame();
  game.sides.blue.hand = ["skeleton-army"];
  game.sides.blue.elixir = 10;

  assert.equal(playCard(game, "blue", "skeleton-army", "left"), true);
  assert.equal(game.units.length, 15);
  assert.equal(game.units[0].transform.x, 105 - 2 * 5.95);
  assert.equal(game.units[4].transform.x, 105 + 2 * 5.95);
  assert.equal(game.units[5].transform.y, 759);
  assert.equal(game.units[0].deployment.duration, 1);
  assert.ok(Math.abs(game.units[14].deployment.duration - 1.45) < 0.000001);
});
