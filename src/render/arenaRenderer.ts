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

function drawLaneConnector(
  graphics: Graphics,
  startX: number,
  endX: number,
  centerY: number
): void {
  const left = Math.min(startX, endX);
  const width = Math.abs(endX - startX);
  const top = centerY - 36;

  graphics.rect(left, top, width, 72)
    .fill({ color: 0x786f4e, alpha: 0.72 });
  graphics.rect(left, top + 5, width, 62)
    .fill({ color: 0x9a8b63, alpha: 0.78 });
  graphics.rect(left, top + 9, width, 54)
    .fill({ color: 0xa2946c, alpha: 0.38 });
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
    this.world.addChild(this.arena, this.entities);
    this.app.stage.addChild(this.world);
    this.drawArena();
    this.initialized = true;
    this.fitWorld();
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
      for (const laneY of [24, 512]) {
        g.roundRect(laneX - 36, laneY, 72, 424, 10)
          .fill({ color: 0x786f4e, alpha: 0.72 });
        g.roundRect(laneX - 31, laneY, 62, 424, 8)
          .fill({ color: 0x9a8b63, alpha: 0.78 });
        g.roundRect(laneX - 27, laneY, 54, 424, 6)
          .fill({ color: 0xa2946c, alpha: 0.38 });

        for (let mark = 0; mark < 13; mark += 1) {
          const y = laneY + 18 + mark * 32;
          const offset = mark % 2 === 0 ? 0 : 13;
          g.circle(laneX - 18 + offset * 0.6, y, 1.5)
            .fill({ color: 0x6e674b, alpha: 0.32 });
          g.circle(laneX + 17 - offset * 0.6, y + 12, 1.2)
            .fill({ color: 0xd0bd8b, alpha: 0.3 });
        }
      }
    }

    drawLaneConnector(g, 205, 360, 78);
    drawLaneConnector(g, 515, 360, 78);
    drawLaneConnector(g, 205, 360, 882);
    drawLaneConnector(g, 515, 360, 882);

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
