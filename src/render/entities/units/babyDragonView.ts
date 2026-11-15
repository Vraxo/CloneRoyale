import { Container, Graphics } from "pixi.js";
import type { Unit } from "../../../game/types";
import { UnitView } from "../unitView";

export class BabyDragonView extends UnitView {
  private readonly leftWing = new Container();
  private readonly rightWing = new Container();
  private readonly leftWingShape = new Graphics();
  private readonly rightWingShape = new Graphics();
  private readonly bodyShape = new Graphics();
  private readonly head = new Graphics();
  private readonly tail = new Graphics();

  public constructor(unit: Unit) {
    super(unit);

    this.leftWingShape.ellipse(-5, 0, 8, 14).fill(0x78b66d);
    this.leftWingShape.moveTo(-2, -10).lineTo(-12, -17).lineTo(-9, 1).fill(0x568f59);
    this.rightWingShape.ellipse(5, 0, 8, 14).fill(0x78b66d);
    this.rightWingShape.moveTo(2, -10).lineTo(12, -17).lineTo(9, 1).fill(0x568f59);

    this.bodyShape.ellipse(0, 1, 10, 16).fill(0x548f58);
    this.bodyShape.ellipse(0, 4, 6, 9).fill(0x8abb69);
    this.head.circle(0, -13, 8).fill(0x7ebd70);
    this.head.circle(-3, -15, 1.5).fill(0xf5e9b0);
    this.head.circle(3, -15, 1.5).fill(0xf5e9b0);
    this.head.moveTo(-4, -20).lineTo(-6, -25).lineTo(-1, -21).fill(0x47784c);
    this.head.moveTo(4, -20).lineTo(6, -25).lineTo(1, -21).fill(0x47784c);

    this.tail.moveTo(0, 13).lineTo(-2, 20).lineTo(3, 26).stroke({ color: 0x47784c, width: 3.5, cap: "round" });

    this.leftWing.addChild(this.leftWingShape);
    this.rightWing.addChild(this.rightWingShape);
    this.body.addChild(this.tail, this.leftWing, this.rightWing, this.bodyShape, this.head);
  }

  public update(unit: Unit, time: number): void {
    this.updateCommon(unit);
    this.body.rotation = unit.facing + Math.PI / 2;
    this.body.y = Math.sin(time * 4 + unit.animationOffset) * 2.6;
    const flap = Math.sin(time * 12 + unit.animationOffset);
    this.leftWing.rotation = -0.25 + flap * 0.58;
    this.rightWing.rotation = 0.25 - flap * 0.58;
    this.tail.rotation = Math.sin(time * 3 + unit.animationOffset) * 0.12;
  }
}
