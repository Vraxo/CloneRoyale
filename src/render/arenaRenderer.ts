import { Application, Container, Graphics, Text } from "pixi.js";
import type { CardId, Effect, GameState, Projectile, Tower, Unit } from "../game/types";
import { cardById } from "../game/cards";
import { EffectView } from "./entities/effectView";
import { ProjectileView } from "./entities/projectileView";
import { TowerView } from "./entities/towerView";
import { createUnitView } from "./entities/unitViewFactory";
import type { UnitView } from "./entities/unitView";

const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 960;
const HUD_HEIGHT = 176;

function createHudText(fontSize: number, fill: number): Text {
  const label = new Text({
    text: "",
    style: {
      fontFamily: "Arial, sans-serif",
      fontSize,
      fill,
      fontWeight: "700",
      align: "center"
    }
  });
  label.eventMode = "none";
  return label;
}

function cardGlyph(cardId: CardId | undefined): string {
  switch (cardId) {
    case "giant": return "G";
    case "archers": return "A";
    case "mini-pekka": return "P";
    case "baby-dragon": return "D";
    case "skeleton-army": return "S";
    case "cannon": return "C";
    case "fireball": return "F";
    case "arrows": return "↗";
    default: return "";
  }
}

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
  private readonly battleHud = new Container();
  private readonly hudGraphics = new Graphics();
  private readonly cardGlyphs = Array.from({ length: 4 }, () => createHudText(25, 0xf0dfb6));
  private readonly cardNames = Array.from({ length: 4 }, () => createHudText(11, 0xf4eedc));
  private readonly cardCosts = Array.from({ length: 4 }, () => createHudText(12, 0xffffff));
  private readonly nextCardName = createHudText(9, 0xe7dfca);
  private readonly elixirValue = createHudText(17, 0xf1d8ff);
  private readonly elixirMax = createHudText(8, 0xc1a5d8);
  private readonly placementHint = createHudText(9, 0xc9d1c2);
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
    this.battleHud.eventMode = "none";
    this.battleHud.addChild(
      this.hudGraphics,
      ...this.cardGlyphs,
      ...this.cardNames,
      ...this.cardCosts,
      this.nextCardName,
      this.elixirValue,
      this.elixirMax,
      this.placementHint
    );
    this.app.stage.addChild(this.world, this.battleHud);
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

  public updateBattleHud(
    state: GameState,
    selectedCard: CardId | null,
    message: string
  ): void {
    if (!this.initialized) return;

    const layout = this.hudLayout();
    const graphics = this.hudGraphics;
    const blue = state.sides.blue;
    const nextCardId = blue.drawPile[blue.drawIndex % blue.drawPile.length];

    graphics.clear();
    graphics
      .roundRect(7, layout.top + 4, layout.width - 14, HUD_HEIGHT - 8, 15)
      .fill({ color: 0x202923, alpha: 0.98 });
    graphics
      .roundRect(7, layout.top + 4, layout.width - 14, HUD_HEIGHT - 8, 15)
      .stroke({ color: 0x58634c, alpha: 0.95, width: 1.5 });
    graphics
      .rect(18, layout.top + 5, layout.width - 36, 2)
      .fill({ color: 0xc1a76e, alpha: 0.62 });

    const nextX = layout.padding;
    const nextY = layout.cardY + 16;
    graphics
      .roundRect(nextX, nextY, layout.nextWidth, layout.cardHeight - 16, 7)
      .fill({ color: 0x303a34, alpha: 1 });
    graphics
      .roundRect(nextX, nextY, layout.nextWidth, layout.cardHeight - 16, 7)
      .stroke({ color: 0x7c806a, width: 1 });
    this.nextCardName.text = cardById(nextCardId).name;
    this.nextCardName.anchor.set(0.5);
    this.nextCardName.position.set(nextX + layout.nextWidth / 2, nextY + (layout.cardHeight - 16) / 2);
    this.nextCardName.style.fontSize = Math.max(7, Math.min(9, layout.nextWidth * 0.15));
    this.nextCardName.style.wordWrap = true;
    this.nextCardName.style.wordWrapWidth = layout.nextWidth - 8;

    graphics
      .roundRect(nextX + 5, layout.cardY - 1, layout.nextWidth - 10, 14, 4)
      .fill({ color: 0x4b3d62 });
    // "NEXT" is rendered as part of the text itself to keep the preview compact.
    this.nextCardName.text = `NEXT\n${cardById(nextCardId).name}`;
    this.nextCardName.position.set(nextX + layout.nextWidth / 2, nextY + (layout.cardHeight - 16) / 2);
    this.nextCardName.style.fontSize = Math.max(7, Math.min(9, layout.nextWidth * 0.15));

    for (let index = 0; index < 4; index += 1) {
      const cardId = blue.hand[index];
      const card = cardId ? cardById(cardId) : null;
      const rect = layout.cards[index];
      const affordable = card !== null && blue.elixir >= card.cost;
      const isSelected = cardId !== undefined && cardId === selectedCard;
      const fill = card?.category === "spell"
        ? 0x4b4662
        : card?.category === "building" ? 0x55513e : 0x35473d;
      const border = isSelected ? 0xe3c77d : affordable ? 0x9b936d : 0x576057;

      graphics
        .roundRect(rect.x, rect.y, rect.width, rect.height, 8)
        .fill({ color: fill, alpha: affordable ? 1 : 0.54 });
      graphics
        .roundRect(rect.x, rect.y, rect.width, rect.height, 8)
        .stroke({ color: border, alpha: 1, width: isSelected ? 3 : 1.5 });

      graphics
        .roundRect(rect.x + 5, rect.y + 5, rect.width - 10, rect.height - 10, 5)
        .stroke({ color: 0xe4d7ad, alpha: affordable ? 0.22 : 0.1, width: 1 });

      const glyph = this.cardGlyphs[index];
      const name = this.cardNames[index];
      const cost = this.cardCosts[index];
      glyph.text = card ? cardGlyph(cardId) : "";
      glyph.anchor.set(0.5);
      glyph.position.set(rect.x + rect.width / 2, rect.y + rect.height * 0.38);
      glyph.alpha = affordable ? 1 : 0.45;
      glyph.style.fontSize = Math.max(16, Math.min(27, rect.width * 0.2));

      name.text = card?.name ?? "";
      name.anchor.set(0.5);
      name.position.set(rect.x + rect.width / 2, rect.y + rect.height - 14);
      name.style.fontSize = Math.max(7, Math.min(11, rect.width * 0.085));
      name.style.wordWrap = true;
      name.style.wordWrapWidth = rect.width - 12;
      name.alpha = affordable ? 1 : 0.52;

      const badgeX = rect.x + rect.width - 14;
      const badgeY = rect.y + 14;
      graphics.circle(badgeX, badgeY, 12).fill({ color: 0x76569a, alpha: 0.98 });
      graphics.circle(badgeX, badgeY, 12).stroke({ color: 0xc2a4df, width: 1 });
      cost.text = card ? card.cost.toString() : "";
      cost.anchor.set(0.5);
      cost.position.set(badgeX, badgeY + 0.5);
      cost.alpha = affordable ? 1 : 0.55;
    }

    const meterX = layout.padding + 2;
    const meterY = layout.top + 112;
    const meterWidth = layout.width - layout.padding * 2 - 4;
    graphics
      .roundRect(meterX, meterY, meterWidth, 17, 8)
      .fill({ color: 0x3c3048 });
    graphics
      .roundRect(meterX, meterY, meterWidth * Math.max(0, Math.min(1, blue.elixir / 10)), 17, 8)
      .fill({ color: 0x9956c8 });
    for (let tick = 1; tick < 10; tick += 1) {
      const x = meterX + meterWidth * tick / 10;
      graphics.moveTo(x, meterY + 2).lineTo(x, meterY + 15)
        .stroke({ color: 0x2d2639, alpha: 0.6, width: 1 });
    }

    this.elixirValue.text = blue.elixir.toFixed(1);
    this.elixirValue.anchor.set(0, 0.5);
    this.elixirValue.position.set(meterX + 7, meterY + 8.5);
    this.elixirMax.text = "MAX 10";
    this.elixirMax.anchor.set(1, 0.5);
    this.elixirMax.position.set(meterX + meterWidth - 7, meterY + 8.5);

    this.placementHint.text = message;
    this.placementHint.anchor.set(0.5);
    this.placementHint.position.set(layout.width / 2, layout.top + 151);
    this.placementHint.style.fontSize = Math.max(8, Math.min(10, layout.width * 0.014));
    this.placementHint.style.wordWrap = true;
    this.placementHint.style.wordWrapWidth = layout.width - 28;
  }

  public handCardAt(clientX: number, clientY: number): number | null {
    const point = this.clientToScreen(clientX, clientY);
    if (!point) return null;

    const layout = this.hudLayout();
    const index = layout.cards.findIndex((card) =>
      point.x >= card.x && point.x <= card.x + card.width
      && point.y >= card.y && point.y <= card.y + card.height
    );

    return index >= 0 ? index : null;
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
    const availableHeight = Math.max(160, height - HUD_HEIGHT);
    const scale = Math.min((width - 20) / WORLD_WIDTH, (availableHeight - 20) / WORLD_HEIGHT);
    this.world.scale.set(scale);
    this.world.position.set(
      (width - WORLD_WIDTH * scale) / 2,
      (availableHeight - WORLD_HEIGHT * scale) / 2
    );
    this.battleHud.position.set(0, 0);
  }

  private clientToScreen(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!this.initialized) return null;
    const rect = this.app.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: (clientX - rect.left) * (this.app.screen.width / rect.width),
      y: (clientY - rect.top) * (this.app.screen.height / rect.height)
    };
  }

  private hudLayout(): {
    width: number;
    top: number;
    padding: number;
    nextWidth: number;
    cardY: number;
    cardHeight: number;
    cards: { x: number; y: number; width: number; height: number }[];
  } {
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    const padding = Math.max(10, Math.min(16, width * 0.022));
    const nextWidth = Math.max(48, Math.min(62, width * 0.09));
    const cardY = height - HUD_HEIGHT + 20;
    const cardHeight = 86;
    const startX = padding + nextWidth + 9;
    const gap = Math.max(5, Math.min(8, width * 0.01));
    const cardWidth = (width - startX - padding - gap * 3) / 4;
    const cards = Array.from({ length: 4 }, (_, index) => ({
      x: startX + index * (cardWidth + gap),
      y: cardY,
      width: cardWidth,
      height: cardHeight
    }));

    return {
      width,
      top: height - HUD_HEIGHT,
      padding,
      nextWidth,
      cardY,
      cardHeight,
      cards
    };
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
