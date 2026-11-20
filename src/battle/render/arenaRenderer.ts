import { Application, Container, Graphics } from "pixi.js";
import type { CardId, Lane, ReadonlyGameState, Side, Unit, UnitCardDefinition } from "../../game/types";
import { cardById } from "../../game/cards";
import { getGroundDeploymentZones } from "../../game/placement";
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
      background: "#0b1e38",
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
    state: ReadonlyGameState,
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

    const zones = getGroundDeploymentZones(state, side, card.unit.collision.radius);
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
    state: ReadonlyGameState,
    selectedCard: CardId | null,
    message: string,
    side: Side = "blue"
  ): void {
    if (!this.initialized) return;

    this.hud.update(
      state,
      selectedCard,
      message,
      this.app.screen.width,
      this.app.screen.height,
      side
    );
  }

  public setUnitPreview(cardId: CardId | null, point: { x: number; y: number } | null, side: Side = "blue"): void {
    if (!this.initialized || !point || !cardId) {
      this.clearUnitPreview();
      return;
    }

    const card = cardById(cardId);
    if (card.category === "spell") {
      this.clearUnitPreview();
      this.spellPreview.clear();
      const radius = card.effect.radius;
      if (card.preview?.style === "arrows") {
        const accent = side === "red" ? 0xd17a70 : 0x78a8d2;
        this.spellPreview
          .circle(point.x, point.y, radius)
          .fill({ color: 0xe5c47f, alpha: 0.045 })
          .stroke({ color: 0xe5c47f, alpha: 0.84, width: 2 });

        this.spellPreview
          .circle(point.x, point.y, radius * 0.91)
          .stroke({ color: 0x55452e, alpha: 0.34, width: 1 });

        for (let index = 0; index < 16; index += 1) {
          const angle = (Math.PI * 2 * index) / 16;
          this.spellPreview
            .moveTo(
              point.x + Math.cos(angle) * radius * 0.91,
              point.y + Math.sin(angle) * radius * 0.91
            )
            .lineTo(
              point.x + Math.cos(angle) * radius * 1.025,
              point.y + Math.sin(angle) * radius * 1.025
            )
            .stroke({ color: accent, alpha: 0.78, width: 2.2, cap: "round" });
        }

        this.spellPreview
          .circle(point.x, point.y, 3.5)
          .fill({ color: 0xffe6ac, alpha: 0.94 });
        return;
      }

      const color = 0xff8b3d;
      this.spellPreview
        .circle(point.x, point.y, radius)
        .fill({ color, alpha: 0.2 })
        .stroke({ color, alpha: 0.85, width: 2 });
      return;
    }

    this.spellPreview.clear();

    const spacing = Math.max(18, card.unit.collision.radius * 2 + 8);
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
          card,
          index,
          point.x + offset.x,
          point.y + offset.y,
          side
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
        card,
        index,
        point.x + offset.x,
        point.y + offset.y,
        side
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
    card: UnitCardDefinition,
    index: number,
    x: number,
    y: number,
    side: Side
  ): Unit {
    const definition = card.unit;
    const unit = {
      id: -1000 - index,
      side,
      cardId: card.id,
      type: definition.identity.type,
      lane: (x < WORLD_WIDTH / 2 ? "left" : "right") as Lane,
      transform: { x, y, facing: side === "blue" ? -Math.PI / 2 : Math.PI / 2 },
      health: { hp: definition.health.hp, maxHp: definition.health.hp },
      collision: { radius: definition.collision.radius, mass: definition.collision.mass ?? 1 },
      combat: {
        damage: definition.combat.damage,
        range: definition.combat.range,
        attackInterval: definition.combat.attackInterval,
        attackCooldown: 0,
        attack: definition.combat.attack,
        splashRadius: definition.combat.splashRadius
      },
      targeting: {
        canTargetAir: definition.targeting.canTargetAir,
        targetsBuildingsOnly: definition.targeting.targetsBuildingsOnly
      },
      lifetime: { duration: definition.lifetime.duration, elapsed: 0 },
      audio: definition.audio,
      deployment: { appearanceDelay: 0, duration: 0, remaining: 0 },
      presentation: {
        animationOffset: index * 0.37,
        attackAnim: 0
      }
    };

    if (card.category === "building") return { ...unit, kind: "building" };
    return {
      ...unit,
      kind: "troop",
      movement: {
        speed: card.unit.movement.speed,
        isAir: card.unit.movement.isAir,
        formationSlot: definition.formation?.pattern === "paired" && index < 2
          ? (index === 0 ? -1 : 1)
          : undefined
      }
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

  public render(state: ReadonlyGameState): void {
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
      (unit) => unit.transform.y + unit.collision.radius
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
