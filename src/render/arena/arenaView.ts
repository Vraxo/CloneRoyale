import { Graphics } from "pixi.js";
import { ARENA_TILE_SIZE, FIELD_HEIGHT, FIELD_WIDTH, KING_TOWER_Y, RIVER_BOTTOM, RIVER_TOP } from "../../game/state";

export const WORLD_WIDTH = FIELD_WIDTH;
export const WORLD_HEIGHT = FIELD_HEIGHT;

function drawLanePath(
  graphics: Graphics,
  points: { x: number; y: number }[]
): void {
  const drawLayer = (width: number, color: number, alpha: number): void => {
    graphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y);
    }
    graphics.stroke({
      color,
      alpha,
      width,
      cap: "butt",
      join: "miter"
    });
  };

  drawLayer(24, 0x786f4e, 0.72);
  drawLayer(18, 0x9a8b63, 0.78);
  drawLayer(14, 0xa2946c, 0.38);
}

export function createArenaView(): Graphics {
  const g = new Graphics();
  g.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(0x58734f);
  g.rect(16, 16, WORLD_WIDTH - 32, WORLD_HEIGHT - 32).fill(0x69845b);
  g.rect(24, 24, WORLD_WIDTH - 48, RIVER_TOP - 24).fill(0x70895e);
  g.rect(24, RIVER_BOTTOM, WORLD_WIDTH - 48, WORLD_HEIGHT - RIVER_BOTTOM - 24).fill(0x637f55);

  for (let y = 0; y < WORLD_HEIGHT; y += ARENA_TILE_SIZE) {
    for (let x = 0; x < WORLD_WIDTH; x += ARENA_TILE_SIZE) {
      if ((x / ARENA_TILE_SIZE + y / ARENA_TILE_SIZE) % 2 === 0) {
        g.rect(x, y, ARENA_TILE_SIZE, ARENA_TILE_SIZE)
          .fill({ color: 0x9bb58a, alpha: 0.035 });
      }
    }
  }

  for (let row = 0; row < 15; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const x = 42 + column * 70 + (row % 2) * 14;
      const y = 48 + row * 62;
      g.circle(x, y, 1.5).fill((row + column) % 3 === 0 ? 0x789269 : 0x5c7951);
    }
  }

  for (const laneX of [FIELD_WIDTH * 7 / 36, FIELD_WIDTH * 29 / 36]) {
    const laneSegments = [
      { top: KING_TOWER_Y, height: RIVER_TOP - KING_TOWER_Y },
      { top: RIVER_BOTTOM, height: FIELD_HEIGHT - KING_TOWER_Y - RIVER_BOTTOM }
    ];

    for (const segment of laneSegments) {
      const markCount = Math.floor(segment.height / 32);
      for (let mark = 0; mark < markCount; mark += 1) {
        const y = segment.top + 18 + mark * 32;
        const offset = mark % 2 === 0 ? 0 : 7;
        g.circle(laneX - 7 + offset, y, 1.1)
          .fill({ color: 0x6e674b, alpha: 0.32 });
        g.circle(laneX + 7 - offset, y + 12, 0.9)
          .fill({ color: 0xd0bd8b, alpha: 0.3 });
      }
    }
  }

  drawLanePath(g, [
    { x: FIELD_WIDTH * 7 / 36, y: RIVER_TOP },
    { x: FIELD_WIDTH * 7 / 36, y: KING_TOWER_Y },
    { x: FIELD_WIDTH / 2, y: KING_TOWER_Y }
  ]);
  drawLanePath(g, [
    { x: FIELD_WIDTH * 29 / 36, y: RIVER_TOP },
    { x: FIELD_WIDTH * 29 / 36, y: KING_TOWER_Y },
    { x: FIELD_WIDTH / 2, y: KING_TOWER_Y }
  ]);
  drawLanePath(g, [
    { x: FIELD_WIDTH * 7 / 36, y: RIVER_BOTTOM },
    { x: FIELD_WIDTH * 7 / 36, y: FIELD_HEIGHT - KING_TOWER_Y },
    { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT - KING_TOWER_Y }
  ]);
  drawLanePath(g, [
    { x: FIELD_WIDTH * 29 / 36, y: RIVER_BOTTOM },
    { x: FIELD_WIDTH * 29 / 36, y: FIELD_HEIGHT - KING_TOWER_Y },
    { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT - KING_TOWER_Y }
  ]);

  g.rect(24, RIVER_TOP, WORLD_WIDTH - 48, RIVER_BOTTOM - RIVER_TOP).fill(0x4b94a0);
  g.rect(24, RIVER_TOP + 7, WORLD_WIDTH - 48, RIVER_BOTTOM - RIVER_TOP - 14).fill(0x5ba8ad);

  for (const x of [FIELD_WIDTH * 7 / 36, FIELD_WIDTH * 29 / 36]) {
    g.roundRect(x - 45, RIVER_TOP - 21, 90, RIVER_BOTTOM - RIVER_TOP + 42, 9).fill(0x8e7450);
    g.roundRect(x - 39, RIVER_TOP - 15, 78, RIVER_BOTTOM - RIVER_TOP + 30, 7).fill(0xa98a5d);
    for (let plank = 0; plank < 7; plank += 1) {
      const y = RIVER_TOP - 10 + plank * 13;
      g.moveTo(x - 38, y).lineTo(x + 38, y).stroke({ color: 0x806744, width: 2 });
    }
    g.moveTo(x - 48, RIVER_TOP - 13).lineTo(x - 48, RIVER_BOTTOM + 13).stroke({ color: 0xc0a070, width: 4 });
    g.moveTo(x + 48, RIVER_TOP - 13).lineTo(x + 48, RIVER_BOTTOM + 13).stroke({ color: 0xc0a070, width: 4 });
  }

  for (let column = 1; column < WORLD_WIDTH / ARENA_TILE_SIZE; column += 1) {
    const x = column * ARENA_TILE_SIZE;
    const major = column % 3 === 0;
    g.moveTo(x, 0).lineTo(x, WORLD_HEIGHT).stroke({
      color: major ? 0x263b2d : 0x304733,
      alpha: major ? 0.2 : 0.105,
      width: major ? 1.2 : 0.7
    });
  }

  for (let row = 1; row < WORLD_HEIGHT / ARENA_TILE_SIZE; row += 1) {
    const y = row * ARENA_TILE_SIZE;
    const major = row % 3 === 0;
    g.moveTo(0, y).lineTo(WORLD_WIDTH, y).stroke({
      color: major ? 0x263b2d : 0x304733,
      alpha: major ? 0.2 : 0.105,
      width: major ? 1.2 : 0.7
    });
  }

  g.roundRect(12, 12, WORLD_WIDTH - 24, WORLD_HEIGHT - 24, 24)
    .stroke({ color: 0xc0b58b, width: 5 });
  g.moveTo(24, WORLD_HEIGHT / 2).lineTo(WORLD_WIDTH - 24, WORLD_HEIGHT / 2)
    .stroke({ color: 0xd1c99c, width: 1, alpha: 0.22 });
  g.circle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 6).fill(0x91c1b8);

  return g;
}
