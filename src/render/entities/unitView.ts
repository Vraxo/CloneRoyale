import { ColorMatrixFilter, Container, Graphics } from "pixi.js";
import type { Unit } from "../../game/types";

export abstract class UnitView {
  public readonly id: number;
  public readonly container = new Container();

  protected readonly body = new Container();
  private readonly shadow = new Graphics();
  private readonly healthBar = new Graphics();
  private readonly damageFlash = new ColorMatrixFilter();
  private previousHp: number;
  private damageFlashUntil = 0;

  protected constructor(unit: Unit) {
    this.id = unit.id;
    this.previousHp = unit.hp;
    this.damageFlash.brightness(2.1, false);
    this.damageFlash.saturate(0.45, true);
    this.damageFlash.alpha = 0;
    this.body.filters = [this.damageFlash];
    this.shadow.ellipse(0, unit.radius * 0.58, unit.radius * 1.3, unit.radius * 0.62)
      .fill(unit.isAir ? 0x283b2d : 0x344338);
    this.container.addChild(this.shadow, this.body, this.healthBar);
  }

  public abstract update(unit: Unit, time: number): void;

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  protected updateCommon(unit: Unit, time: number): void {
    if (unit.hp < this.previousHp) {
      this.damageFlashUntil = time + 0.12;
    }
    this.previousHp = unit.hp;

    const flashRemaining = Math.max(0, this.damageFlashUntil - time);
    this.damageFlash.alpha = flashRemaining / 0.12 * 0.9;

    this.container.position.set(unit.x, unit.y);

    const appearanceDelay = unit.appearanceDelayRemaining ?? 0;
    const hasAppeared = appearanceDelay <= 0;
    const remaining = unit.deploymentRemaining ?? 0;
    const duration = unit.deploymentDuration ?? 0;
    const progress = duration > 0 ? Math.max(0, Math.min(1, 1 - remaining / duration)) : 1;
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const lift = Math.pow(1 - easedProgress, 2) * 76;
    this.body.y = -lift;
    this.body.alpha = hasAppeared ? 0.72 + progress * 0.28 : 0;
    this.shadow.scale.set(1 + (1 - progress) * 0.65, 1 + (1 - progress) * 0.4);
    this.shadow.alpha = hasAppeared ? 0.35 + progress * 0.65 : 0;

    const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
    this.healthBar.clear();

    if (ratio >= 0.999) return;

    const width = Math.max(12, unit.radius * 2);
    const y = unit.radius + 7;
    this.healthBar.roundRect(-width / 2, y, width, 3.5, 1.75).fill(0x26312b);
    if (ratio > 0) {
      this.healthBar.roundRect(-width / 2, y, width * ratio, 3.5, 1.75).fill(0xa8c879);
    }
  }
}
