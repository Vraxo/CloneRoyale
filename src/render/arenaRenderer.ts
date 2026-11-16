import { Application, Container, Graphics } from "pixi.js";
import type { CardId, GameState, Side, Unit } from "../game/types";
import { cardById } from "../game/cards";
import { getGroundDeploymentZones } from "../game/placement";
import { EffectView } from "./entities/effectView";
import { ProjectileView } from "./entities/projectileView";
import { TowerView } from "./entities/towerView";
import { createUnitView } from "./entities/unitViewFactory";
import type { UnitView } from "./entities/unitView";
import { synchronizeViews } from "./entities/synchronizeViews";
import { createArenaView } from "./arena/arenaView";
import { WorldViewport, HUD_HEIGHT } from "./arena/worldViewport";
import { BattleHud } from "./hud/battleHud";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./arena/arenaView";

export class ArenaRenderer {
  public readonly app = new Application();

  private readonly world = new Container();
  private readonly arena = createArenaView();
  private readonly entities = new Container();
  private readonly unitPreviewLayer = new Container();
  private readonly spellPreview = new Graphics();
  private readonly unitPreviewViews: UnitView[] = [];
  private unitPreviewCardId: CardId | null = null;
  private readonly placementOverlay = new Graphics();
  private readonly invalidDeploymentOverlay = new Graphics();
  private readonly hud = new BattleHud();
  private readonly unitViews = new Map<number, UnitView>();
  private readonly towerViews = new Map<number, TowerView>();
  private readonly projectileViews = new Map<number, ProjectileView>();
  private readonly effectViews = new Map<number, EffectView>();
  private viewport: WorldViewport | null = null;
  private initialized = false;

  public async initialize(host: HTMLElement): Promise<void> {
    await this.hud.loadCardArt();

    await this.app.init({
      resizeTo: host,
      background: "#18221e",
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    });

    host.replaceChildren(this.app.canvas);
    this.entities.sortableChildren = true;
    this.world.addChild(
      this.arena,
      this.invalidDeploymentOverlay,
      this.entities,
      this.unitPreviewLayer,
      this.spellPreview,
      this.placementOverlay
    );
    this.app.stage.addChild(this.world, this.hud.container);
    this.viewport = new WorldViewport(this.app.renderer, this.app.canvas, this.world);
    this.initialized = true;
    this.viewport.fit();
  }

  public screenToWorld(
    clientX: number,
    clientY: number
  ): { x: number; y: number } | null {
    if (!this.initialized || !this.viewport) return null;
    return this.viewport.screenToWorld(clientX, clientY);
  }

  public setPlacementPreview(
    _point: { x: number; y: number } | null,
    _valid = false,
    _radius = 22
  ): void {
    this.placementOverlay.clear();
  }

  public setDeploymentArea(
    state: GameState,
    side: Side,
    cardId: CardId | null
  ): void {
    const overlay = this.invalidDeploymentOverlay;
    overlay.clear();
    if (!cardId) return;

    const card = cardById(cardId);
    const color = 0xd94f4f;
    const alpha = 0.3;

    if (card.category === "spell") {
      const margin = 12;
      overlay.rect(0, 0, WORLD_WIDTH, margin).fill({ color, alpha });
      overlay.rect(0, WORLD_HEIGHT - margin, WORLD_WIDTH, margin).fill({ color, alpha });
      overlay.rect(0, margin, margin, WORLD_HEIGHT - margin * 2).fill({ color, alpha });
      overlay.rect(WORLD_WIDTH - margin, margin, margin, WORLD_HEIGHT - margin * 2)
        .fill({ color, alpha });
      return;
    }

    const zones = getGroundDeploymentZones(state, side, card.unit.radius);
    const boundaries = [...new Set([
      0,
      WORLD_HEIGHT,
      ...zones.flatMap((zone) => [zone.minY, zone.maxY])
    ])].sort((first, second) => first - second);

    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const top = boundaries[index];
      const bottom = boundaries[index + 1];
      if (bottom <= top) continue;

      const middleY = (top + bottom) / 2;
      const validIntervals = zones
        .filter((zone) => middleY >= zone.minY && middleY <= zone.maxY)
        .sort((first, second) => first.minX - second.minX);

      let blockedStart = 0;
      for (const zone of validIntervals) {
        if (zone.minX > blockedStart) {
          overlay.rect(
            blockedStart,
            top,
            zone.minX - blockedStart,
            bottom - top
          ).fill({ color, alpha });
        }
        blockedStart = Math.max(blockedStart, zone.maxX);
      }

      if (blockedStart < WORLD_WIDTH) {
        overlay.rect(
          blockedStart,
          top,
          WORLD_WIDTH - blockedStart,
          bottom - top
        ).fill({ color, alpha });
      }
    }
  }

  public updateBattleHud(
    state: GameState,
    selectedCard: CardId | null,
    message: string
  ): void {
    if (!this.initialized) return;

    this.hud.update(
      state,
      selectedCard,
      message,
      this.app.screen.width,
      this.app.screen.height
    );
  }

  public setUnitPreview(cardId: CardId | null, point: { x: number; y: number } | null): void {
    if (!this.initialized || !point || !cardId) {
      this.clearUnitPreview();
      return;
    }

    const card = cardById(cardId);
    if (card.category === "spell") {
      this.clearUnitPreview();
      this.spellPreview.clear();
      const color = cardId === "fireball" ? 0xff8b3d : 0xd9e8ff;
      const radius = card.effect.radius;
      this.spellPreview
        .circle(point.x, point.y, radius)
        .fill({ color, alpha: 0.2 })
        .stroke({ color, alpha: 0.85, width: 2 });
      return;
    }

    this.spellPreview.clear();

    const spacing = Math.max(18, card.unit.radius * 2 + 8);
    const columns = Math.min(card.count, 5);
    const rows = Math.ceil(card.count / columns);
    const getOffset = (index: number): { x: number; y: number } => ({
      x: (index % columns - (columns - 1) / 2) * spacing,
      y: (Math.floor(index / columns) - (rows - 1) / 2) * spacing
    });

    if (this.unitPreviewCardId !== cardId) {
      this.clearUnitPreview();
      this.unitPreviewCardId = cardId;

      for (let index = 0; index < card.count; index += 1) {
        const offset = getOffset(index);
        const unit = this.createPreviewUnit(
          cardId,
          card.category,
          card.unit,
          index,
          point.x + offset.x,
          point.y + offset.y
        );
        const view = createUnitView(unit);
        view.container.alpha = 0.58;
        this.unitPreviewLayer.addChild(view.container);
        this.unitPreviewViews.push(view);
      }
    }

    const time = performance.now() / 1000;
    for (let index = 0; index < this.unitPreviewViews.length; index += 1) {
      const offset = getOffset(index);
      const unit = this.createPreviewUnit(
        cardId,
        card.category,
        card.unit,
        index,
        point.x + offset.x,
        point.y + offset.y
      );
      const view = this.unitPreviewViews[index];
      view.update(unit, time);
      view.container.alpha = 0.58;
    }
  }

  public clearUnitPreview(): void {
    this.spellPreview.clear();
    for (const view of this.unitPreviewViews) {
      this.unitPreviewLayer.removeChild(view.container);
      view.destroy();
    }
    this.unitPreviewViews.length = 0;
    this.unitPreviewCardId = null;
  }

  private createPreviewUnit(
    cardId: CardId,
    category: "troop" | "building",
    definition: import("../game/types").UnitDefinition,
    index: number,
    x: number,
    y: number
  ): Unit {
    return {
      id: -1000 - index,
      side: "blue",
      cardId,
      type: definition.type,
      kind: category,
      lane: x < 360 ? "left" : "right",
      x,
      y,
      hp: definition.hp,
      maxHp: definition.hp,
      radius: definition.radius,
      collisionMass: definition.collisionMass ?? 1,
      formationSlot: definition.type === "archer" && index < 2
        ? (index === 0 ? -1 : 1)
        : undefined,
      damage: definition.damage,
      speed: definition.speed,
      range: definition.range,
      attackInterval: definition.attackInterval,
      attackCooldown: 0,
      attack: definition.attack,
      splashRadius: definition.splashRadius,
      isAir: definition.isAir,
      canTargetAir: definition.canTargetAir,
      targetsBuildingsOnly: definition.targetsBuildingsOnly,
      lifetime: definition.lifetime,
      age: 0,
      appearanceDelayRemaining: 0,
      deploymentDuration: 0,
      deploymentRemaining: 0,
      facing: -Math.PI / 2,
      animationOffset: index * 0.37,
      attackAnim: 0
    };
  }

  public handCardAt(
    clientX: number,
    clientY: number,
    selectedCard: CardId | null
  ): number | null {
    if (!this.initialized) return null;

    return this.hud.handCardAt(
      clientX,
      clientY,
      this.app.canvas,
      this.app.screen.width,
      this.app.screen.height,
      selectedCard
    );
  }

  public render(state: GameState): void {
    if (!this.initialized) return;
    this.viewport?.fit();

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
    this.clearUnitPreview();
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
}
