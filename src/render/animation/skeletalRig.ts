import { Container, Graphics } from "pixi.js";
import type { Unit } from "../../game/types";

export type HumanoidStyle = "skeleton" | "giant" | "archer" | "mini-pekka";

interface LimbRig {
  root: Container;
  elbow: Container;
  hand: Container;
}

function makeBone(length: number, width: number, color: number): Graphics {
  const graphic = new Graphics();
  graphic.roundRect(0, -width / 2, length, width, width / 2).fill(color);
  graphic.circle(length, 0, width / 2).fill(color);
  return graphic;
}

function createLimb(
  upperLength: number,
  lowerLength: number,
  upperWidth: number,
  lowerWidth: number,
  color: number
): LimbRig {
  const root = new Container();
  const elbow = new Container();
  const hand = new Container();

  root.addChild(makeBone(upperLength, upperWidth, color));
  elbow.position.set(upperLength, 0);
  elbow.addChild(makeBone(lowerLength, lowerWidth, color));
  hand.position.set(lowerLength, 0);
  elbow.addChild(hand);
  root.addChild(elbow);

  return { root, elbow, hand };
}

function addSword(parent: Container, color: number, length: number, width: number): void {
  const sword = new Graphics();
  sword.roundRect(-width / 2, -length, width, length - 3, 1.5).fill(color);
  sword.roundRect(-width / 2 - 1, -4, width + 2, 3, 1).fill(0x9b7950);
  sword.circle(0, 0, 2).fill(0x8b704d);
  parent.addChild(sword);
}

export class SkeletalRig {
  public readonly container = new Container();

  private readonly torso = new Graphics();
  private readonly head = new Graphics();
  private readonly leftArm: LimbRig;
  private readonly rightArm: LimbRig;
  private readonly leftLeg: LimbRig;
  private readonly rightLeg: LimbRig;
  private readonly equipment = new Container();
  private readonly style: HumanoidStyle;

  public constructor(style: HumanoidStyle) {
    this.style = style;

    const boneColor = style === "skeleton" ? 0xe8e1c7 : 0x000000;
    const limbColor = style === "skeleton"
      ? boneColor
      : style === "giant"
        ? 0xb66d42
        : style === "mini-pekka"
          ? 0x59658f
          : 0x416d75;
    const limbScale = style === "giant" ? 1.35 : style === "mini-pekka" ? 1.05 : style === "skeleton" ? 0.76 : 0.92;
    const upperWidth = (style === "skeleton" ? 2.8 : style === "giant" ? 7.5 : 4.5) * limbScale;
    const lowerWidth = (style === "skeleton" ? 2.3 : style === "giant" ? 6.5 : 3.8) * limbScale;

    this.leftArm = createLimb(7 * limbScale, 6.5 * limbScale, upperWidth, lowerWidth, limbColor);
    this.rightArm = createLimb(7 * limbScale, 6.5 * limbScale, upperWidth, lowerWidth, limbColor);
    this.leftLeg = createLimb(7 * limbScale, 7 * limbScale, lowerWidth, lowerWidth, style === "skeleton" ? boneColor : 0x3f4c48);
    this.rightLeg = createLimb(7 * limbScale, 7 * limbScale, lowerWidth, lowerWidth, style === "skeleton" ? boneColor : 0x3f4c48);

    this.drawTorso();
    this.drawHead();

    this.container.addChild(
      this.leftLeg.root,
      this.rightLeg.root,
      this.torso,
      this.leftArm.root,
      this.rightArm.root,
      this.head,
      this.equipment
    );

    this.leftArm.root.position.set(-6, -4);
    this.rightArm.root.position.set(6, -4);
    this.leftLeg.root.position.set(-3.5, 7);
    this.rightLeg.root.position.set(3.5, 7);

    if (style === "skeleton") addSword(this.rightArm.hand, 0xb8c6c2, 19, 2.5);
    if (style === "mini-pekka") addSword(this.rightArm.hand, 0xd5dfdf, 24, 4);
    if (style === "archer") this.addBow();
  }

  public update(unit: Unit, time: number): void {
    const phase = time * 8.2 + unit.animationOffset;
    const moving = unit.isMoving ?? false;
    const stride = moving ? Math.sin(phase) * 0.42 : 0;
    const attackProgress = unit.attackAnim > 0 ? 1 - unit.attackAnim / 0.32 : 0;
    const attackSwing = unit.attackAnim > 0 ? Math.sin(attackProgress * Math.PI) : 0;

    const idleBob = moving ? Math.abs(Math.sin(phase * 2)) * -0.65 : Math.sin(time * 2 + unit.animationOffset) * -0.2;
    this.container.position.set(0, idleBob);
    this.container.rotation = unit.facing + Math.PI / 2;

    this.leftLeg.root.rotation = -0.92 + stride;
    this.rightLeg.root.rotation = 0.92 - stride;
    this.leftLeg.elbow.rotation = 0.18 - Math.max(0, stride) * 0.6;
    this.rightLeg.elbow.rotation = -0.18 + Math.max(0, -stride) * 0.6;

    this.leftArm.root.rotation = -2.05 - stride * 0.55;
    this.rightArm.root.rotation = 0.9 + stride * 0.55 - attackSwing * (this.style === "mini-pekka" ? 2.0 : 1.5);
    this.leftArm.elbow.rotation = 0.45;
    this.rightArm.elbow.rotation = -0.72 - attackSwing * 0.7;

    if (this.style === "archer" && unit.attackAnim > 0) {
      this.rightArm.elbow.rotation = -1.5 - attackSwing * 0.35;
    }

    this.equipment.rotation = this.style === "archer" ? -0.15 : 0;
  }

  private drawTorso(): void {
    if (this.style === "skeleton") {
      this.torso.moveTo(-5, -5).lineTo(5, -5).stroke({ color: 0xe8e1c7, width: 2.8, cap: "round" });
      this.torso.moveTo(-5, -1).lineTo(5, -1).stroke({ color: 0xe8e1c7, width: 2.4, cap: "round" });
      this.torso.moveTo(-4, 3).lineTo(4, 3).stroke({ color: 0xe8e1c7, width: 2, cap: "round" });
      this.torso.moveTo(0, -8).lineTo(0, 7).stroke({ color: 0xe8e1c7, width: 3.2, cap: "round" });
      return;
    }

    const fill = this.style === "giant"
      ? 0xc47a43
      : this.style === "mini-pekka"
        ? 0x555f91
        : 0x537c82;
    const width = this.style === "giant" ? 20 : this.style === "mini-pekka" ? 14 : 13;
    const height = this.style === "giant" ? 22 : 17;
    this.torso.roundRect(-width / 2, -height / 2, width, height, this.style === "mini-pekka" ? 4 : 6).fill(fill);
    this.torso.ellipse(0, -1, width * 0.32, 2.2).fill(this.style === "giant" ? 0xd79a61 : 0x8caaa0);

    if (this.style === "mini-pekka") {
      this.torso.roundRect(-width / 2 + 2, 2, width - 4, 5, 2).fill(0x3e486f);
    }
    if (this.style === "archer") {
      this.torso.circle(0, 2, 2.2).fill(0xd2bc83);
    }
  }

  private drawHead(): void {
    if (this.style === "skeleton") {
      this.head.circle(0, -12, 5.4).fill(0xe8e1c7);
      this.head.ellipse(-2, -12.2, 1.35, 1.7).fill(0x38413d);
      this.head.ellipse(2, -12.2, 1.35, 1.7).fill(0x38413d);
      this.head.roundRect(-2.4, -8.4, 4.8, 1.6, 0.6).fill(0x777d6d);
      return;
    }

    if (this.style === "giant") {
      this.head.circle(0, -14, 7.5).fill(0xe2ae75);
      this.head.ellipse(0, -17.5, 7.5, 3.4).fill(0x80543b);
      this.head.circle(-2.3, -14, 0.9).fill(0x493a30);
      this.head.circle(2.3, -14, 0.9).fill(0x493a30);
      return;
    }

    if (this.style === "mini-pekka") {
      this.head.roundRect(-7, -20, 14, 13, 5).fill(0x6775a4);
      this.head.roundRect(-5, -17, 10, 5, 2).fill(0x303c67);
      this.head.circle(-2.2, -14.5, 1).fill(0x9de0d6);
      this.head.circle(2.2, -14.5, 1).fill(0x9de0d6);
      this.head.moveTo(-5, -18).lineTo(-9, -23).lineTo(-3, -20).fill(0x7888ba);
      this.head.moveTo(5, -18).lineTo(9, -23).lineTo(3, -20).fill(0x7888ba);
      return;
    }

    this.head.circle(0, -12, 5.4).fill(0xd8b58d);
    this.head.ellipse(0, -15.5, 6.2, 3.5).fill(0x6b4b38);
    this.head.roundRect(-6, -18, 12, 2.5, 1).fill(0x4e6f79);
  }

  private addBow(): void {
    const bow = new Graphics();
    bow.ellipse(0, -3, 5, 10).stroke({ color: 0x9c7950, width: 2.2 });
    bow.moveTo(0, -13).lineTo(0, 7).stroke({ color: 0xe2d3af, width: 0.8 });
    this.leftArm.hand.addChild(bow);
  }
}
