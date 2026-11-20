import { Container, Graphics } from "pixi.js";
import type { DeepReadonly, Unit } from "../../game/types";
import { UnitView } from "../../battle/render/entities/unitView";

const ATTACK_ANIMATION_DURATION = 0.32;

export class CannonView extends UnitView {
  private readonly barrel = new Container();
  private readonly muzzleFlash = new Graphics();
  private readonly recoilSmoke = new Graphics();

  public constructor(unit: DeepReadonly<Unit>) {
    super(unit);

    const base = new Graphics();

    // Ground shadow and heavy circular mounting plate.
    base.ellipse(0, 13, 22, 12).fill({ color: 0x17231f, alpha: 0.28 });
    base.roundRect(-19, -15, 38, 31, 9)
      .fill(0x303d40)
      .stroke({ color: 0x202b2e, width: 2 });
    base.roundRect(-16, -13, 32, 26, 7)
      .fill(0x65736f)
      .stroke({ color: 0x9ba69a, alpha: 0.7, width: 1.2 });
    base.roundRect(-12, -10, 24, 20, 5).fill(0x465653);
    base.roundRect(-9, -8, 18, 16, 4).fill(0x78857b);
    base.circle(0, 0, 7.5)
      .fill(0x3a4745)
      .stroke({ color: 0xa4aa96, width: 1.5 });
    base.circle(0, 0, 3.5).fill(0x252f32);

    // Reinforced side brackets and visible mounting bolts.
    for (const side of [-1, 1]) {
      base.roundRect(side * 14 - 2.5, -10, 5, 20, 2)
        .fill(0x39464a)
        .stroke({ color: 0x9ba397, alpha: 0.8, width: 1 });
      base.circle(side * 14, -8, 1.6).fill(0xc2b994);
      base.circle(side * 14, 8, 1.6).fill(0xc2b994);
    }

    const barrelShape = new Graphics();

    // Rear breech: a chunky, layered housing rather than a plain tube.
    barrelShape.roundRect(-8.5, -13, 17, 19, 5)
      .fill(0x293438)
      .stroke({ color: 0x1b2529, width: 1.6 });
    barrelShape.roundRect(-7, -12, 14, 15, 4).fill(0x596a68);
    barrelShape.roundRect(-5.5, -11, 11, 12, 3).fill(0x78867d);
    barrelShape.roundRect(-6.5, -25, 13, 18, 3)
      .fill(0x303d41)
      .stroke({ color: 0x202a2e, width: 1.3 });

    // Main barrel, with a shaded underside and a metallic top highlight.
    barrelShape.roundRect(-5.7, -39, 11.4, 27, 3)
      .fill(0x253136)
      .stroke({ color: 0x172226, width: 1.4 });
    barrelShape.roundRect(-4, -37, 8, 22, 2.2).fill(0x718078);
    barrelShape.rect(-2.8, -36, 1.5, 18).fill({ color: 0xc0c0a2, alpha: 0.42 });
    barrelShape.rect(2.6, -36, 1.2, 19).fill({ color: 0x253136, alpha: 0.62 });

    // Reinforced muzzle collar and dark bore.
    barrelShape.roundRect(-7, -41, 14, 6, 2.5)
      .fill(0x9a9d87)
      .stroke({ color: 0x303b3c, width: 1.5 });
    barrelShape.roundRect(-5.3, -40, 10.6, 3.5, 1.5).fill(0x414d4c);
    barrelShape.ellipse(0, -40.5, 4.2, 2.1).fill(0x111a1d);
    barrelShape.ellipse(0, -40.8, 2.7, 1.15).fill(0x050a0d);

    // Small pins give the breech some mechanical detail.
    for (const side of [-1, 1]) {
      barrelShape.circle(side * 6.1, -19, 1.5)
        .fill(0xb7b39a)
        .stroke({ color: 0x343f40, width: 0.7 });
      barrelShape.rect(side * 4.8 - 0.8, -31, 1.6, 5).fill(0x9da18e);
    }

    this.barrel.addChild(barrelShape, this.recoilSmoke, this.muzzleFlash);
    this.body.addChild(base, this.barrel);
  }

  public update(unit: DeepReadonly<Unit>, time: number): void {
    this.updateCommon(unit, time);

    this.body.rotation = unit.transform.facing + Math.PI / 2;

    // attackAnim is a short countdown started by the combat simulation.
    // A fast initial kick followed by a softer spring return sells the weight.
    const attackProgress = Math.max(
      0,
      Math.min(1, unit.presentation.attackAnim / ATTACK_ANIMATION_DURATION)
    );
    const recoil = Math.pow(attackProgress, 1.7);
    this.barrel.position.set(0, recoil * 8.5);
    this.barrel.rotation = Math.sin(time * 0.7 + unit.presentation.animationOffset) * 0.012
      + recoil * 0.035;

    // A brief, directional muzzle flash at the start of each shot.
    const elapsedSinceShot = ATTACK_ANIMATION_DURATION - unit.presentation.attackAnim;
    const flash = unit.presentation.attackAnim > 0
      ? Math.max(0, 1 - elapsedSinceShot / 0.075)
      : 0;

    this.muzzleFlash.clear();
    if (flash > 0) {
      this.muzzleFlash
        .ellipse(0, -43, 4 + flash * 5, 3 + flash * 7)
        .fill({ color: 0xffa33e, alpha: flash * 0.9 });
      this.muzzleFlash
        .ellipse(0, -44, 2 + flash * 2.5, 2 + flash * 3.5)
        .fill({ color: 0xffe7a0, alpha: flash });
      this.muzzleFlash
        .moveTo(-2, -43)
        .lineTo(-7 - flash * 4, -48 - flash * 5)
        .moveTo(2, -43)
        .lineTo(7 + flash * 4, -48 - flash * 5)
        .stroke({ color: 0xffc66a, alpha: flash * 0.85, width: 1.5 });
    }

    // A tiny puff lingers after the flash, then dissipates quickly.
    const smokeProgress = unit.presentation.attackAnim > 0
      ? Math.max(0, Math.min(1, (elapsedSinceShot - 0.025) / 0.19))
      : 1;
    const smokeAlpha = unit.presentation.attackAnim > 0
      ? (1 - smokeProgress) * 0.3
      : 0;

    this.recoilSmoke.clear();
    if (smokeAlpha > 0.005) {
      const drift = smokeProgress * 5;
      this.recoilSmoke
        .circle(-2 - drift, -45 - drift, 2 + smokeProgress * 2)
        .fill({ color: 0xc1c5b5, alpha: smokeAlpha * 0.72 });
      this.recoilSmoke
        .circle(2 + drift * 0.6, -47 - drift * 0.7, 1.8 + smokeProgress * 2.2)
        .fill({ color: 0xd5d3bd, alpha: smokeAlpha });
    }
  }
}
