import assert from "node:assert/strict";
import test from "node:test";
import { playCard } from "../../../src/game/deployment.js";
import { damageTarget } from "../../../src/game/health.js";
import { canPlaceCard, getGroundDeploymentZones, snapToArenaTile } from "../../../src/game/placement.js";
import { createGame, stepGame } from "../../../src/game/simulation.js";
import { ARENA_TILE_SIZE, FIELD_HEIGHT, FIELD_WIDTH } from "../../../src/game/state.js";
import type { GameState, TroopUnit } from "../../../src/game/types/index.js";

function makeUnit(id: number, side: "blue" | "red", x: number, y: number): TroopUnit {
  return {
    id,
    side,
    cardId: "giant",
    type: "giant",
    kind: "troop",
    lane: "left",
    transform: { x, y, facing: 0 },
    health: { hp: 500, maxHp: 500 },
    collision: { radius: 12 },
    combat: { damage: 100, range: 55, attackInterval: 1, attackCooldown: 0, attack: { type: "melee" }, splashRadius: 0 },
    movement: { speed: 0, isAir: false },
    targeting: { canTargetAir: true, targetsBuildingsOnly: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 10 },
    presentation: { animationOffset: 0, attackAnim: 0 }
  };
}

function tower(state: GameState, side: "blue" | "red", kind: "king" | "princess", lane?: "left" | "right") {
  return state.towers.find((candidate) =>
    candidate.side === side && candidate.kind === kind
    && (kind === "king" || candidate.lane === lane)
  );
}

test("rejects a card that is not in the player's hand without changing state", () => {
  const game = createGame();
  game.sides.blue.elixir = 10;
  const before = structuredClone(game);

  assert.equal(playCard(game, "blue", "knight", "left"), false);
  assert.deepEqual(game, before);
});

test("deploys stationary buildings without a movement component", () => {
  const game = createGame();
  game.sides.blue.hand = ["cannon"];
  game.sides.blue.elixir = 10;

  assert.equal(playCard(game, "blue", "cannon", "left"), true);
  assert.equal(game.units[0].kind, "building");
  assert.equal("movement" in game.units[0], false);
  assert.equal(game.units[0].lifetime?.duration, 32);
});

test("troops without a configured lifetime omit the lifetime component", () => {
  const game = createGame();
  game.sides.blue.hand = ["giant"];
  game.sides.blue.elixir = 10;

  assert.equal(playCard(game, "blue", "giant", "left"), true);
  assert.equal("lifetime" in game.units[0], false);
});

test("units without sound profiles omit the audio component", () => {
  const game = createGame();
  game.sides.blue.hand = ["knight"];
  game.sides.blue.elixir = 10;

  assert.equal(playCard(game, "blue", "knight", "left"), true);
  assert.equal("audio" in game.units[0], false);
});

test("allows deployment when elixir exactly matches the card cost", () => {
  const game = createGame();
  game.sides.blue.elixir = 5;

  assert.equal(playCard(game, "blue", "giant", "left"), true);
  assert.equal(game.sides.blue.elixir, 0);
  assert.equal(game.units.length, 1);
  assert.equal(game.sides.blue.cardsPlayed, 1);
});

test("rejects placement when the player cannot afford the card", () => {
  const game = createGame();
  game.sides.blue.elixir = 4;

  assert.equal(canPlaceCard(game, "blue", "giant", 135, 800), false);
  assert.equal(canPlaceCard(game, "blue", "fireball", 135, 180), false);
});

test("launches a spell projectile without spawning a troop", () => {
  const game = createGame();
  game.sides.blue.hand.push("fireball");
  game.sides.blue.elixir = 10;

  assert.equal(playCard(game, "blue", "fireball", "left", 135, 180), true);
  assert.equal(game.units.length, 0);
  assert.equal(game.projectiles.length, 1);
  assert.equal(game.projectiles[0].targetX, 135);
  assert.equal(game.projectiles[0].targetY, 180);
  assert.equal(game.sides.blue.elixir, 6);
  assert.ok(game.audioEvents.includes("fireball-launch"));
});

test("elixir regeneration never exceeds the ten-elixir cap", () => {
  const game = createGame();
  game.sides.blue.elixir = 9.99;
  game.sides.red.elixir = 10;

  stepGame(game, 1, null, true);

  assert.equal(game.sides.blue.elixir, 10);
  assert.equal(game.sides.red.elixir, 10);
});

test("uses double-elixir regeneration after the two-minute threshold", () => {
  const game = createGame();
  game.time = 119.9;
  game.sides.blue.elixir = 5;
  game.sides.red.elixir = 5;

  stepGame(game, 0.1, null, true);

  assert.ok(Math.abs(game.sides.blue.elixir - (5 + 0.1 / 1.4)) < 0.000001);
  assert.ok(game.audioEvents.includes("double-elixir"));
});

test("uses triple-elixir regeneration in the later part of overtime", () => {
  const game = createGame();
  game.phase = "overtime";
  game.time = 239.9;
  game.overtimeStartCrowns = { blue: 0, red: 0 };
  game.sides.blue.elixir = 5;
  game.sides.red.elixir = 5;

  stepGame(game, 0.1, null, true);

  assert.ok(Math.abs(game.sides.blue.elixir - (5 + 0.1 / (2.8 / 3))) < 0.000001);
  assert.ok(game.audioEvents.includes("triple-elixir"));
});

test("clamps tower damage at zero and activates a king tower when damaged", () => {
  const game = createGame();
  const king = tower(game, "red", "king");
  assert.ok(king);

  damageTarget(game, king.id, king.maxHp + 500);

  assert.equal(king.hp, 0);
  assert.equal(king.activated, true);
  assert.ok(game.audioEvents.includes("king-activation"));
});

test("awards the regulation win to the side with more destroyed princess towers", () => {
  const game = createGame();
  const redPrincess = tower(game, "red", "princess", "left");
  assert.ok(redPrincess);
  redPrincess.hp = 0;

  stepGame(game, 180, null, true);

  assert.equal(game.gameOver, true);
  assert.equal(game.winner, "blue");
  assert.equal(game.phase, "finished");
});

test("ends overtime immediately when one side destroys a tower", () => {
  const game = createGame();
  game.phase = "overtime";
  game.overtimeStartCrowns = { blue: 0, red: 0 };
  const redPrincess = tower(game, "red", "princess", "left");
  assert.ok(redPrincess);
  redPrincess.hp = 0;

  stepGame(game, 1 / 30, null, true);

  assert.equal(game.gameOver, true);
  assert.equal(game.winner, "blue");
  assert.ok(game.events.some((event) => event.includes("wins in overtime")));
});

test("overtime continues when both sides take a tower in the same step", () => {
  const game = createGame();
  game.phase = "overtime";
  game.overtimeStartCrowns = { blue: 0, red: 0 };

  const redPrincess = tower(game, "red", "princess", "left");
  const bluePrincess = tower(game, "blue", "princess", "left");
  assert.ok(redPrincess);
  assert.ok(bluePrincess);
  redPrincess.hp = 0;
  bluePrincess.hp = 0;

  stepGame(game, 1 / 30, null, true);

  assert.equal(game.phase, "overtime");
  assert.equal(game.gameOver, false);
  assert.equal(game.winner, null);
});

test("overtime timeout enters tiebreaker and clears the battlefield", () => {
  const game = createGame();
  game.phase = "overtime";
  game.time = 299.9;
  game.overtimeStartCrowns = { blue: 0, red: 0 };
  game.sides.blue.hand.push("fireball");
  game.sides.blue.elixir = 10;

  assert.equal(playCard(game, "blue", "giant", "left"), true);
  assert.equal(playCard(game, "blue", "fireball", "left"), true);
  assert.ok(game.units.length > 0);
  assert.ok(game.projectiles.length > 0);

  stepGame(game, 0.1, null, true);

  assert.equal(game.phase, "tiebreaker");
  assert.equal(game.gameOver, false);
  assert.equal(game.units.length, 0);
  assert.equal(game.projectiles.length, 0);
  assert.equal(game.effects.length, 0);
});


test("overtime timeout still enters tiebreaker without a crown snapshot", () => {
  const game = createGame();
  game.phase = "overtime";
  game.time = 299.9;
  game.overtimeStartCrowns = null;

  stepGame(game, 0.1, null, true);

  assert.equal(game.phase, "tiebreaker");
  assert.equal(game.gameOver, false);
  assert.equal(game.overtimeStartCrowns, null);
});


test("awards the overtime win to red when blue loses a princess tower", () => {
  const game = createGame();
  game.phase = "overtime";
  game.overtimeStartCrowns = { blue: 0, red: 0 };
  const bluePrincess = tower(game, "blue", "princess", "left");
  assert.ok(bluePrincess);
  bluePrincess.hp = 0;

  stepGame(game, 1 / 30, null, true);

  assert.equal(game.gameOver, true);
  assert.equal(game.winner, "red");
  assert.ok(game.events.some((event) => event.includes("Red wins in overtime")));
  assert.ok(game.audioEvents.includes("match-defeat"));
});


test("defaults a spell to the king tower when its lane princess tower is destroyed", () => {
  const game = createGame();
  const redPrincess = tower(game, "red", "princess", "right");
  const redKing = tower(game, "red", "king");
  assert.ok(redPrincess);
  assert.ok(redKing);
  redPrincess.hp = 0;
  game.sides.blue.hand = ["fireball"];
  game.sides.blue.elixir = 10;

  assert.equal(playCard(game, "blue", "fireball", "right"), true);

  assert.equal(game.projectiles.length, 1);
  assert.equal(game.projectiles[0].targetX, redKing.x);
  assert.equal(game.projectiles[0].targetY, redKing.y);
});


test("launches arrows without emitting an optional spell launch sound", () => {
  const game = createGame();
  game.sides.blue.hand = ["arrows"];
  game.sides.blue.elixir = 10;

  assert.equal(playCard(game, "blue", "arrows", "left", 135, 180), true);

  assert.equal(game.projectiles.length, 1);
  assert.equal(game.projectiles[0].style, "arrows");
  assert.deepEqual(game.audioEvents, []);
});


test("awards the regulation win to red when blue has more destroyed princess towers", () => {
  const game = createGame();
  const bluePrincess = tower(game, "blue", "princess", "left");
  assert.ok(bluePrincess);
  bluePrincess.hp = 0;

  stepGame(game, 180, null, true);

  assert.equal(game.gameOver, true);
  assert.equal(game.winner, "red");
  assert.equal(game.phase, "finished");
  assert.ok(game.audioEvents.includes("match-defeat"));
});


test("deploys every Skeleton Army troop in staggered rows on the red side", () => {
  const game = createGame();
  game.sides.red.hand = ["skeleton-army"];
  game.sides.red.elixir = 10;

  assert.equal(playCard(game, "red", "skeleton-army", "right"), true);

  assert.equal(game.units.length, 15);
  assert.ok(game.units.every((unit) => unit.kind === "troop" && unit.side === "red"));
  assert.ok(game.units.every((unit) => unit.transform.facing === Math.PI / 2));
  assert.equal(game.units[0].transform.y, 212);
  assert.equal(game.units[5].transform.y, 223);
  assert.equal(game.units[14].transform.y, 234);
  assert.equal(new Set(game.units.slice(0, 5).map((unit) => unit.transform.x)).size, 5);
  assert.ok(game.units[14].deployment.duration > game.units[0].deployment.duration);
  assert.equal(game.sides.red.cardsPlayed, 1);
  assert.equal(game.sides.red.elixir, 7);
});


test("deploys paired archers around a custom placement point", () => {
  const game = createGame();
  game.sides.blue.hand = ["archers"];
  game.sides.blue.elixir = 10;

  assert.equal(playCard(game, "blue", "archers", "right", undefined, undefined, { x: 210, y: 600 }), true);

  const troops = game.units.filter((unit) => unit.kind === "troop");
  assert.equal(troops.length, 2);
  assert.equal(troops[0].transform.x, 193);
  assert.equal(troops[1].transform.x, 201.5);
  assert.equal(troops[0].transform.y, 600);
  assert.equal(troops[1].transform.y, 600);
  assert.equal(troops[0].movement.formationSlot, -1);
  assert.equal(troops[1].movement.formationSlot, 1);
  assert.ok(troops[1].deployment.duration > troops[0].deployment.duration);
  assert.ok(troops.every((unit) => unit.transform.facing === -Math.PI / 2));
});


test("deploys a red building at its default lane position", () => {
  const game = createGame();
  game.sides.red.hand = ["cannon"];
  game.sides.red.elixir = 10;

  assert.equal(playCard(game, "red", "cannon", "right"), true);

  assert.equal(game.units.length, 1);
  assert.equal(game.units[0].kind, "building");
  assert.equal(game.units[0].side, "red");
  assert.equal(game.units[0].transform.x, 435);
  assert.equal(game.units[0].transform.y, 270);
  assert.equal(game.units[0].transform.facing, Math.PI / 2);
  assert.equal("movement" in game.units[0], false);
  assert.equal(game.sides.red.elixir, 7);
  assert.equal(game.sides.red.cardsPlayed, 1);
});

test("snaps coordinates to tile centers and clamps every arena edge", () => {
  const halfTile = ARENA_TILE_SIZE / 2;

  assert.deepEqual(snapToArenaTile({ x: -100, y: -100 }), { x: halfTile, y: halfTile });
  assert.deepEqual(snapToArenaTile({ x: 10000, y: 10000 }), {
    x: FIELD_WIDTH - halfTile,
    y: FIELD_HEIGHT - halfTile
  });
  assert.deepEqual(snapToArenaTile({ x: 31, y: 61 }), { x: 45, y: 75 });
});

test("unlocks only the destroyed princess tower's deployment pocket", () => {
  const game = createGame();
  const initial = getGroundDeploymentZones(game, "blue", 12);
  const redLeft = tower(game, "red", "princess", "left");
  const redRight = tower(game, "red", "princess", "right");

  assert.ok(redLeft);
  assert.ok(redRight);
  assert.equal(initial.length, 1);

  redLeft.hp = 0;
  const leftUnlocked = getGroundDeploymentZones(game, "blue", 12);
  assert.equal(leftUnlocked.length, 2);
  assert.ok(leftUnlocked[1].maxX < FIELD_WIDTH / 2);

  redRight.hp = 0;
  const bothUnlocked = getGroundDeploymentZones(game, "blue", 12);
  assert.equal(bothUnlocked.length, 3);
  assert.ok(bothUnlocked[2].minX >= FIELD_WIDTH / 2);
});

test("red deployment pockets extend toward the river only in destroyed-tower lanes", () => {
  const game = createGame();
  const blueRight = tower(game, "blue", "princess", "right");
  assert.ok(blueRight);

  const baseZones = getGroundDeploymentZones(game, "red", 12);
  assert.equal(baseZones.length, 1);

  blueRight.hp = 0;
  const unlockedZones = getGroundDeploymentZones(game, "red", 12);
  assert.equal(unlockedZones.length, 2);
  assert.ok(unlockedZones[1].maxY > baseZones[0].maxY);
  assert.ok(unlockedZones[1].minX >= FIELD_WIDTH / 2);
});

test("rejects deployment zones that cannot fit the requested unit radius", () => {
  const game = createGame();

  assert.deepEqual(getGroundDeploymentZones(game, "blue", 1000), []);
});

test("allows spells on the field boundary but rejects non-finite and out-of-field coordinates", () => {
  const game = createGame();
  game.sides.blue.hand = ["fireball"];
  game.sides.blue.elixir = 10;

  assert.equal(canPlaceCard(game, "blue", "fireball", 12, 12), true);
  assert.equal(canPlaceCard(game, "blue", "fireball", FIELD_WIDTH - 12, FIELD_HEIGHT - 12), true);
  assert.equal(canPlaceCard(game, "blue", "fireball", 11.99, 12), false);
  assert.equal(canPlaceCard(game, "blue", "fireball", 12, FIELD_HEIGHT - 11.99), false);
  assert.equal(canPlaceCard(game, "blue", "fireball", Number.NaN, 100), false);
  assert.equal(canPlaceCard(game, "blue", "fireball", 100, Number.POSITIVE_INFINITY), false);
});

test("red troop placement uses the red-side deployment half", () => {
  const game = createGame();
  game.sides.red.hand = ["giant"];
  game.sides.red.elixir = 10;

  assert.equal(canPlaceCard(game, "red", "giant", 135, 100), true);
  assert.equal(canPlaceCard(game, "red", "giant", 135, 800), false);
});
