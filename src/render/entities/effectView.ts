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
    this.container.position.set(effect.x, effect.y);
    this.graphic.clear();

    if (effect.style === "deployment") {
      this.drawDeployment(effect, progress);
      return;
    }

    const radius = effect.style === "hit"
      ? effect.radius * (0.6 + progress * 0.8)
      : effect.radius * (0.45 + progress * 0.65);
    const color = effect.style === "hit" ? 0xf1e1a9 : effect.style === "arrows" ? 0xe2d6b6 : 0xffad55;

    this.graphic.circle(0, 0, radius).stroke({
      color,
      width: effect.style === "hit" ? 2 : 4,
      alpha: 1 - progress
    });
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  private drawDeployment(effect: Effect, progress: number): void {
    const color = effect.side === "red" ? 0xff958c : 0x91c9ff;
    const fade = 1 - progress;
    const expansion = 1 - Math.pow(1 - progress, 3);
    const radius = effect.radius;

    this.graphic.ellipse(
      0,
      2,
      radius * (0.78 + expansion * 0.5),
      radius * (0.3 + expansion * 0.12)
    ).fill({
      color,
      alpha: 0.16 * fade
    });

    this.graphic.circle(0, 0, radius * (0.45 + expansion * 1.1)).stroke({
      color,
      width: 3.5 * fade + 0.5,
      alpha: 0.75 * fade
    });

    this.graphic.circle(0, 0, radius * (0.22 + expansion * 0.52)).stroke({
      color: 0xf4f0df,
      width: 1.5,
      alpha: Math.max(0, 0.55 - progress * 1.8)
    });

    const particleDistance = radius * (0.55 + expansion * 1.05);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 + 0.18;
      const x = Math.cos(angle) * particleDistance;
      const y = Math.sin(angle) * particleDistance - progress * 5;
      const particleRadius = 2.5 * fade + 0.5;

      this.graphic.circle(x, y, particleRadius).fill({
        color,
        alpha: 0.8 * fade
      });
    }

    const flashAlpha = Math.max(0, 1 - progress * 4);
    if (flashAlpha > 0) {
      this.graphic.circle(0, 0, radius * (0.3 + progress * 0.45)).fill({
        color: 0xf7f4e8,
        alpha: 0.22 * flashAlpha
      });
    }
  }
}
