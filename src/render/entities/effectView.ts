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

    if (effect.style === "explosion" || effect.style === "fireball") {
      this.drawFireballImpact(effect, progress);
      return;
    }

    const radius = effect.style === "hit"
      ? effect.radius * (0.6 + progress * 0.8)
      : effect.radius * (0.45 + progress * 0.65);
    const color = effect.style === "hit" ? 0xf1e1a9 : 0xe2d6b6;

    this.graphic.circle(0, 0, radius).stroke({
      color,
      width: effect.style === "hit" ? 2 : 4,
      alpha: 1 - progress
    });
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  private drawFireballImpact(effect: Effect, progress: number): void {
    const graphic = this.graphic;
    const radius = effect.radius;
    const fade = Math.pow(1 - progress, 0.82);
    const expansion = 1 - Math.pow(1 - progress, 2.1);
    const pop = Math.max(0, 1 - progress * 4.5);

    // A dark contact shadow anchors the explosion to the arena floor.
    graphic.ellipse(
      0,
      radius * 0.12,
      radius * (0.78 + expansion * 0.25),
      radius * (0.3 + expansion * 0.08)
    ).fill({ color: 0x6d2518, alpha: 0.28 * fade });

    // Broad, uneven tongues form the outer silhouette of the blast.
    for (let index = 0; index < 9; index += 1) {
      const angle = (Math.PI * 2 * index) / 9 - Math.PI / 2 + 0.12;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const px = -uy;
      const py = ux;
      const inner = radius * (0.12 + expansion * 0.04);
      const middle = radius * (0.43 + expansion * 0.09);
      const tip = radius * (0.76 + expansion * 0.17);
      const halfWidth = radius * (0.105 + (index % 3) * 0.012) * (1 - progress * 0.16);

      const startLeftX = ux * inner + px * halfWidth * 0.48;
      const startLeftY = uy * inner + py * halfWidth * 0.48;
      const startRightX = ux * inner - px * halfWidth * 0.48;
      const startRightY = uy * inner - py * halfWidth * 0.48;
      const tipX = ux * tip;
      const tipY = uy * tip;

      graphic.moveTo(startLeftX, startLeftY)
        .bezierCurveTo(
          ux * middle + px * halfWidth,
          uy * middle + py * halfWidth,
          tipX - ux * radius * 0.12 + px * halfWidth * 0.38,
          tipY - uy * radius * 0.12 + py * halfWidth * 0.38,
          tipX,
          tipY
        )
        .bezierCurveTo(
          tipX - ux * radius * 0.16 - px * halfWidth * 0.35,
          tipY - uy * radius * 0.16 - py * halfWidth * 0.35,
          ux * middle - px * halfWidth * 0.78,
          uy * middle - py * halfWidth * 0.78,
          startRightX,
          startRightY
        )
        .closePath()
        .fill({
          color: index % 3 === 0 ? 0xb93217 : index % 3 === 1 ? 0xe84a19 : 0xff7021,
          alpha: (0.78 - (index % 2) * 0.08) * fade
        });
    }

    // Layered fire clouds soften the points and make the burst feel full.
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10 + 0.18;
      const distance = radius * (0.28 + expansion * 0.12);
      const lobeSize = radius * (0.2 + (index % 3) * 0.022) * (1 - progress * 0.12);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      graphic.ellipse(x, y, lobeSize * 0.92, lobeSize * 1.08)
        .fill({
          color: index % 2 === 0 ? 0xf04a18 : 0xff7622,
          alpha: 0.88 * fade
        });
    }

    // The hot center is brightest immediately after impact, then cools quickly.
    graphic.circle(0, 0, radius * (0.34 + expansion * 0.12))
      .fill({ color: 0xd83b16, alpha: 0.9 * fade });
    graphic.circle(0, 0, radius * (0.25 + expansion * 0.07))
      .fill({ color: 0xff7924, alpha: 0.96 * fade });
    graphic.ellipse(0, -radius * 0.025, radius * (0.19 + expansion * 0.025), radius * (0.2 + expansion * 0.03))
      .fill({ color: 0xffc14c, alpha: 0.95 * fade });

    if (pop > 0) {
      graphic.circle(0, 0, radius * (0.13 + progress * 0.12))
        .fill({ color: 0xfff1bd, alpha: 0.82 * pop });
      graphic.circle(0, 0, radius * (0.22 + progress * 0.24))
        .fill({ color: 0xffd36e, alpha: 0.2 * pop });
    }

    // Two expanding shock rings give the impact a sharp, readable finish.
    graphic.circle(0, 0, radius * (0.3 + progress * 0.88)).stroke({
      color: 0xffb84c,
      width: Math.max(1.5, radius * 0.075 * (1 - progress)),
      alpha: 0.86 * fade
    });
    graphic.circle(0, 0, radius * (0.48 + progress * 0.72)).stroke({
      color: 0xff7130,
      width: Math.max(1, radius * 0.035 * (1 - progress)),
      alpha: 0.64 * fade
    });

    // Fast-moving sparks leave short streaks as they fan out from the impact.
    for (let index = 0; index < 14; index += 1) {
      const angle = (Math.PI * 2 * index) / 14 + 0.09;
      const distance = radius * (0.42 + progress * (0.76 + (index % 3) * 0.08));
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const trailDistance = radius * (0.12 + progress * 0.08);
      const size = Math.max(0.8, radius * (0.025 - progress * 0.012));

      graphic.moveTo(
        x - Math.cos(angle) * trailDistance,
        y - Math.sin(angle) * trailDistance
      ).lineTo(x, y).stroke({
        color: index % 3 === 0 ? 0xfff0b0 : 0xffa13b,
        width: size,
        alpha: 0.9 * fade,
        cap: "round"
      });
      graphic.circle(x, y, size * 1.05).fill({
        color: index % 3 === 0 ? 0xfff0b0 : 0xffb347,
        alpha: 0.96 * fade
      });
    }

    // Small dark embers linger around the perimeter as the fire fades.
    for (let index = 0; index < 7; index += 1) {
      const angle = (Math.PI * 2 * index) / 7 + 0.4;
      const distance = radius * (0.58 + progress * 0.42);
      graphic.circle(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        Math.max(1, radius * 0.026 * (1 - progress * 0.35))
      ).fill({ color: 0x7d2c1a, alpha: 0.52 * fade });
    }
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
