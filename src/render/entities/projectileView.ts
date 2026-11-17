import { Container, Graphics } from "pixi.js";
import type { Projectile } from "../../game/types";
import { drawArrow } from "./arrowArt";

export class ProjectileView {
  public readonly id: number;
  public readonly container = new Container();

  private readonly graphic = new Graphics();
  private readonly arrowTrail = new Graphics();
  private readonly arrowFeathers = new Graphics();
  private readonly arrowShaft = new Graphics();
  private readonly arrowHead = new Graphics();
  private readonly arrowDetails = new Graphics();
  private readonly fireballAura = new Graphics();
  private readonly fireballTrail = new Graphics();
  private readonly fireballBody = new Graphics();
  private readonly fireballCore = new Graphics();
  private readonly fireballSparks = new Graphics();

  public constructor(projectile: Projectile) {
    this.id = projectile.id;
    this.container.addChild(
      this.arrowTrail,
      this.arrowFeathers,
      this.arrowShaft,
      this.arrowHead,
      this.arrowDetails,
      this.fireballAura,
      this.fireballTrail,
      this.graphic,
      this.fireballBody,
      this.fireballCore,
      this.fireballSparks
    );
  }

  public update(projectile: Projectile): void {
    this.container.position.set(projectile.x, projectile.y);
    this.container.rotation = Math.atan2(
      projectile.targetY - projectile.startY,
      projectile.targetX - projectile.startX
    );

    this.clearArrowGraphics();
    this.container.scale.set(1);

    if (projectile.style === "fireball") {
      this.drawFireball(projectile);
      return;
    }

    if (projectile.style === "arrow" || projectile.style === "arrows") {
      this.graphic.clear();
      this.drawArrowProjectile(projectile);
      return;
    }

    this.graphic.clear();

    if (projectile.style === "fire") {
      this.graphic.circle(0, 0, 7).fill(0xd96735);
      this.graphic.circle(0, 0, 4.5).fill(0xffd06b);
    } else if (projectile.style === "cannon") {
      this.graphic.circle(0, 0, 6).fill(0x39433c);
      this.graphic.circle(0, 0, 3.5).fill(0xaab6b7);
    } else {
      this.graphic.moveTo(-3, 0).lineTo(4, 0)
        .stroke({ color: 0x39433c, width: 3, cap: "round" });
      this.graphic.moveTo(4, 0).lineTo(1, -3).lineTo(1, 3).closePath().fill(0xe7d8a5);
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  private clearArrowGraphics(): void {
    this.arrowTrail.clear();
    this.arrowFeathers.clear();
    this.arrowShaft.clear();
    this.arrowHead.clear();
    this.arrowDetails.clear();
  }

  private drawArrowProjectile(projectile: Projectile): void {
    const teamFletching = projectile.side === "red" ? 0xc56e65 : 0x659bc8;
    const arrowLayers = {
      trail: this.arrowTrail,
      feathers: this.arrowFeathers,
      shaft: this.arrowShaft,
      head: this.arrowHead,
      details: this.arrowDetails
    };

    if (projectile.style === "arrows") {
      this.container.scale.set(1.1);
      drawArrow(arrowLayers, {
        tipX: 5,
        tipY: 0,
        angle: 0,
        length: 37,
        scale: 1.1,
        alpha: 1,
        fletchingColor: teamFletching,
        trailColor: 0xffe4a3,
        trailLength: 24,
        trailAlpha: 0.75
      });

      drawArrow(arrowLayers, {
        tipX: -5,
        tipY: -8,
        angle: -0.09,
        length: 30,
        scale: 0.9,
        alpha: 0.82,
        fletchingColor: teamFletching,
        trailColor: 0xffe4a3,
        trailLength: 18,
        trailAlpha: 0.48
      });

      drawArrow(arrowLayers, {
        tipX: -5,
        tipY: 8,
        angle: 0.09,
        length: 30,
        scale: 0.9,
        alpha: 0.82,
        fletchingColor: teamFletching,
        trailColor: 0xffe4a3,
        trailLength: 18,
        trailAlpha: 0.48
      });
      return;
    }

    drawArrow(arrowLayers, {
      tipX: 0,
      tipY: 0,
      angle: 0,
      length: 25,
      scale: 0.92,
      alpha: 1,
      fletchingColor: teamFletching,
      trailColor: 0xffe4a3,
      trailLength: 7,
      trailAlpha: 0.24
    });
  }

  private drawFireball(projectile: Projectile): void {
    const time = projectile.age;
    const pulse = 1 + Math.sin(time * 25) * 0.045;
    const flicker = 0.88 + Math.sin(time * 34) * 0.08;

    this.container.scale.set(pulse, pulse);
    this.fireballAura.clear();
    this.fireballTrail.clear();
    this.fireballBody.clear();
    this.fireballCore.clear();
    this.fireballSparks.clear();

    this.fireballAura
      .ellipse(-3, 0, 21, 14)
      .fill({ color: 0xe83b16, alpha: 0.2 * flicker });
    this.fireballAura
      .circle(1, 0, 12.5)
      .fill({ color: 0xff7522, alpha: 0.23 * flicker });

    this.fireballTrail
      .moveTo(-7, -3)
      .bezierCurveTo(-16, -13, -25, -11, -36, -5)
      .stroke({ color: 0xe63b19, width: 7.5, alpha: 0.8, cap: "round" });
    this.fireballTrail
      .moveTo(-8, 2)
      .bezierCurveTo(-18, 12, -26, 8, -34, 4)
      .stroke({ color: 0xff7928, width: 5.5, alpha: 0.86, cap: "round" });
    this.fireballTrail
      .moveTo(-7, 0)
      .bezierCurveTo(-17, -3, -24, 2, -31, 0)
      .stroke({ color: 0xffc04b, width: 2.4, alpha: 0.92, cap: "round" });

    this.fireballBody
      .moveTo(-13, 0)
      .bezierCurveTo(-16, -7, -10, -13, -3, -13)
      .bezierCurveTo(1, -19, 10, -14, 11, -7)
      .bezierCurveTo(19, -2, 16, 6, 8, 10)
      .bezierCurveTo(1, 16, -10, 11, -13, 5)
      .bezierCurveTo(-15, 3, -15, 1, -13, 0)
      .closePath()
      .fill({ color: 0xb92c18, alpha: 0.96 });

    this.fireballBody
      .moveTo(-10, 0)
      .bezierCurveTo(-11, -7, -5, -11, 1, -10)
      .bezierCurveTo(7, -14, 13, -7, 12, -2)
      .bezierCurveTo(15, 5, 5, 11, -2, 9)
      .bezierCurveTo(-7, 9, -12, 4, -10, 0)
      .closePath()
      .fill({ color: 0xf45a1c, alpha: 0.98 });

    this.fireballCore
      .ellipse(3, 0, 7.5, 8.5)
      .fill({ color: 0xffb52f, alpha: 0.98 });
    this.fireballCore
      .ellipse(5, -1, 4.6, 5.8)
      .fill({ color: 0xffe27a, alpha: 0.98 });
    this.fireballCore
      .circle(6, -3.2, 2.1)
      .fill({ color: 0xfff5d1, alpha: 0.92 });

    for (let index = 0; index < 7; index += 1) {
      const phase = time * (13 + index * 0.7) + index * 2.17;
      const x = -11 - (index % 3) * 5 + Math.sin(phase) * 2.2;
      const y = Math.sin(phase * 0.76) * (4 + index % 2 * 2);
      const size = 1.1 + (index % 3) * 0.45;
      const alpha = 0.55 + (Math.sin(phase) + 1) * 0.2;

      this.fireballSparks
        .moveTo(x - 2.5, y + 1.2)
        .lineTo(x + 1.2, y - 0.5)
        .stroke({
          color: index % 2 === 0 ? 0xffd36a : 0xff7a30,
          width: size,
          alpha,
          cap: "round"
        });
      this.fireballSparks
        .circle(x, y, size * 0.72)
        .fill({ color: 0xffd36a, alpha });
    }
  }
}
