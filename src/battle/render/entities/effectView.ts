import { Container, Graphics } from "pixi.js";
import type { DeepReadonly, Effect } from "../../../game/types";
import { drawArrow } from "./arrowArt";

export class EffectView {
  public readonly id: number;
  public readonly container = new Container();

  private readonly graphic = new Graphics();
  private readonly fireballGlow = new Graphics();
  private readonly fireballFlames = new Graphics();
  private readonly fireballShockwave = new Graphics();
  private readonly fireballParticles = new Graphics();
  private readonly arrowGround = new Graphics();
  private readonly arrowTrail = new Graphics();
  private readonly arrowFeathers = new Graphics();
  private readonly arrowShaft = new Graphics();
  private readonly arrowHead = new Graphics();
  private readonly arrowDetails = new Graphics();

  public constructor(effect: DeepReadonly<Effect>) {
    this.id = effect.id;
    this.container.addChild(
      this.fireballGlow,
      this.graphic,
      this.fireballFlames,
      this.fireballShockwave,
      this.fireballParticles,
      this.arrowGround,
      this.arrowTrail,
      this.arrowFeathers,
      this.arrowShaft,
      this.arrowHead,
      this.arrowDetails
    );
    this.update(effect);
  }

  public update(effect: DeepReadonly<Effect>): void {
    const progress = Math.min(1, effect.age / effect.lifetime);
    this.container.position.set(effect.x, effect.y);
    this.graphic.clear();
    this.fireballGlow.clear();
    this.fireballFlames.clear();
    this.fireballShockwave.clear();
    this.fireballParticles.clear();
    this.arrowGround.clear();
    this.arrowTrail.clear();
    this.arrowFeathers.clear();
    this.arrowShaft.clear();
    this.arrowHead.clear();
    this.arrowDetails.clear();

    if (effect.style === "deployment") {
      this.drawDeployment(effect, progress);
      return;
    }

    if (effect.style === "fireball") {
      this.drawFireballExplosion(effect, progress);
      return;
    }

    if (effect.style === "arrows") {
      this.drawArrowVolley(effect, progress);
      return;
    }

    const radius = effect.style === "hit"
      ? effect.radius * (0.6 + progress * 0.8)
      : effect.radius * (0.45 + progress * 0.65);
    const color = effect.style === "hit" ? 0xf1e1a9 : 0xffad55;

    this.graphic.circle(0, 0, radius).stroke({
      color,
      width: effect.style === "hit" ? 2 : 4,
      alpha: 1 - progress
    });
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  private drawFireballExplosion(effect: DeepReadonly<Effect>, progress: number): void {
    const radius = effect.radius;
    const expansion = 1 - Math.pow(1 - progress, 3);
    const fade = Math.pow(1 - progress, 1.12);
    const pulse = 0.94 + Math.sin(progress * 18) * 0.06;

    this.fireballGlow
      .ellipse(
        0,
        radius * 0.17,
        radius * (0.48 + expansion * 0.48),
        radius * (0.18 + expansion * 0.12)
      )
      .fill({ color: 0x3b241b, alpha: 0.3 * fade });

    this.fireballGlow
      .circle(0, 0, radius * (0.16 + expansion * 0.55))
      .fill({ color: 0xe94718, alpha: 0.2 * fade });
    this.fireballGlow
      .circle(0, 0, radius * (0.1 + expansion * 0.36))
      .fill({ color: 0xff8a27, alpha: 0.24 * fade * pulse });

    const flash = Math.max(0, 1 - progress * 4.5);
    if (flash > 0) {
      this.fireballGlow
        .circle(0, 0, radius * (0.13 + progress * 0.56))
        .fill({ color: 0xffedbd, alpha: 0.62 * flash });
    }

    const baseRadius = radius * (0.2 + expansion * 0.65);
    const tongueLength = radius * (0.16 + (1 - progress) * 0.14);
    const tongueWidth = radius * 0.052 * (0.88 + expansion * 0.12);

    const drawTongue = (
      angle: number,
      startRadius: number,
      length: number,
      width: number,
      color: number,
      alpha: number
    ): void => {
      const directionX = Math.cos(angle);
      const directionY = Math.sin(angle);
      const perpendicularX = -directionY;
      const perpendicularY = directionX;
      const centerX = directionX * startRadius;
      const centerY = directionY * startRadius;
      const tipX = directionX * (startRadius + length);
      const tipY = directionY * (startRadius + length);
      const controlRadius = startRadius + length * 0.54;
      const controlLeftX = directionX * controlRadius + perpendicularX * width * 0.9;
      const controlLeftY = directionY * controlRadius + perpendicularY * width * 0.9;
      const controlRightX = directionX * controlRadius - perpendicularX * width * 0.9;
      const controlRightY = directionY * controlRadius - perpendicularY * width * 0.9;

      this.fireballFlames
        .moveTo(
          centerX + perpendicularX * width,
          centerY + perpendicularY * width
        )
        .quadraticCurveTo(controlLeftX, controlLeftY, tipX, tipY)
        .quadraticCurveTo(
          controlRightX,
          controlRightY,
          centerX - perpendicularX * width,
          centerY - perpendicularY * width
        )
        .closePath()
        .fill({ color, alpha });
    };

    for (let index = 0; index < 13; index += 1) {
      const angle = (Math.PI * 2 * index) / 13 + 0.12;
      const lengthVariation = 0.78 + (index % 4) * 0.11;
      const color = index % 3 === 0
        ? 0xd93617
        : index % 3 === 1 ? 0xf35b18 : 0xff8420;

      drawTongue(
        angle,
        baseRadius,
        tongueLength * lengthVariation,
        tongueWidth * (0.82 + (index % 3) * 0.12),
        color,
        0.88 * fade
      );
    }

    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 + 0.42;
      drawTongue(
        angle,
        baseRadius * 0.88,
        tongueLength * 0.62,
        tongueWidth * 0.55,
        index % 2 === 0 ? 0xffb42f : 0xffd65c,
        0.82 * fade
      );
    }

    const shockwaveRadius = radius * (0.2 + expansion * 1.02);
    this.fireballShockwave
      .circle(0, 0, shockwaveRadius)
      .stroke({
        color: 0xffc15a,
        width: Math.max(1.2, 7 * (1 - progress)),
        alpha: 0.64 * fade
      });
    this.fireballShockwave
      .circle(0, 0, shockwaveRadius * 0.83)
      .stroke({
        color: 0xff6b27,
        width: Math.max(1, 3.5 * (1 - progress)),
        alpha: 0.34 * fade
      });

    for (let index = 0; index < 18; index += 1) {
      const angle = index * 2.399963 + 0.18;
      const speed = 0.5 + (index % 5) * 0.105;
      const distance = radius * (0.12 + expansion * speed);
      const gravity = radius * progress * progress * (0.12 + (index % 3) * 0.035);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance + gravity;
      const tailLength = radius * (0.065 + (index % 3) * 0.018) * (1 - progress);
      const tailX = x - Math.cos(angle) * tailLength;
      const tailY = y - Math.sin(angle) * tailLength;
      const particleSize = 1.5 + (index % 3) * 0.85;
      const alpha = fade * (0.72 + (index % 4) * 0.07);
      const color = index % 3 === 0 ? 0xffed9a : index % 3 === 1 ? 0xff9a31 : 0xe94a1d;

      this.fireballParticles
        .moveTo(tailX, tailY)
        .lineTo(x, y)
        .stroke({
          color,
          width: particleSize,
          alpha,
          cap: "round"
        });
      this.fireballParticles
        .circle(x, y, particleSize * 0.68)
        .fill({ color, alpha });
    }
  }

  private drawArrowVolley(effect: DeepReadonly<Effect>, progress: number): void {
    const radius = effect.radius;
    const age = effect.age;
    const ringProgress = Math.min(1, age / 0.24);
    const ringFade = 1 - Math.min(1, age / 0.46);
    const teamFletching = effect.side === "red" ? 0xc56e65 : 0x659bc8;
    const arrowLayers = {
      trail: this.arrowTrail,
      feathers: this.arrowFeathers,
      shaft: this.arrowShaft,
      head: this.arrowHead,
      details: this.arrowDetails
    };

    this.arrowGround
      .ellipse(0, 4, radius * 0.87, radius * 0.79)
      .fill({ color: 0x3b3327, alpha: 0.085 * ringFade });

    this.arrowGround
      .circle(0, 0, radius * (0.78 + ringProgress * 0.13))
      .stroke({
        color: 0xe6c77f,
        width: 2.5 * (1 - ringProgress * 0.55),
        alpha: 0.38 * ringFade
      });

    this.arrowGround
      .circle(0, 0, radius * 0.72)
      .stroke({
        color: 0x51452f,
        width: 1.1,
        alpha: 0.16 * ringFade
      });

    const arrowCount = 20;
    for (let index = 0; index < arrowCount; index += 1) {
      const spiralAngle = index * 2.399963 + 0.31;
      const normalizedDistance = Math.sqrt((index + 0.5) / arrowCount);
      const distance = radius * normalizedDistance * 0.82;
      const landingX = Math.cos(spiralAngle) * distance;
      const landingY = Math.sin(spiralAngle) * distance;
      const startDelay = (index % 6) * 0.026 + normalizedDistance * 0.028;
      const flightDuration = 0.25 + (index % 4) * 0.014;
      const localAge = age - startDelay;

      if (localAge < 0) continue;

      const flightProgress = Math.min(1, localAge / flightDuration);
      const easedFlight = 1 - Math.pow(1 - flightProgress, 2.15);
      const lift = 94 + (index % 4) * 9;
      const lateralDrift = 12 + (index % 3) * 3;
      const tipX = landingX - (1 - easedFlight) * lateralDrift;
      const tipY = landingY - (1 - easedFlight) * lift;
      const landedAge = Math.max(0, localAge - flightDuration);
      const visibility = landedAge > 0.32
        ? 1 - Math.min(1, (landedAge - 0.32) / 0.38)
        : 1;
      const lean = ((index % 7) - 3) * 0.055;
      const alpha = 0.96 * visibility;

      if (flightProgress >= 1) {
        this.arrowGround
          .ellipse(landingX + 3, landingY + 3, 8.5, 3.2)
          .fill({ color: 0x252b20, alpha: 0.28 * visibility });

        if (landedAge < 0.1) {
          const dust = 1 - landedAge / 0.1;
          this.arrowGround
            .ellipse(
              landingX,
              landingY + 1,
              8 + dust * 8,
              3 + dust * 3
            )
            .fill({ color: 0xcab584, alpha: 0.2 * dust });
        }
      }

      drawArrow(arrowLayers, {
        tipX,
        tipY,
        angle: Math.PI / 2 + lean,
        length: 30 + (index % 4) * 2,
        scale: 0.86 + (index % 3) * 0.055,
        alpha,
        fletchingColor: teamFletching,
        trailColor: 0xffe4a3,
        trailLength: flightProgress < 1 ? 18 * (1 - flightProgress) : 0,
        trailAlpha: flightProgress < 1 ? 0.54 * (1 - flightProgress) : 0
      });
    }

    const flash = Math.max(0, 1 - age / 0.12);
    if (flash > 0) {
      this.arrowGround
        .circle(0, 0, radius * (0.24 + flash * 0.12))
        .fill({ color: 0xfff0c6, alpha: 0.13 * flash });
    }

    void progress;
  }

  private drawDeployment(effect: DeepReadonly<Effect>, progress: number): void {
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
