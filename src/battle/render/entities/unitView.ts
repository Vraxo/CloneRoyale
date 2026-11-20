import { ColorMatrixFilter, Container, Graphics } from "pixi.js";
import type { DeepReadonly, Unit } from "../../../game/types";

export abstract class UnitView {
  public readonly id: number;
  public readonly container = new Container();

  protected readonly body = new Container();
  private readonly shadow = new Graphics();
  private readonly ownershipMarker = new Graphics();
  private readonly healthBar = new Graphics();
  private readonly damageFlash = new ColorMatrixFilter();
  private previousHp: number;
  private damageFlashUntil = 0;

  protected constructor(unit: DeepReadonly<Unit>) {
    this.id = unit.id;
    this.previousHp = unit.health.hp;
    this.damageFlash.brightness(2.1, false);
    this.damageFlash.saturate(0.45, true);
    this.damageFlash.alpha = 0;
    this.body.filters = [this.damageFlash];
    this.shadow.ellipse(0, unit.collision.radius * 0.58, unit.collision.radius * 1.3, unit.collision.radius * 0.62)
      .fill(unit.movement.isAir ? 0x283b2d : 0x344338);
    if (unit.id >= 0) {
      const markerColor = unit.side === "blue" ? 0x48a5ff : 0xf06464;
      this.ownershipMarker
        .circle(0, 0, 5.5)
        .fill(markerColor)
        .stroke({ color: 0xffffff, alpha: 0.95, width: 1.7 });
      this.ownershipMarker.filters = [];
    }
    this.container.addChild(this.shadow, this.body, this.healthBar, this.ownershipMarker);
  }

  public abstract update(unit: DeepReadonly<Unit>, time: number): void;

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  protected updateCommon(unit: DeepReadonly<Unit>, time: number): void {
    if (unit.health.hp < this.previousHp) {
      this.damageFlashUntil = time + 0.12;
    }
    this.previousHp = unit.health.hp;

    const flashRemaining = Math.max(0, this.damageFlashUntil - time);
    this.damageFlash.alpha = flashRemaining / 0.12 * 0.9;

    this.container.position.set(unit.transform.x, unit.transform.y);

    const appearanceDelay = unit.deployment.appearanceDelay ?? 0;
    const hasAppeared = appearanceDelay <= 0;
    const remaining = unit.deployment.remaining ?? 0;
    const duration = unit.deployment.duration ?? 0;
    const progress = duration > 0 ? Math.max(0, Math.min(1, 1 - remaining / duration)) : 1;
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const lift = Math.pow(1 - easedProgress, 2) * 76;
    this.body.y = -lift;
    this.body.alpha = hasAppeared ? 0.72 + progress * 0.28 : 0;
    this.ownershipMarker.position.set(0, -lift - unit.collision.radius - 13);
    this.ownershipMarker.alpha = unit.id >= 0 && hasAppeared ? 1 : 0;
    this.shadow.scale.set(1 + (1 - progress) * 0.65, 1 + (1 - progress) * 0.4);
    this.shadow.alpha = hasAppeared ? 0.35 + progress * 0.65 : 0;

    const ratio = Math.max(0, Math.min(1, unit.health.hp / unit.health.maxHp));
    this.healthBar.clear();

    if (ratio >= 0.999) return;

    const width = Math.max(12, unit.collision.radius * 2);
    const y = unit.collision.radius + 7;
    this.healthBar.roundRect(-width / 2, y, width, 3.5, 1.75).fill(0x26312b);
    if (ratio > 0) {
      this.healthBar.roundRect(-width / 2, y, width * ratio, 3.5, 1.75).fill(0xa8c879);
    }
  }
}
