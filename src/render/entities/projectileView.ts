import { Container, Graphics } from "pixi.js";
import type { Projectile } from "../../game/types";

export class ProjectileView {
  public readonly id: number;
  public readonly container = new Container();

  private readonly graphic = new Graphics();
  private readonly isFireball: boolean;

  public constructor(projectile: Projectile) {
    this.id = projectile.id;
    this.isFireball = projectile.style === "fireball";

    if (this.isFireball) {
      this.drawFireball();
    } else if (projectile.style === "fire") {
      this.graphic.circle(0, 0, 7).fill(0xd96735);
      this.graphic.circle(0, 0, 4.5).fill(0xffd06b);
    } else if (projectile.style === "cannon") {
      this.graphic.circle(0, 0, 6).fill(0x39433c);
      this.graphic.circle(0, 0, 3.5).fill(0xaab6b7);
    } else {
      this.graphic.moveTo(-3, 0).lineTo(4, 0).stroke({ color: 0x39433c, width: 3, cap: "round" });
      this.graphic.moveTo(4, 0).lineTo(1, -3).lineTo(1, 3).closePath().fill(0xe7d8a5);
    }

    this.container.addChild(this.graphic);
  }

  public update(projectile: Projectile): void {
    this.container.position.set(projectile.x, projectile.y);
    this.container.rotation = Math.atan2(
      projectile.targetY - projectile.startY,
      projectile.targetX - projectile.startX
    );

    if (this.isFireball) {
      const pulse = Math.sin(projectile.age * 23) * 0.035;
      this.container.scale.set(1 + pulse, 1 - pulse * 0.45);
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  private drawFireball(): void {
    const graphic = this.graphic;

    // A soft, elongated glow makes the projectile read as hot and fast.
    graphic.ellipse(-8, 1, 29, 15).fill({ color: 0xff4d18, alpha: 0.12 });
    graphic.ellipse(-5, 0, 21, 11).fill({ color: 0xff7a24, alpha: 0.2 });

    // The tail tapers into the direction of travel instead of ending in a circle.
    graphic.moveTo(-7, -5)
      .bezierCurveTo(-18, -14, -30, -10, -42, -2)
      .bezierCurveTo(-29, 0, -20, 8, -7, 6)
      .closePath()
      .fill({ color: 0xc83a18, alpha: 0.82 });

    graphic.moveTo(-5, -4)
      .bezierCurveTo(-17, -10, -25, -5, -34, -1)
      .bezierCurveTo(-23, 1, -17, 5, -5, 5)
      .closePath()
      .fill({ color: 0xff7a22, alpha: 0.95 });

    graphic.moveTo(-2, -3)
      .bezierCurveTo(-13, -7, -20, -3, -26, 0)
      .bezierCurveTo(-17, 2, -10, 3, -2, 3)
      .closePath()
      .fill({ color: 0xffc04b, alpha: 0.9 });

    // Irregular flame tongues give the silhouette a lively, hand-shaped edge.
    graphic.moveTo(-10, -4)
      .bezierCurveTo(-19, -13, -11, -21, -3, -14)
      .bezierCurveTo(-1, -24, 12, -22, 11, -11)
      .bezierCurveTo(21, -9, 21, 3, 13, 7)
      .bezierCurveTo(7, 17, -7, 16, -11, 7)
      .bezierCurveTo(-19, 5, -18, -2, -10, -4)
      .closePath()
      .fill({ color: 0xd94319 });

    graphic.ellipse(0, 0, 12.5, 10.8)
      .fill({ color: 0xec561d })
      .stroke({ color: 0xff9a35, width: 1.2, alpha: 0.9 });

    // Several overlapping hot layers create depth without a blurry filter.
    graphic.ellipse(1, 0, 9.5, 8.5).fill({ color: 0xff8b2b });
    graphic.ellipse(2, 0, 7.2, 7).fill({ color: 0xffc044 });
    graphic.ellipse(3, -1, 4.6, 5.4).fill({ color: 0xffe58a });
    graphic.ellipse(2, -3, 2.7, 1.7).fill({ color: 0xfff5ce, alpha: 0.95 });

    // A few bright streaks and embers break up the otherwise smooth tail.
    graphic.moveTo(-12, -5).lineTo(-23, -7).stroke({
      color: 0xffd16a,
      width: 1.8,
      alpha: 0.9,
      cap: "round"
    });
    graphic.moveTo(-14, 4).lineTo(-25, 6).stroke({
      color: 0xffa13a,
      width: 1.5,
      alpha: 0.86,
      cap: "round"
    });
    graphic.circle(-19, -8, 1.8).fill({ color: 0xffe09a, alpha: 0.95 });
    graphic.circle(-29, 4, 1.35).fill({ color: 0xffbc54, alpha: 0.9 });
    graphic.circle(-34, -3, 1).fill({ color: 0xffe7ad, alpha: 0.85 });
  }
}
