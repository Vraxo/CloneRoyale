import { Container, Graphics } from "pixi.js";
import type { Tower } from "../../game/types";

export class TowerView {
  public readonly id: number;
  public readonly container = new Container();

  private readonly health = new Graphics();

  public constructor(tower: Tower) {
    this.id = tower.id;

    const teamColor = tower.side === "blue" ? 0x4b91d0 : 0xc9665d;
    const size = tower.kind === "king" ? 30 : 25;
    const body = new Graphics();

    body.ellipse(0, 12, size + 7, size * 0.66).fill(0x344338);
    body.roundRect(-size, -size, size * 2, size * 2, 9).fill(0x3d473f);
    body.roundRect(-size + 3, -size + 3, size * 2 - 6, size * 2 - 6, 7).fill(teamColor);
    body.roundRect(-size * 0.53, -size * 0.54, size * 1.06, size * 1.08, 7).fill(0xd6c59a);
    body.circle(0, -2, size * 0.38).fill(tower.kind === "king" ? 0xe8d9b2 : 0xcab58d);
    body.circle(0, -2, size * 0.19).fill(teamColor);
    body.rect(-4, -size - 5, 8, 11).fill(0xe4cf96);

    this.container.addChild(body, this.health);
  }

  public update(tower: Tower): void {
    const size = tower.kind === "king" ? 30 : 25;
    const ratio = Math.max(0, Math.min(1, tower.hp / tower.maxHp));

    this.container.position.set(tower.x, tower.y);
    this.container.alpha = tower.hp > 0 ? 1 : 0.38;
    this.health.clear();
    this.health.roundRect(-size, size + 5, size * 2, 4, 2).fill(0x29332d);
    if (ratio > 0) {
      this.health.roundRect(-size, size + 5, size * 2 * ratio, 4, 2).fill(0x9bc47c);
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
