import { Graphics } from "pixi.js";

export const WORLD_WIDTH = 720;
export const WORLD_HEIGHT = 960;

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
  g.rect(16, 16, WORLD_WIDTH - 32, 928).fill(0x69845b);
  g.rect(24, 24, WORLD_WIDTH - 48, 420).fill(0x70895e);
  g.rect(24, 516, WORLD_WIDTH - 48, 420).fill(0x637f55);

  for (let row = 0; row < 15; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      const x = 42 + column * 70 + (row % 2) * 14;
      const y = 48 + row * 62;
      g.circle(x, y, 1.5).fill((row + column) % 3 === 0 ? 0x789269 : 0x5c7951);
    }
  }

  for (const laneX of [205, 515]) {
    const laneSegments = [
      { top: 78, height: 370 },
      { top: 512, height: 370 }
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
    { x: 205, y: 448 },
    { x: 205, y: 78 },
    { x: 360, y: 78 }
  ]);
  drawLanePath(g, [
    { x: 515, y: 448 },
    { x: 515, y: 78 },
    { x: 360, y: 78 }
  ]);
  drawLanePath(g, [
    { x: 205, y: 512 },
    { x: 205, y: 882 },
    { x: 360, y: 882 }
  ]);
  drawLanePath(g, [
    { x: 515, y: 512 },
    { x: 515, y: 882 },
    { x: 360, y: 882 }
  ]);

  g.rect(24, 448, 672, 64).fill(0x4b94a0);
  g.rect(24, 455, 672, 50).fill(0x5ba8ad);

  for (const x of [205, 515]) {
    g.roundRect(x - 44, 427, 88, 106, 9).fill(0x8e7450);
    g.roundRect(x - 38, 433, 76, 94, 7).fill(0xa98a5d);
    for (let plank = 0; plank < 7; plank += 1) {
      const y = 438 + plank * 13;
      g.moveTo(x - 37, y).lineTo(x + 37, y).stroke({ color: 0x806744, width: 2 });
    }
    g.moveTo(x - 48, 435).lineTo(x - 48, 525).stroke({ color: 0xc0a070, width: 4 });
    g.moveTo(x + 48, 435).lineTo(x + 48, 525).stroke({ color: 0xc0a070, width: 4 });
  }

  g.roundRect(12, 12, WORLD_WIDTH - 24, WORLD_HEIGHT - 24, 24)
    .stroke({ color: 0xc0b58b, width: 5 });
  g.moveTo(24, 480).lineTo(696, 480)
    .stroke({ color: 0xd1c99c, width: 1, alpha: 0.22 });
  g.circle(360, 480, 6).fill(0x91c1b8);

  return g;
}
