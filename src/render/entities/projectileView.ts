import { Container, Graphics } from "pixi.js";
import type { Projectile } from "../../game/types";

export class ProjectileView {
  public readonly id: number;
  public readonly container = new Container();

  public constructor(projectile: Projectile) {
    this.id = projectile.id;
    const graphic = new Graphics();

    if (projectile.style === "fireball") {
      graphic.circle(0, 0, 9).fill(0xd96735);
      graphic.circle(0, 0, 6).fill(0xffa34c);
      graphic.circle(-2, -2, 2).fill(0xffe0a1);
    } else if (projectile.style === "fire") {
      graphic.circle(0, 0, 7).fill(0xd96735);
      graphic.circle(0, 0, 4.5).fill(0xffd06b);
    } else if (projectile.style === "cannon") {
      graphic.circle(0, 0, 6).fill(0x39433c);
      graphic.circle(0, 0, 3.5).fill(0xaab6b7);
    } else {
      graphic.moveTo(-3, 0).lineTo(4, 0).stroke({ color: 0x39433c, width: 3, cap: "round" });
      graphic.moveTo(4, 0).lineTo(1, -3).lineTo(1, 3).closePath().fill(0xe7d8a5);
    }

    this.container.addChild(graphic);
  }

  public update(projectile: Projectile): void {
    this.container.position.set(projectile.x, projectile.y);
    this.container.rotation = Math.atan2(
      projectile.targetY - projectile.startY,
      projectile.targetX - projectile.startX
    );
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
