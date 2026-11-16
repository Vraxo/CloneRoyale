import { HUD_HEIGHT } from "../arena/worldViewport";

export interface HudCardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HudLayout {
  width: number;
  top: number;
  padding: number;
  nextWidth: number;
  cardY: number;
  cardHeight: number;
  cards: HudCardRect[];
}

export function calculateHudLayout(width: number, height: number): HudLayout {
  const padding = Math.max(10, Math.min(16, width * 0.022));
  const nextWidth = Math.max(48, Math.min(62, width * 0.09));
  const cardY = height - HUD_HEIGHT + 20;
  const cardHeight = 86;
  const startX = padding + nextWidth + 9;
  const gap = Math.max(5, Math.min(8, width * 0.01));
  const cardWidth = (width - startX - padding - gap * 3) / 4;
  const cards = Array.from({ length: 4 }, (_, index) => ({
    x: startX + index * (cardWidth + gap),
    y: cardY,
    width: cardWidth,
    height: cardHeight
  }));

  return {
    width,
    top: height - HUD_HEIGHT,
    padding,
    nextWidth,
    cardY,
    cardHeight,
    cards
  };
}
