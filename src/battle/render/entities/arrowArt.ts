import type { Graphics } from "pixi.js";

export interface ArrowLayers {
  trail: Graphics;
  feathers: Graphics;
  shaft: Graphics;
  head: Graphics;
  details: Graphics;
}

export interface ArrowOptions {
  tipX: number;
  tipY: number;
  angle: number;
  length: number;
  scale?: number;
  alpha?: number;
  fletchingColor: number;
  trailColor?: number;
  trailLength?: number;
  trailAlpha?: number;
}

export function drawArrow(layers: ArrowLayers, options: ArrowOptions): void {
  const scale = options.scale ?? 1;
  const alpha = Math.max(0, Math.min(1, options.alpha ?? 1));
  if (alpha <= 0) return;

  const directionX = Math.cos(options.angle);
  const directionY = Math.sin(options.angle);
  const perpendicularX = -directionY;
  const perpendicularY = directionX;
  const tipX = options.tipX;
  const tipY = options.tipY;
  const tailX = tipX - directionX * options.length * scale;
  const tailY = tipY - directionY * options.length * scale;
  const headLength = 9 * scale;
  const headWidth = 4.7 * scale;
  const baseX = tipX - directionX * headLength;
  const baseY = tipY - directionY * headLength;
  const trailLength = options.trailLength ?? 0;
  const trailAlpha = options.trailAlpha ?? 0;
  const trailColor = options.trailColor ?? 0xffe4a0;

  if (trailLength > 0 && trailAlpha > 0) {
    const trailStartX = tailX - directionX * trailLength * scale;
    const trailStartY = tailY - directionY * trailLength * scale;

    layers.trail
      .moveTo(trailStartX, trailStartY)
      .quadraticCurveTo(
        tailX - directionX * trailLength * 0.45 * scale + perpendicularX * 2.5 * scale,
        tailY - directionY * trailLength * 0.45 * scale + perpendicularY * 2.5 * scale,
        tailX - directionX * 2 * scale,
        tailY - directionY * 2 * scale
      )
      .stroke({
        color: trailColor,
        width: 3.2 * scale,
        alpha: trailAlpha * alpha,
        cap: "round"
      });

    layers.trail
      .moveTo(
        trailStartX + perpendicularX * 2.1 * scale,
        trailStartY + perpendicularY * 2.1 * scale
      )
      .lineTo(
        tailX - directionX * 4 * scale + perpendicularX * 1.1 * scale,
        tailY - directionY * 4 * scale + perpendicularY * 1.1 * scale
      )
      .stroke({
        color: 0xfff0c7,
        width: 1.1 * scale,
        alpha: trailAlpha * alpha * 0.72,
        cap: "round"
      });
  }

  for (const side of [-1, 1]) {
    const featherStartX = tailX + directionX * 1.2 * scale;
    const featherStartY = tailY + directionY * 1.2 * scale;
    const featherTipX = tailX + directionX * 11 * scale + perpendicularX * side * 4.8 * scale;
    const featherTipY = tailY + directionY * 11 * scale + perpendicularY * side * 4.8 * scale;
    const featherRootX = tailX + directionX * 10 * scale;
    const featherRootY = tailY + directionY * 10 * scale;
    const featherControlX = tailX + directionX * 5.2 * scale + perpendicularX * side * 3.7 * scale;
    const featherControlY = tailY + directionY * 5.2 * scale + perpendicularY * side * 3.7 * scale;

    layers.feathers
      .moveTo(featherStartX, featherStartY)
      .quadraticCurveTo(featherControlX, featherControlY, featherTipX, featherTipY)
      .lineTo(featherRootX, featherRootY)
      .closePath()
      .fill({ color: 0x382d24, alpha: alpha * 0.96 });

    layers.feathers
      .moveTo(featherStartX + perpendicularX * side * 0.7 * scale, featherStartY + perpendicularY * side * 0.7 * scale)
      .quadraticCurveTo(
        featherControlX,
        featherControlY,
        featherTipX - directionX * 1.2 * scale,
        featherTipY - directionY * 1.2 * scale
      )
      .lineTo(featherRootX, featherRootY)
      .closePath()
      .fill({ color: options.fletchingColor, alpha: alpha * 0.96 });

    layers.details
      .moveTo(featherStartX, featherStartY)
      .lineTo(featherRootX, featherRootY)
      .stroke({
        color: 0xf3dfb4,
        width: 0.7 * scale,
        alpha: alpha * 0.75,
        cap: "round"
      });
  }

  const shaftStartX = tailX + directionX * 7 * scale;
  const shaftStartY = tailY + directionY * 7 * scale;
  const shaftEndX = tipX - directionX * headLength * 0.78;
  const shaftEndY = tipY - directionY * headLength * 0.78;

  layers.shaft
    .moveTo(shaftStartX, shaftStartY)
    .lineTo(shaftEndX, shaftEndY)
    .stroke({
      color: 0x34271c,
      width: 4 * scale,
      alpha,
      cap: "round"
    });

  layers.shaft
    .moveTo(
      shaftStartX + perpendicularX * 0.4 * scale,
      shaftStartY + perpendicularY * 0.4 * scale
    )
    .lineTo(
      shaftEndX + perpendicularX * 0.4 * scale,
      shaftEndY + perpendicularY * 0.4 * scale
    )
    .stroke({
      color: 0xd0a45d,
      width: 2.1 * scale,
      alpha,
      cap: "round"
    });

  layers.head
    .moveTo(tipX, tipY)
    .lineTo(baseX + perpendicularX * headWidth, baseY + perpendicularY * headWidth)
    .lineTo(baseX - directionX * 1.8 * scale, baseY - directionY * 1.8 * scale)
    .lineTo(baseX - perpendicularX * headWidth, baseY - perpendicularY * headWidth)
    .closePath()
    .fill({ color: 0x303c45, alpha });

  layers.head
    .moveTo(tipX - directionX * 1.3 * scale, tipY - directionY * 1.3 * scale)
    .lineTo(baseX + perpendicularX * headWidth * 0.57, baseY + perpendicularY * headWidth * 0.57)
    .lineTo(baseX - directionX * 1.6 * scale, baseY - directionY * 1.6 * scale)
    .lineTo(baseX - perpendicularX * headWidth * 0.45, baseY - perpendicularY * headWidth * 0.45)
    .closePath()
    .fill({ color: 0xcbd3d8, alpha: alpha * 0.98 });

  layers.details
    .moveTo(
      tipX - directionX * 2 * scale + perpendicularX * 1.2 * scale,
      tipY - directionY * 2 * scale + perpendicularY * 1.2 * scale
    )
    .lineTo(
      baseX + perpendicularX * headWidth * 0.38,
      baseY + perpendicularY * headWidth * 0.38
    )
    .stroke({
      color: 0xf8f2df,
      width: 1 * scale,
      alpha: alpha * 0.94,
      cap: "round"
    });

  layers.details
    .moveTo(tailX + perpendicularX * 2.1 * scale, tailY + perpendicularY * 2.1 * scale)
    .lineTo(tailX - perpendicularX * 2.1 * scale, tailY - perpendicularY * 2.1 * scale)
    .stroke({
      color: 0x49382a,
      width: 1.6 * scale,
      alpha,
      cap: "round"
    });
}
