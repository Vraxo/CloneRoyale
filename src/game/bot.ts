import { cardById } from "./cards";
import type { CardId, GameState, Lane, Side, Unit } from "./types";

export interface BotDecision {
  cardId: CardId;
  lane: Lane;
  targetX?: number;
  targetY?: number;
}

const LANE_X: Record<Lane, number> = { left: 205, right: 515 };

function otherSide(side: Side): Side {
  return side === "blue" ? "red" : "blue";
}

function isOnOwnHalf(unit: Unit, side: Side): boolean {
  return side === "blue" ? unit.y > 480 : unit.y < 480;
}

function laneForX(x: number): Lane {
  return x < 360 ? "left" : "right";
}

function bestEnemyCluster(enemies: Unit[], radius: number): { x: number; y: number; count: number; units: Unit[] } | null {
  let best: { x: number; y: number; count: number; units: Unit[] } | null = null;

  for (const candidate of enemies) {
    const nearby = enemies.filter((unit) => Math.hypot(unit.x - candidate.x, unit.y - candidate.y) <= radius);
    if (!best || nearby.length > best.count) {
      const x = nearby.reduce((sum, unit) => sum + unit.x, 0) / nearby.length;
      const y = nearby.reduce((sum, unit) => sum + unit.y, 0) / nearby.length;
      best = { x, y, count: nearby.length, units: nearby };
    }
  }

  return best;
}

function chooseLane(state: GameState, side: Side): Lane {
  const friendly = state.units.filter((unit) => unit.side === side && unit.kind === "troop");
  const leftCount = friendly.filter((unit) => unit.lane === "left").length;
  const rightCount = friendly.length - leftCount;

  if (leftCount !== rightCount) {
    return leftCount < rightCount ? "left" : "right";
  }

  return Math.floor(state.time / 5 + (side === "blue" ? 0 : 1)) % 2 === 0 ? "left" : "right";
}

export function chooseBotAction(state: GameState, side: Side): BotDecision | null {
  const own = state.sides[side];
  const enemySide = otherSide(side);
  const enemies = state.units.filter((unit) => unit.side === enemySide && unit.kind === "troop");
  const threats = enemies.filter((unit) => isOnOwnHalf(unit, side));
  const ownTroops = state.units.filter((unit) => unit.side === side && unit.kind === "troop");
  const affordable = new Set<CardId>(
    own.hand.filter((cardId) => cardById(cardId).cost <= own.elixir)
  );
  const defaultLane = chooseLane(state, side);

  if (affordable.size === 0) return null;

  const swarm = threats.filter((unit) => unit.cardId === "skeleton-army");
  const arrowsCluster = bestEnemyCluster(swarm, 150);
  if (affordable.has("arrows") && arrowsCluster && arrowsCluster.count >= 5) {
    return { cardId: "arrows", lane: laneForX(arrowsCluster.x), targetX: arrowsCluster.x, targetY: arrowsCluster.y };
  }

  const fireballCluster = bestEnemyCluster(threats, 92);
  if (affordable.has("fireball") && fireballCluster && fireballCluster.count >= 3) {
    return { cardId: "fireball", lane: laneForX(fireballCluster.x), targetX: fireballCluster.x, targetY: fireballCluster.y };
  }

  const enemyGiant = threats.find((unit) => unit.cardId === "giant");
  if (enemyGiant && affordable.has("mini-pekka")) {
    return { cardId: "mini-pekka", lane: enemyGiant.lane };
  }

  if (threats.length >= 3 && affordable.has("cannon")) {
    const lane = threats.filter((unit) => unit.lane === "left").length >= threats.filter((unit) => unit.lane === "right").length
      ? "left"
      : "right";
    return { cardId: "cannon", lane };
  }

  if ((swarm.length >= 3 || threats.length >= 4) && affordable.has("baby-dragon")) {
    const cluster = bestEnemyCluster(threats, 130);
    return { cardId: "baby-dragon", lane: cluster ? laneForX(cluster.x) : defaultLane };
  }

  const enemyTank = threats.find((unit) => unit.hp > 650);
  const friendlySplashNearby = ownTroops.some((unit) =>
    unit.type === "baby-dragon" && Math.hypot(unit.x - (enemyTank?.x ?? 0), unit.y - (enemyTank?.y ?? 0)) < 180
  );
  if (enemyTank && !friendlySplashNearby && affordable.has("skeleton-army")) {
    return { cardId: "skeleton-army", lane: enemyTank.lane };
  }

  const friendlyTanks = ownTroops.filter((unit) => unit.cardId === "giant").length;
  if (affordable.has("giant") && friendlyTanks === 0) {
    return { cardId: "giant", lane: defaultLane };
  }

  const friendlyArchers = ownTroops.filter((unit) => unit.cardId === "archers").length;
  if (affordable.has("archers") && friendlyArchers < 2) {
    return { cardId: "archers", lane: defaultLane };
  }

  const priority: CardId[] = [
    "mini-pekka",
    "baby-dragon",
    "skeleton-army",
    "cannon",
    "archers",
    "giant",
    "fireball",
    "arrows"
  ];
  const cardId = priority.find((candidate) => affordable.has(candidate));
  if (!cardId) return null;

  const card = cardById(cardId);
  const cluster = card.category === "spell"
    ? bestEnemyCluster(threats, card.effect.radius)
    : null;

  return {
    cardId,
    lane: cluster ? laneForX(cluster.x) : defaultLane,
    ...(cluster ? { targetX: cluster.x, targetY: cluster.y } : { targetX: LANE_X[defaultLane] })
  };
}
