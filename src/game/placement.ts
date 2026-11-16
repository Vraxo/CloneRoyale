import type { CardId, GameState, Side } from "./types";
import { cardById } from "./cards";
import { FIELD_HEIGHT, FIELD_WIDTH } from "./state";

const RIVER_TOP = 448;
const RIVER_BOTTOM = 512;
const ARENA_ROWS = 32;
const POCKET_DEPTH = FIELD_HEIGHT / ARENA_ROWS * 3;

export interface DeploymentZone {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function getGroundDeploymentZones(
  state: GameState,
  side: Side,
  radius: number
): DeploymentZone[] {
  const minX = radius + 12;
  const maxX = FIELD_WIDTH - radius - 12;
  const ownMinY = side === "blue"
    ? RIVER_BOTTOM + radius + 8
    : radius + 12;
  const ownMaxY = side === "blue"
    ? FIELD_HEIGHT - radius - 12
    : RIVER_TOP - radius - 8;

  const zones: DeploymentZone[] = [{
    minX,
    maxX,
    minY: ownMinY,
    maxY: ownMaxY
  }];

  for (const lane of ["left", "right"] as const) {
    const pocketUnlocked = state.towers.some((tower) =>
      tower.side !== side
      && tower.kind === "princess"
      && tower.lane === lane
      && tower.hp <= 0
    );
    if (!pocketUnlocked) continue;

    const isLeftLane = lane === "left";
    zones.push({
      minX: isLeftLane ? minX : FIELD_WIDTH / 2,
      maxX: isLeftLane ? FIELD_WIDTH / 2 : maxX,
      minY: side === "blue"
        ? RIVER_TOP - POCKET_DEPTH + radius
        : RIVER_BOTTOM + radius,
      maxY: side === "blue"
        ? RIVER_TOP - radius
        : RIVER_BOTTOM + POCKET_DEPTH - radius
    });
  }

  return zones.filter((zone) =>
    zone.minX <= zone.maxX && zone.minY <= zone.maxY
  );
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
    return x >= 12 && x <= FIELD_WIDTH - 12
      && y >= 12 && y <= FIELD_HEIGHT - 12;
  }

  return getGroundDeploymentZones(state, side, card.unit.radius).some((zone) =>
    x >= zone.minX && x <= zone.maxX
    && y >= zone.minY && y <= zone.maxY
  );
}
