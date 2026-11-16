import { cardById } from "./cards";
import type { CardId, GameState, Lane, Side, UnitCardDefinition } from "./types";
import { addEvent, directionFor, FIELD_HEIGHT, FIELD_WIDTH, LANE_X, nextRandom } from "./state";
import { addProjectile } from "./projectiles";

function rotateCard(state: GameState, side: Side, cardId: CardId): void {
  const runtime = state.sides[side];
  const index = runtime.hand.indexOf(cardId);
  if (index < 0) return;
  runtime.hand.splice(index, 1);
  const nextCard = runtime.drawPile.shift();
  if (nextCard === undefined) return;
  runtime.hand.push(nextCard);
  runtime.drawPile.push(cardId);
  runtime.cardsPlayed += 1;
}

function spawnCard(
  state: GameState,
  side: Side,
  card: UnitCardDefinition,
  lane: Lane,
  placement?: { x: number; y: number }
): void {
  const definition = card.unit;
  const direction = directionFor(side);
  const centerX = placement?.x ?? LANE_X[lane];
  const baseY = placement?.y
    ?? (card.category === "building" ? (side === "blue" ? 690 : 270) : (side === "blue" ? 748 : 212));

  const baseDeployTime = card.deployTime ?? 1;
  const staggerInterval = card.count > 1 ? Math.min(0.05, 0.45 / (card.count - 1)) : 0;

  for (let index = 0; index < card.count; index += 1) {
    const column = index % 5;
    const row = Math.floor(index / 5);
    const offsetX = card.count === 1 ? 0 : (column - 2) * Math.min(11, definition.radius * 0.85);
    const offsetY = card.count === 1 ? 0 : row * direction * 11;
    const x = centerX + offsetX;
    const y = baseY + offsetY;
    const deploymentDuration = baseDeployTime + index * staggerInterval;

    state.units.push({
      id: state.nextId++,
      side,
      cardId: card.id,
      type: definition.type,
      kind: card.category === "building" ? "building" : "troop",
      lane,
      x,
      y,
      hp: definition.hp,
      maxHp: definition.hp,
      radius: definition.radius,
      collisionMass: definition.collisionMass ?? 1,
      formationSlot: definition.type === "archer" && card.count === 2
        ? (index === 0 ? -1 : 1)
        : undefined,
      damage: definition.damage,
      speed: definition.speed,
      range: definition.range,
      attackInterval: definition.attackInterval,
      attackCooldown: 0.25 + nextRandom(state) * 0.35,
      attack: definition.attack,
      splashRadius: definition.splashRadius,
      isAir: definition.isAir,
      canTargetAir: definition.canTargetAir,
      targetsBuildingsOnly: definition.targetsBuildingsOnly,
      lifetime: definition.lifetime,
      age: 0,
      deploymentDuration,
      deploymentRemaining: deploymentDuration,
      facing: side === "blue" ? -Math.PI / 2 : Math.PI / 2,
      animationOffset: nextRandom(state) * Math.PI * 2,
      attackAnim: 0
    });

    if (definition.type === "mini-pekka") {
      state.audioEvents.push("mini-pekka-deploy");
    } else if (definition.type === "giant") {
      state.audioEvents.push("giant-deploy");
    }

    state.effects.push({
      id: state.nextId++,
      x,
      y,
      age: 0,
      lifetime: 0.62,
      radius: Math.max(22, definition.radius * 2.2),
      style: "deployment",
      side
    });
  }

  if (definition.type === "skeleton") {
    state.audioEvents.push("skeleton-deploy");
  }
}

export function canPlaceCard(
  state: GameState,
  side: Side,
  cardId: CardId,
  x: number,
  y: number
): boolean {
  const card = cardById(cardId);
  const runtime = state.sides[side];
  if (!runtime.hand.includes(cardId) || runtime.elixir < card.cost) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  if (card.category === "spell") {
    return x >= 12 && x <= FIELD_WIDTH - 12 && y >= 12 && y <= FIELD_HEIGHT - 12;
  }

  const radius = card.unit.radius;
  if (x < radius + 12 || x > FIELD_WIDTH - radius - 12) return false;

  if (side === "blue") {
    return y >= 512 + radius + 8 && y <= FIELD_HEIGHT - radius - 12;
  }

  return y >= radius + 12 && y <= 448 - radius - 8;
}

export function playCard(
  state: GameState,
  side: Side,
  cardId: CardId,
  lane: Lane,
  targetX?: number,
  targetY?: number,
  placement?: { x: number; y: number }
): boolean {
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
    const { damage, radius, projectile } = card.effect;

    addProjectile(
      state,
      side,
      x,
      side === "blue" ? FIELD_HEIGHT - 50 : 50,
      null,
      x,
      y,
      damage,
      radius,
      projectile.style,
      projectile.duration
    );
  } else {
    spawnCard(state, side, card, lane, placement);
  }

  addEvent(state, `${side === "blue" ? "Blue" : "Red"} played ${card.name}.`);
  return true;
}
