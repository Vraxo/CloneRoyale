import { Application, Container, Graphics } from "pixi.js";
import type { Effect, GameState, Projectile, Tower, Unit } from "../game/types";
import { EffectView } from "./entities/effectView";
import { ProjectileView } from "./entities/projectileView";
import { TowerView } from "./entities/towerView";
import { createUnitView } from "./entities/unitViewFactory";
import type { UnitView } from "./entities/unitView";

const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 960;

interface EntityView<T> {
  readonly id: number;
  readonly container: Container;
  update(entity: T, time?: number): void;
  destroy(): void;
}

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

function synchronizeViews<T extends { id: number }, V extends EntityView<T>>(
  entities: T[],
  views: Map<number, V>,
  layer: Container,
  create: (entity: T) => V,
  update: (view: V, entity: T) => void,
  depth: (entity: T) => number
): void {
  const activeIds = new Set<number>();

  for (const entity of entities) {
    activeIds.add(entity.id);

    let view = views.get(entity.id);
    if (!view) {
      view = create(entity);
      views.set(entity.id, view);
      layer.addChild(view.container);
    }

    update(view, entity);
    view.container.zIndex = depth(entity);
  }

  for (const [id, view] of views) {
    if (activeIds.has(id)) continue;

    views.delete(id);
    view.destroy();
  }
}

export class ArenaRenderer {
  public readonly app = new Application();

  private readonly world = new Container();
  private readonly arena = new Graphics();
  private readonly entities = new Container();
  private readonly placementOverlay = new Graphics();
  private readonly unitViews = new Map<number, UnitView>();
  private readonly towerViews = new Map<number, TowerView>();
  private readonly projectileViews = new Map<number, ProjectileView>();
  private readonly effectViews = new Map<number, EffectView>();
  private initialized = false;
  private lastWidth = 0;
  private lastHeight = 0;

  public async initialize(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: "#18221e",
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    });

    host.replaceChildren(this.app.canvas);
    this.entities.sortableChildren = true;
    this.world.addChild(this.arena, this.entities, this.placementOverlay);
    this.app.stage.addChild(this.world);
    this.drawArena();
    this.initialized = true;
    this.fitWorld();
  }

  public screenToWorld(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!this.initialized) return null;
    this.fitWorld();

    const rect = this.app.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const screenX = (clientX - rect.left) * (this.app.screen.width / rect.width);
    const screenY = (clientY - rect.top) * (this.app.screen.height / rect.height);
    const scale = this.world.scale.x;
    const x = (screenX - this.world.position.x) / scale;
    const y = (screenY - this.world.position.y) / scale;

    if (x < 0 || x > WORLD_WIDTH || y < 0 || y > WORLD_HEIGHT) return null;
    return { x, y };
  }

  public setPlacementPreview(
    point: { x: number; y: number } | null,
    valid = false,
    radius = 22
  ): void {
    this.placementOverlay.clear();
    if (!point) return;

    const color = valid ? 0x9ecb79 : 0xd56f68;
    this.placementOverlay
      .circle(point.x, point.y, radius)
      .fill({ color, alpha: 0.2 });
    this.placementOverlay
      .circle(point.x, point.y, radius)
      .stroke({ color, alpha: 0.92, width: 2 });
    this.placementOverlay
      .circle(point.x, point.y, 3)
      .fill({ color, alpha: 0.95 });
  }

  public render(state: GameState): void {
    if (!this.initialized) return;
    this.fitWorld();

    synchronizeViews(
      state.towers,
      this.towerViews,
      this.entities,
      (tower) => new TowerView(tower),
      (view, tower) => view.update(tower),
      (tower) => tower.y
    );

    synchronizeViews(
      state.units,
      this.unitViews,
      this.entities,
      createUnitView,
      (view, unit) => view.update(unit, state.time),
      (unit) => unit.y + unit.radius
    );

    synchronizeViews(
      state.projectiles,
      this.projectileViews,
      this.entities,
      (projectile) => new ProjectileView(projectile),
      (view, projectile) => view.update(projectile),
      (projectile) => projectile.y + 1000
    );

    synchronizeViews(
      state.effects,
      this.effectViews,
      this.entities,
      (effect) => new EffectView(effect),
      (view, effect) => view.update(effect),
      (effect) => effect.style === "deployment" ? effect.y - 1 : effect.y + 2000
    );
  }

  public destroy(): void {
    for (const view of this.unitViews.values()) view.destroy();
    for (const view of this.towerViews.values()) view.destroy();
    for (const view of this.projectileViews.values()) view.destroy();
    for (const view of this.effectViews.values()) view.destroy();

    this.unitViews.clear();
    this.towerViews.clear();
    this.projectileViews.clear();
    this.effectViews.clear();
    this.app.destroy(true);
  }

  private fitWorld(): void {
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    if (width === this.lastWidth && height === this.lastHeight) return;

    this.lastWidth = width;
    this.lastHeight = height;
    const scale = Math.min((width - 20) / WORLD_WIDTH, (height - 20) / WORLD_HEIGHT);
    this.world.scale.set(scale);
    this.world.position.set(
      (width - WORLD_WIDTH * scale) / 2,
      (height - WORLD_HEIGHT * scale) / 2
    );
  }

  private drawArena(): void {
    const g = this.arena;
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

    g.roundRect(12, 12, WORLD_WIDTH - 24, WORLD_HEIGHT - 24, 24).stroke({ color: 0xc0b58b, width: 5 });
    g.moveTo(24, 480).lineTo(696, 480).stroke({ color: 0xd1c99c, width: 1, alpha: 0.22 });
    g.circle(360, 480, 6).fill(0x91c1b8);
  }
}
