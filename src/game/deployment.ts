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

  const appearanceDelay = 1;
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
      health: { hp: definition.hp, maxHp: definition.hp },
      movement: {
        speed: definition.speed,
        isAir: definition.isAir,
        formationSlot: definition.type === "archer" && card.count === 2
          ? (index === 0 ? -1 : 1)
          : undefined
      },
      collision: { radius: definition.radius, mass: definition.collisionMass ?? 1 },
      damage: definition.damage,
      range: definition.range,
      attackInterval: definition.attackInterval,
      attackCooldown: 0.25 + nextRandom(state) * 0.35,
      attack: definition.attack,
      splashRadius: definition.splashRadius,
      targeting: {
        canTargetAir: definition.canTargetAir,
        targetsBuildingsOnly: definition.targetsBuildingsOnly
      },
      lifetime: { duration: definition.lifetime, elapsed: 0 },
      deployment: {
        appearanceDelay,
        duration: deploymentDuration,
        remaining: deploymentDuration
      },
      facing: side === "blue" ? -Math.PI / 2 : Math.PI / 2,
      presentation: {
        animationOffset: nextRandom(state) * Math.PI * 2,
        attackAnim: 0
      }
    });


  }

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
    if (cardId === "fireball") state.audioEvents.push("fireball-launch");

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
