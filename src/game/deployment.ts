import { cardById } from "./cards";
import { unitDefinition } from "./units/definitions";
import type { CardId, GameState, Lane, Projectile, Side } from "./types";
import { addEvent, directionFor, FIELD_HEIGHT, LANE_X, nextRandom } from "./state";
import { addProjectile } from "./projectiles";

function rotateCard(state: GameState, side: Side, cardId: CardId): void {
  const runtime = state.sides[side];
  const index = runtime.hand.indexOf(cardId);
  if (index < 0) return;
  runtime.hand.splice(index, 1);
  runtime.hand.push(runtime.drawPile[runtime.drawIndex % runtime.drawPile.length]);
  runtime.drawIndex += 1;
  runtime.cardsPlayed += 1;
}

function spawnCard(state: GameState, side: Side, cardId: CardId, lane: Lane): void {
  const card = cardById(cardId);
  if (!card.unitType) return;
  const definition = unitDefinition(card.unitType);
  const direction = directionFor(side);
  const centerX = LANE_X[lane];
  const baseY = card.category === "building" ? (side === "blue" ? 690 : 270) : (side === "blue" ? 748 : 212);

  for (let index = 0; index < card.count; index += 1) {
    const column = index % 5;
    const row = Math.floor(index / 5);
    const offsetX = card.count === 1 ? 0 : (column - 2) * Math.min(11, definition.radius * 0.85);
    const offsetY = card.count === 1 ? 0 : row * direction * 11;
    state.units.push({
      id: state.nextId++, side, cardId, type: definition.type,
      kind: card.category === "building" ? "building" : "troop", lane,
      x: centerX + offsetX, y: baseY + offsetY,
      hp: definition.hp, maxHp: definition.hp, radius: definition.radius, damage: definition.damage,
      speed: definition.speed, range: definition.range, attackInterval: definition.attackInterval,
      attackCooldown: 0.25 + nextRandom(state) * 0.35, splashRadius: definition.splashRadius,
      isAir: definition.isAir, targetsBuildingsOnly: definition.targetsBuildingsOnly,
      lifetime: definition.lifetime, age: 0,
      facing: side === "blue" ? -Math.PI / 2 : Math.PI / 2,
      animationOffset: nextRandom(state) * Math.PI * 2, attackAnim: 0
    });
  }
}

export function playCard(state: GameState, side: Side, cardId: CardId, lane: Lane, targetX?: number, targetY?: number): boolean {
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
    addProjectile(state, side, x, side === "blue" ? FIELD_HEIGHT - 50 : 50, null, x, y,
      card.spellDamage ?? 0, card.spellRadius ?? 0, style, cardId === "fireball" ? 0.55 : 0.36);
  } else {
    spawnCard(state, side, cardId, lane);
  }

  addEvent(state, `${side === "blue" ? "Blue" : "Red"} played ${card.name}.`);
  return true;
}
