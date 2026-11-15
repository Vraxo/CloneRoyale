import { Container, Graphics } from "pixi.js";
import type { Unit } from "../../../game/types";
import { UnitView } from "../unitView";

export class CannonView extends UnitView {
  private readonly barrel = new Container();

  public constructor(unit: Unit) {
    super(unit);

    const base = new Graphics();
    base.roundRect(-17, -15, 34, 30, 8).fill(0x46545a);
    base.roundRect(-12, -11, 24, 22, 6).fill(0x83908e);
    base.circle(0, 0, 8).fill(0x5b6865);

    const barrel = new Graphics();
    barrel.roundRect(-5.5, -29, 11, 31, 4).fill(0x303b40);
    barrel.roundRect(-4, -28, 8, 23, 3).fill(0x687773);
    barrel.circle(0, -27, 5).fill(0xb5b6a3);

    this.barrel.addChild(barrel);
    this.body.addChild(base, this.barrel);
  }

  public update(unit: Unit, time: number): void {
    this.updateCommon(unit);
    this.body.rotation = unit.facing + Math.PI / 2;
    this.barrel.rotation = Math.sin(time * 0.7 + unit.animationOffset) * 0.035;
  }
}
