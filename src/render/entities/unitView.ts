import { Container, Graphics } from "pixi.js";
import type { Unit } from "../../game/types";

export abstract class UnitView {
  public readonly id: number;
  public readonly container = new Container();

  protected readonly body = new Container();
  private readonly shadow = new Graphics();
  private readonly healthBar = new Graphics();

  protected constructor(unit: Unit) {
    this.id = unit.id;
    this.shadow.ellipse(0, unit.radius * 0.58, unit.radius * 1.3, unit.radius * 0.62)
      .fill(unit.isAir ? 0x283b2d : 0x344338);
    this.container.addChild(this.shadow, this.body, this.healthBar);
  }

  public abstract update(unit: Unit, time: number): void;

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  protected updateCommon(unit: Unit): void {
    this.container.position.set(unit.x, unit.y);

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
