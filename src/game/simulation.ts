import { cardById, STARTER_DECK } from "./cards";
import { chooseBotAction } from "./bot";
import type {
  CardId,
  Effect,
  GameState,
  Lane,
  Projectile,
  Side,
  SideState,
  Tower,
  Unit
} from "./types";

const FIELD_WIDTH = 720;
const FIELD_HEIGHT = 960;
const LANE_X: Record<Lane, number> = { left: 205, right: 515 };
const MAX_ELIXIR = 10;
const MATCH_LENGTH = 180;

function otherSide(side: Side): Side {
  return side === "blue" ? "red" : "blue";
}

function directionFor(side: Side): number {
  return side === "blue" ? -1 : 1;
}

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

  addTower(state, "red", "princess", "left", 205, 150);
  addTower(state, "red", "princess", "right", 515, 150);
  addTower(state, "red", "king", "center", 360, 78);
  addTower(state, "blue", "princess", "left", 205, 810);
  addTower(state, "blue", "princess", "right", 515, 810);
  addTower(state, "blue", "king", "center", 360, 882);

  return state;
}

function addEvent(state: GameState, message: string): void {
  state.events.unshift(message);
  state.events.length = Math.min(state.events.length, 5);
}

function nextRandom(state: GameState): number {
  let value = state.seed += 0x6D2B79F5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function rotateCard(state: GameState, side: Side, cardId: CardId): void {
  const runtime = state.sides[side];
  const index = runtime.hand.indexOf(cardId);
  if (index < 0) return;

  runtime.hand.splice(index, 1);
  runtime.hand.push(runtime.drawPile[runtime.drawIndex % runtime.drawPile.length]);
  runtime.drawIndex += 1;
  runtime.cardsPlayed += 1;
}

function addProjectile(
  state: GameState,
  side: Side,
  x: number,
  y: number,
  targetId: number | null,
  targetX: number,
  targetY: number,
  damage: number,
  splashRadius: number,
  style: Projectile["style"],
  duration: number
): void {
  state.projectiles.push({
    id: state.nextId++,
    side,
    x,
    y,
    targetId,
    targetX,
    targetY,
    age: 0,
    duration: Math.max(0.12, duration),
    damage,
    splashRadius,
    style
  });
}

function spawnCard(state: GameState, side: Side, cardId: CardId, lane: Lane): void {
  const card = cardById(cardId);
  const direction = directionFor(side);
  const centerX = LANE_X[lane];
  const baseY = card.category === "building"
    ? (side === "blue" ? 690 : 270)
    : (side === "blue" ? 748 : 212);

  for (let index = 0; index < card.count; index += 1) {
    const column = index % 5;
    const row = Math.floor(index / 5);
    const offsetX = card.count === 1 ? 0 : (column - 2) * Math.min(11, card.radius * 0.85);
    const offsetY = card.count === 1 ? 0 : row * direction * 11;
    const type = card.id === "archers"
      ? "archer"
      : card.id === "skeleton-army"
        ? "skeleton"
        : card.id === "mini-pekka"
          ? "mini-pekka"
          : card.id === "baby-dragon"
            ? "baby-dragon"
            : card.id === "cannon"
              ? "cannon"
              : "giant";

    state.units.push({
      id: state.nextId++,
      side,
      cardId,
      type,
      kind: card.category === "building" ? "building" : "troop",
      lane,
      x: centerX + offsetX,
      y: baseY + offsetY,
      hp: card.hp,
      maxHp: card.hp,
      radius: card.radius,
      damage: card.damage,
      speed: card.speed,
      range: card.range,
      attackInterval: card.attackInterval,
      attackCooldown: 0.25 + nextRandom(state) * 0.35,
      splashRadius: card.splashRadius,
      isAir: card.isAir,
      targetsBuildingsOnly: card.targetsBuildingsOnly,
      lifetime: card.lifetime,
      age: 0,
      facing: side === "blue" ? -Math.PI / 2 : Math.PI / 2,
      animationOffset: nextRandom(state) * Math.PI * 2,
      attackAnim: 0
    });
  }
}

function playCard(state: GameState, side: Side, cardId: CardId, lane: Lane, targetX?: number, targetY?: number): boolean {
  const card = cardById(cardId);
  const runtime = state.sides[side];
  if (!runtime.hand.includes(cardId) || runtime.elixir < card.cost) return false;

  runtime.elixir -= card.cost;
  rotateCard(state, side, cardId);

  if (card.category === "spell") {
    const enemyTowers = state.towers.filter((tower) => tower.side !== side && tower.hp > 0);
    const defaultTower = enemyTowers.find((tower) => tower.kind === "princess" && tower.lane === lane)
      ?? enemyTowers.find((tower) => tower.kind === "king");
    const x = targetX ?? defaultTower?.x ?? LANE_X[lane];
    const y = targetY ?? defaultTower?.y ?? (side === "blue" ? 180 : 780);
    const style: Projectile["style"] = cardId === "fireball" ? "fireball" : "arrows";
    addProjectile(
      state,
      side,
      x,
      side === "blue" ? FIELD_HEIGHT - 50 : 50,
      null,
      x,
      y,
      card.damage,
      card.splashRadius,
      style,
      cardId === "fireball" ? 0.55 : 0.36
    );
  } else {
    spawnCard(state, side, cardId, lane);
  }

  addEvent(state, `${side === "blue" ? "Blue" : "Red"} played ${card.name}.`);
  return true;
}

function findEnemyUnit(state: GameState, unit: Unit, detectionRange: number): Unit | null {
  let nearest: Unit | null = null;
  let nearestDistance = detectionRange;

  for (const candidate of state.units) {
    if (candidate.side === unit.side || candidate.hp <= 0) continue;
    if (candidate.kind === "building" && unit.type !== "giant" && unit.targetsBuildingsOnly) continue;
    if (candidate.isAir && unit.type === "cannon") continue;

    const distance = Math.hypot(candidate.x - unit.x, candidate.y - unit.y);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function enemyTowerFor(state: GameState, unit: Unit): Tower | null {
  const enemySide = otherSide(unit.side);
  const princess = state.towers.find((tower) =>
    tower.side === enemySide && tower.kind === "princess" && tower.lane === unit.lane && tower.hp > 0
  );
  if (princess) return princess;

  return state.towers.find((tower) => tower.side === enemySide && tower.kind === "king" && tower.hp > 0) ?? null;
}

function moveToward(unit: Unit, x: number, y: number, dt: number): void {
  const dx = x - unit.x;
  const dy = y - unit.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001 || unit.speed <= 0) return;

  unit.facing = Math.atan2(dy, dx);
  const amount = Math.min(distance, unit.speed * dt);
  unit.x += (dx / distance) * amount;
  unit.y += (dy / distance) * amount;
}

function damageTarget(state: GameState, targetId: number, damage: number): void {
  const unit = state.units.find((candidate) => candidate.id === targetId);
  if (unit) {
    unit.hp -= damage;
    unit.attackAnim = Math.max(unit.attackAnim, 0.09);
    state.effects.push({
      id: state.nextId++,
      x: unit.x,
      y: unit.y,
      age: 0,
      lifetime: 0.22,
      radius: 9,
      style: "hit"
    });
    return;
  }

  const tower = state.towers.find((candidate) => candidate.id === targetId);
  if (tower && tower.hp > 0) {
    tower.hp = Math.max(0, tower.hp - damage);
    if (tower.hp === 0) addEvent(state, `${tower.side === "blue" ? "Blue" : "Red"} ${tower.kind} tower destroyed!`);
  }
}

function attackUnit(state: GameState, unit: Unit, target: Unit | Tower): void {
  unit.attackCooldown = unit.attackInterval;
  unit.attackAnim = 0.32;

  const targetX = target.x;
  const targetY = target.y;
  const distance = Math.hypot(targetX - unit.x, targetY - unit.y);

  if (unit.range > 42 || unit.splashRadius > 0) {
    const style: Projectile["style"] = unit.type === "baby-dragon" ? "fire" : unit.type === "cannon" ? "cannon" : "arrow";
    addProjectile(
      state,
      unit.side,
      unit.x,
      unit.y,
      target.id,
      targetX,
      targetY,
      unit.damage,
      unit.splashRadius,
      style,
      distance / (unit.type === "baby-dragon" ? 290 : 430)
    );
  } else {
    damageTarget(state, target.id, unit.damage);
  }
}

function updateUnits(state: GameState, dt: number): void {
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;

    unit.age += dt;
    unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
    unit.attackAnim = Math.max(0, unit.attackAnim - dt);

    if (unit.lifetime > 0 && unit.age >= unit.lifetime) {
      unit.hp = 0;
      continue;
    }

    if (unit.kind === "building") {
      const target = findEnemyUnit(state, unit, unit.range);
      if (target && unit.attackCooldown <= 0) attackUnit(state, unit, target);
      continue;
    }

    const detectionRange = Math.max(105, unit.range + 65);
    const enemy = unit.targetsBuildingsOnly ? null : findEnemyUnit(state, unit, detectionRange);

    if (enemy) {
      const distance = Math.hypot(enemy.x - unit.x, enemy.y - unit.y);
      if (distance <= unit.range + enemy.radius) {
        if (unit.attackCooldown <= 0) attackUnit(state, unit, enemy);
      } else {
        moveToward(unit, enemy.x, enemy.y, dt);
      }
      continue;
    }

    const tower = enemyTowerFor(state, unit);
    if (!tower) continue;

    const towerDistance = Math.hypot(tower.x - unit.x, tower.y - unit.y);
    if (towerDistance <= unit.range + tower.radius) {
      if (unit.attackCooldown <= 0) attackUnit(state, unit, tower);
    } else {
      moveToward(unit, tower.x, tower.y, dt);
    }
  }
}

function updateTowers(state: GameState, dt: number): void {
  for (const tower of state.towers) {
    if (tower.hp <= 0) continue;

    tower.attackCooldown = Math.max(0, tower.attackCooldown - dt);
    if (tower.attackCooldown > 0) continue;

    let target: Unit | null = null;
    let nearestDistance = tower.range;

    for (const unit of state.units) {
      if (unit.side === tower.side || unit.hp <= 0) continue;
      if (unit.isAir === false || tower.kind === "king") {
        const distance = Math.hypot(unit.x - tower.x, unit.y - tower.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          target = unit;
        }
      }
    }

    if (!target) continue;

    tower.attackCooldown = tower.attackInterval;
    addProjectile(
      state,
      tower.side,
      tower.x,
      tower.y,
      target.id,
      target.x,
      target.y,
      tower.damage,
      0,
      "arrow",
      nearestDistance / 480
    );
  }
}

function applySplash(state: GameState, projectile: Projectile, x: number, y: number): void {
  const spell = projectile.style === "fireball" || projectile.style === "arrows";
  for (const unit of state.units) {
    if (unit.side === projectile.side || unit.hp <= 0) continue;
    if (Math.hypot(unit.x - x, unit.y - y) <= projectile.splashRadius + unit.radius) {
      damageTarget(state, unit.id, projectile.damage);
    }
  }

  for (const tower of state.towers) {
    if (tower.side === projectile.side || tower.hp <= 0) continue;
    if (Math.hypot(tower.x - x, tower.y - y) <= projectile.splashRadius + tower.radius) {
      damageTarget(state, tower.id, spell ? Math.round(projectile.damage * 0.28) : projectile.damage);
    }
  }
}

function updateProjectiles(state: GameState, dt: number): void {
  for (let index = state.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = state.projectiles[index];
    projectile.age += dt;
    const progress = Math.min(1, projectile.age / projectile.duration);
    projectile.x = projectile.targetX + (projectile.x - projectile.targetX) * 0;
    projectile.y = projectile.targetY + (projectile.y - projectile.targetY) * 0;

    const startX = projectile._startX;
    const startY = projectile._startY;
    if (startX !== undefined && startY !== undefined) {
      projectile.x = startX + (projectile.targetX - startX) * progress;
      projectile.y = startY + (projectile.targetY - startY) * progress;
    }

    if (progress < 1) continue;

    if (projectile.splashRadius > 0) {
      applySplash(state, projectile, projectile.targetX, projectile.targetY);
      state.effects.push({
        id: state.nextId++,
        x: projectile.targetX,
        y: projectile.targetY,
        age: 0,
        lifetime: projectile.style === "arrows" ? 0.38 : 0.48,
        radius: projectile.splashRadius,
        style: projectile.style === "arrows" ? "arrows" : "explosion"
      });
    } else if (projectile.targetId !== null) {
      damageTarget(state, projectile.targetId, projectile.damage);
    }

    state.projectiles.splice(index, 1);
  }
}

function updateEffects(state: GameState, dt: number): void {
  for (const effect of state.effects) effect.age += dt;
  state.effects = state.effects.filter((effect) => effect.age < effect.lifetime);
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
    const blueHp = state.towers.filter((tower) => tower.side === "blue").reduce((sum, tower) => sum + tower.hp, 0);
    const redHp = state.towers.filter((tower) => tower.side === "red").reduce((sum, tower) => sum + tower.hp, 0);
    state.gameOver = true;
    state.winner = blueHp === redHp ? "draw" : blueHp > redHp ? "blue" : "red";
  }

  if (state.gameOver) {
    addEvent(state, state.winner === "draw" ? "The battle ended in a draw." : `${state.winner === "blue" ? "Blue" : "Red"} wins the battle!`);
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
      if (decision) playCard(state, side, decision.cardId, decision.lane, decision.targetX, decision.targetY);
    }
  }

  updateUnits(state, dt);
  updateTowers(state, dt);
  updateProjectiles(state, dt);
  updateEffects(state, dt);

  state.units = state.units.filter((unit) => unit.hp > 0 && unit.x > -40 && unit.x < FIELD_WIDTH + 40 && unit.y > -40 && unit.y < FIELD_HEIGHT + 40);
  checkGameEnd(state);
}

export const SIMULATION_STEP = 1 / 30;
