import { Container, Graphics } from "pixi.js";
import type { Effect } from "../../game/types";

export class EffectView {
  public readonly id: number;
  public readonly container = new Container();

  private readonly graphic = new Graphics();

  public constructor(effect: Effect) {
    this.id = effect.id;
    this.container.addChild(this.graphic);
    this.update(effect);
  }

  public update(effect: Effect): void {
    const progress = Math.min(1, effect.age / effect.lifetime);
    const radius = effect.style === "hit"
      ? effect.radius * (0.6 + progress * 0.8)
      : effect.radius * (0.45 + progress * 0.65);
    const color = effect.style === "hit" ? 0xf1e1a9 : effect.style === "arrows" ? 0xe2d6b6 : 0xffad55;

    this.container.position.set(effect.x, effect.y);
    this.graphic.clear();
    this.graphic.circle(0, 0, radius).stroke({
      color,
      width: effect.style === "hit" ? 2 : 4,
      alpha: 1 - progress
    });
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
