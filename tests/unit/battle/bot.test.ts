import assert from "node:assert/strict";
import test from "node:test";
import { chooseBotAction } from "../../../src/game/bot.js";
import { createGame } from "../../../src/game/simulation.js";
import type { TroopUnit } from "../../../src/game/types/index.js";

function makeTroop(
  id: number,
  side: "blue" | "red",
  x: number,
  y: number,
  overrides: Partial<TroopUnit> = {}
): TroopUnit {
  return {
    id,
    side,
    cardId: "giant",
    type: "giant",
    kind: "troop",
    lane: "left",
    transform: { x, y, facing: 0 },
    health: { hp: 800, maxHp: 800 },
    collision: { radius: 12 },
    combat: {
      damage: 100,
      range: 55,
      attackInterval: 1,
      attackCooldown: 0,
      attack: { type: "melee" },
      splashRadius: 0
    },
    movement: { speed: 0, isAir: false },
    targeting: { canTargetAir: true, targetsBuildingsOnly: false },
    deployment: { appearanceDelay: 0, duration: 0, remaining: 0 },
    presentation: { animationOffset: 0, attackAnim: 0 },
    ...overrides
  };
}

test("bot does not choose a card it cannot afford", () => {
  const game = createGame();
  game.sides.blue.hand = ["giant"];
  game.sides.blue.elixir = 4;

  assert.equal(chooseBotAction(game, "blue"), null);
});

test("bot uses arrows against a clustered skeleton army", () => {
  const game = createGame();
  game.sides.blue.hand = ["arrows"];
  game.sides.blue.elixir = 10;
  game.units.push(
    ...Array.from({ length: 5 }, (_, index) =>
      makeTroop(100 + index, "red", 100 + index * 10, 700, {
        cardId: "skeleton-army",
        type: "skeleton"
      })
    )
  );

  const decision = chooseBotAction(game, "blue");

  assert.equal(decision?.cardId, "arrows");
  assert.equal(decision?.lane, "left");
  assert.ok(decision?.targetX !== undefined);
  assert.equal(decision?.targetY, 700);
});

test("bot counters an enemy giant with Mini P.E.K.K.A.", () => {
  const game = createGame();
  game.sides.blue.hand = ["mini-pekka"];
  game.sides.blue.elixir = 4;
  game.units.push(makeTroop(100, "red", 135, 700, { lane: "right" }));

  assert.deepEqual(chooseBotAction(game, "blue"), {
    cardId: "mini-pekka",
    lane: "right"
  });
});

test("bot does not target enemies that are still deploying with a spell", () => {
  const game = createGame();
  game.sides.blue.hand = ["arrows"];
  game.sides.blue.elixir = 10;
  game.units.push(makeTroop(100, "red", 135, 700, {
    cardId: "skeleton-army",
    type: "skeleton",
    deployment: { appearanceDelay: 0, duration: 0, remaining: 1 }
  }));

  const decision = chooseBotAction(game, "blue");

  assert.equal(decision?.cardId, "arrows");
  assert.equal(decision?.targetY, undefined);
});

test("bot uses fireball against a clustered group of threats", () => {
  const game = createGame();
  game.sides.blue.hand = ["fireball"];
  game.sides.blue.elixir = 10;
  game.units.push(
    ...Array.from({ length: 3 }, (_, index) =>
      makeTroop(200 + index, "red", 100 + index * 10, 700, {
        cardId: "skeleton-army",
        type: "skeleton"
      })
    )
  );

  const decision = chooseBotAction(game, "blue");

  assert.equal(decision?.cardId, "fireball");
  assert.equal(decision?.lane, "left");
  assert.equal(decision?.targetX, 110);
  assert.equal(decision?.targetY, 700);
});

test("bot uses a knight to defend against a tank when Mini P.E.K.K.A. is unavailable", () => {
  const game = createGame();
  game.sides.blue.hand = ["knight"];
  game.sides.blue.elixir = 10;
  game.units.push(makeTroop(300, "red", 400, 700, { lane: "right" }));

  assert.deepEqual(chooseBotAction(game, "blue"), {
    cardId: "knight",
    lane: "right"
  });
});

test("bot places a cannon against three or more incoming threats", () => {
  const game = createGame();
  game.sides.blue.hand = ["cannon"];
  game.sides.blue.elixir = 10;
  game.units.push(
    ...Array.from({ length: 3 }, (_, index) =>
      makeTroop(400 + index, "red", 100 + index * 10, 700)
    )
  );

  assert.deepEqual(chooseBotAction(game, "blue"), {
    cardId: "cannon",
    lane: "left"
  });
});

test("bot chooses Baby Dragon against a group of four threats", () => {
  const game = createGame();
  game.sides.blue.hand = ["baby-dragon"];
  game.sides.blue.elixir = 10;
  game.units.push(
    ...Array.from({ length: 4 }, (_, index) =>
      makeTroop(500 + index, "red", 100 + index * 10, 700)
    )
  );

  assert.deepEqual(chooseBotAction(game, "blue"), {
    cardId: "baby-dragon",
    lane: "left"
  });
});

test("bot starts a giant push when it has no friendly giant", () => {
  const game = createGame();
  game.sides.blue.hand = ["giant"];
  game.sides.blue.elixir = 10;

  assert.deepEqual(chooseBotAction(game, "blue"), {
    cardId: "giant",
    lane: "left"
  });
});

test("bot adds archers when fewer than two are already deployed", () => {
  const game = createGame();
  game.sides.blue.hand = ["archers"];
  game.sides.blue.elixir = 10;
  game.units.push(makeTroop(600, "blue", 135, 800, {
    cardId: "archers",
    type: "archer"
  }));

  assert.deepEqual(chooseBotAction(game, "blue"), {
    cardId: "archers",
    lane: "right"
  });
});

test("bot uses skeleton army to surround a tank when no splash defender is nearby", () => {
  const game = createGame();
  game.sides.blue.hand = ["skeleton-army"];
  game.sides.blue.elixir = 10;
  game.units.push(makeTroop(700, "red", 400, 700));

  assert.deepEqual(chooseBotAction(game, "blue"), {
    cardId: "skeleton-army",
    lane: "left"
  });
});


test("red bot recognizes threats on its own half and uses its side's lane timing", () => {
  const game = createGame();
  game.sides.red.hand = ["giant"];
  game.sides.red.elixir = 10;
  game.units.push(makeTroop(800, "blue", 135, 200));

  assert.deepEqual(chooseBotAction(game, "red"), {
    cardId: "giant",
    lane: "right"
  });
});


test("bot stops prioritizing more archers once two are already deployed", () => {
  const game = createGame();
  game.sides.blue.hand = ["archers", "knight"];
  game.sides.blue.elixir = 10;
  game.units.push(
    makeTroop(900, "blue", 120, 800, { cardId: "archers", type: "archer" }),
    makeTroop(901, "blue", 140, 800, { cardId: "archers", type: "archer" })
  );

  assert.deepEqual(chooseBotAction(game, "blue"), {
    cardId: "knight",
    lane: "left"
  });
});
