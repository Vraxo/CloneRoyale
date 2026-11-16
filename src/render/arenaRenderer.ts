import { Application, Container, Graphics } from "pixi.js";
import type { CardId, GameState, Side } from "../game/types";
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

  public setHeldCardPreview(
    cardId: CardId | null,
    clientX: number,
    clientY: number
  ): void {
    if (!this.initialized) return;

    this.hud.setHeldCardPreview(
      cardId,
      clientX,
      clientY,
      this.app.canvas,
      this.app.screen.width,
      this.app.screen.height
    );
  }

  public handCardAt(clientX: number, clientY: number): number | null {
    if (!this.initialized) return null;

    return this.hud.handCardAt(
      clientX,
      clientY,
      this.app.canvas,
      this.app.screen.width,
      this.app.screen.height
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
