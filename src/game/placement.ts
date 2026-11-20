import type { CardId, ReadonlyGameState, Side } from "./types";
import { cardById } from "./cards";
import { ARENA_TILE_SIZE, FIELD_HEIGHT, FIELD_WIDTH, RIVER_BOTTOM, RIVER_TOP } from "./state";
const DESTROYED_TOWER_LANE_DEPTH = 9 * ARENA_TILE_SIZE;

export interface DeploymentZone {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function snapToArenaTile(point: { x: number; y: number }): { x: number; y: number } {
  const halfTile = ARENA_TILE_SIZE / 2;
  return {
    x: Math.max(halfTile, Math.min(
      FIELD_WIDTH - halfTile,
      Math.floor(point.x / ARENA_TILE_SIZE) * ARENA_TILE_SIZE + halfTile
    )),
    y: Math.max(halfTile, Math.min(
      FIELD_HEIGHT - halfTile,
      Math.floor(point.y / ARENA_TILE_SIZE) * ARENA_TILE_SIZE + halfTile
    ))
  };
}

export function getGroundDeploymentZones(
  state: ReadonlyGameState,
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
        ? RIVER_TOP - DESTROYED_TOWER_LANE_DEPTH + radius
        : ownMinY,
      maxY: side === "blue"
        ? ownMaxY
        : RIVER_BOTTOM + DESTROYED_TOWER_LANE_DEPTH - radius
    });
  }

  return zones.filter((zone) =>
    zone.minX <= zone.maxX && zone.minY <= zone.maxY
  );
}

export function canPlaceCard(
  state: ReadonlyGameState,
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
