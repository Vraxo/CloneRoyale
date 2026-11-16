import { Container, Graphics, Text } from "pixi.js";
import type { CardId, GameState } from "../../game/types";
import { cardById } from "../../game/cards";
import { calculateHudLayout } from "./hudLayout";

const HUD_HEIGHT = 176;

function createHudText(fontSize: number, fill: number): Text {
  const label = new Text({
    text: "",
    style: {
      fontFamily: "Arial, sans-serif",
      fontSize,
      fill,
      fontWeight: "700",
      align: "center"
    }
  });
  label.eventMode = "none";
  return label;
}

function cardGlyph(cardId: CardId | undefined): string {
  switch (cardId) {
    case "giant": return "G";
    case "archers": return "A";
    case "mini-pekka": return "P";
    case "baby-dragon": return "D";
    case "skeleton-army": return "S";
    case "cannon": return "C";
    case "fireball": return "F";
    case "arrows": return "↗";
    default: return "";
  }
}

export class BattleHud {
  public readonly container = new Container();

  private readonly graphics = new Graphics();
  private readonly cardGlyphs = Array.from({ length: 4 }, () => createHudText(25, 0xf0dfb6));
  private readonly cardNames = Array.from({ length: 4 }, () => createHudText(11, 0xf4eedc));
  private readonly cardCosts = Array.from({ length: 4 }, () => createHudText(12, 0xffffff));
  private readonly nextCardLabel = createHudText(7, 0xf0e4c7);
  private readonly nextCardName = createHudText(9, 0xe7dfca);
  private readonly nextCardCost = createHudText(10, 0xffffff);
  private readonly elixirValue = createHudText(17, 0xf1d8ff);
  private readonly elixirMax = createHudText(8, 0xc1a5d8);
  private readonly placementHint = createHudText(9, 0xc9d1c2);

  public constructor() {
    this.container.eventMode = "none";
    this.container.addChild(
      this.graphics,
      ...this.cardGlyphs,
      ...this.cardNames,
      ...this.cardCosts,
      this.nextCardLabel,
      this.nextCardName,
      this.nextCardCost,
      this.elixirValue,
      this.elixirMax,
      this.placementHint
    );
  }

  public update(
    state: GameState,
    selectedCard: CardId | null,
    message: string,
    width: number,
    height: number
  ): void {
    const layout = calculateHudLayout(width, height);
    const graphics = this.graphics;
    const blue = state.sides.blue;
    const nextCardId = blue.drawPile[0];
    const nextCard = nextCardId ? cardById(nextCardId) : null;

    graphics.clear();
    graphics
      .roundRect(7, layout.top + 4, layout.width - 14, HUD_HEIGHT - 8, 15)
      .fill({ color: 0x202923, alpha: 0.98 });
    graphics
      .roundRect(7, layout.top + 4, layout.width - 14, HUD_HEIGHT - 8, 15)
      .stroke({ color: 0x58634c, alpha: 0.95, width: 1.5 });
    graphics
      .rect(18, layout.top + 5, layout.width - 36, 2)
      .fill({ color: 0xc1a76e, alpha: 0.62 });

    const nextX = layout.padding;
    const nextY = layout.cardY + 16;
    graphics
      .roundRect(nextX, nextY, layout.nextWidth, layout.cardHeight - 16, 7)
      .fill({ color: 0x303a34, alpha: 1 });
    graphics
      .roundRect(nextX, nextY, layout.nextWidth, layout.cardHeight - 16, 7)
      .stroke({ color: 0x7c806a, width: 1 });
    graphics
      .roundRect(nextX + 5, layout.cardY - 1, layout.nextWidth - 10, 14, 4)
      .fill({ color: 0x4b3d62 });
    this.nextCardLabel.text = "NEXT";
    this.nextCardLabel.anchor.set(0.5);
    this.nextCardLabel.position.set(nextX + layout.nextWidth / 2, layout.cardY + 6);
    this.nextCardName.text = nextCard?.name ?? "—";
    this.nextCardName.anchor.set(0.5);
    this.nextCardName.position.set(
      nextX + layout.nextWidth / 2,
      nextY + (layout.cardHeight - 16) / 2
    );
    this.nextCardName.style.fontSize = Math.max(7, Math.min(9, layout.nextWidth * 0.15));
    this.nextCardName.style.wordWrap = true;
    this.nextCardName.style.wordWrapWidth = layout.nextWidth - 8;

    const nextCostX = nextX + layout.nextWidth - 11;
    const nextCostY = nextY + layout.cardHeight - 27;
    graphics.circle(nextCostX, nextCostY, 9).fill({ color: 0x76569a });
    graphics.circle(nextCostX, nextCostY, 9).stroke({ color: 0xc2a4df, width: 1 });
    this.nextCardCost.text = nextCard ? nextCard.cost.toString() : "—";
    this.nextCardCost.anchor.set(0.5);
    this.nextCardCost.position.set(nextCostX, nextCostY);

    this.drawCards(state, selectedCard, layout.cards, graphics);
    this.drawElixir(blue.elixir, layout, graphics);

    this.placementHint.text = message;
    this.placementHint.anchor.set(0.5);
    this.placementHint.position.set(layout.width / 2, layout.top + 151);
    this.placementHint.style.fontSize = Math.max(8, Math.min(10, layout.width * 0.014));
    this.placementHint.style.wordWrap = true;
    this.placementHint.style.wordWrapWidth = layout.width - 28;
  }

  public handCardAt(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    screenWidth: number,
    screenHeight: number
  ): number | null {
    const point = this.clientToScreen(clientX, clientY, canvas, screenWidth, screenHeight);
    if (!point) return null;

    const layout = calculateHudLayout(screenWidth, screenHeight);
    const index = layout.cards.findIndex((card) =>
      point.x >= card.x && point.x <= card.x + card.width
      && point.y >= card.y && point.y <= card.y + card.height
    );

    return index >= 0 ? index : null;
  }

  private drawCards(
    state: GameState,
    selectedCard: CardId | null,
    cards: ReturnType<typeof calculateHudLayout>["cards"],
    graphics: Graphics
  ): void {
    const blue = state.sides.blue;

    for (let index = 0; index < 4; index += 1) {
      const cardId = blue.hand[index];
      const card = cardId ? cardById(cardId) : null;
      const rect = cards[index];
      const affordable = card !== null && blue.elixir >= card.cost;
      const isSelected = cardId !== undefined && cardId === selectedCard;
      const fill = card?.category === "spell"
        ? 0x4b4662
        : card?.category === "building" ? 0x55513e : 0x35473d;
      const border = isSelected ? 0xe3c77d : affordable ? 0x9b936d : 0x576057;

      graphics
        .roundRect(rect.x, rect.y, rect.width, rect.height, 8)
        .fill({ color: fill, alpha: affordable ? 1 : 0.54 });
      graphics
        .roundRect(rect.x, rect.y, rect.width, rect.height, 8)
        .stroke({ color: border, alpha: 1, width: isSelected ? 3 : 1.5 });
      graphics
        .roundRect(rect.x + 5, rect.y + 5, rect.width - 10, rect.height - 10, 5)
        .stroke({ color: 0xe4d7ad, alpha: affordable ? 0.22 : 0.1, width: 1 });

      const glyph = this.cardGlyphs[index];
      const name = this.cardNames[index];
      const cost = this.cardCosts[index];
      glyph.text = card ? cardGlyph(cardId) : "";
      glyph.anchor.set(0.5);
      glyph.position.set(rect.x + rect.width / 2, rect.y + rect.height * 0.38);
      glyph.alpha = affordable ? 1 : 0.45;
      glyph.style.fontSize = Math.max(16, Math.min(27, rect.width * 0.2));

      name.text = card?.name ?? "";
      name.anchor.set(0.5);
      name.position.set(rect.x + rect.width / 2, rect.y + rect.height - 14);
      name.style.fontSize = Math.max(7, Math.min(11, rect.width * 0.085));
      name.style.wordWrap = true;
      name.style.wordWrapWidth = rect.width - 12;
      name.alpha = affordable ? 1 : 0.52;

      const badgeX = rect.x + rect.width - 14;
      const badgeY = rect.y + 14;
      graphics.circle(badgeX, badgeY, 12).fill({ color: 0x76569a, alpha: 0.98 });
      graphics.circle(badgeX, badgeY, 12).stroke({ color: 0xc2a4df, width: 1 });
      cost.text = card ? card.cost.toString() : "";
      cost.anchor.set(0.5);
      cost.position.set(badgeX, badgeY + 0.5);
      cost.alpha = affordable ? 1 : 0.55;
    }
  }

  private drawElixir(
    elixir: number,
    layout: ReturnType<typeof calculateHudLayout>,
    graphics: Graphics
  ): void {
    const meterX = layout.padding + 2;
    const meterY = layout.top + 112;
    const meterWidth = layout.width - layout.padding * 2 - 4;
    graphics
      .roundRect(meterX, meterY, meterWidth, 17, 8)
      .fill({ color: 0x3c3048 });
    graphics
      .roundRect(meterX, meterY, meterWidth * Math.max(0, Math.min(1, elixir / 10)), 17, 8)
      .fill({ color: 0x9956c8 });

    for (let tick = 1; tick < 10; tick += 1) {
      const x = meterX + meterWidth * tick / 10;
      graphics.moveTo(x, meterY + 2).lineTo(x, meterY + 15)
        .stroke({ color: 0x2d2639, alpha: 0.6, width: 1 });
    }

    this.elixirValue.text = elixir.toFixed(1);
    this.elixirValue.anchor.set(0, 0.5);
    this.elixirValue.position.set(meterX + 7, meterY + 8.5);
    this.elixirMax.text = "MAX 10";
    this.elixirMax.anchor.set(1, 0.5);
    this.elixirMax.position.set(meterX + meterWidth - 7, meterY + 8.5);
  }

  private clientToScreen(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    screenWidth: number,
    screenHeight: number
  ): { x: number; y: number } | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    return {
      x: (clientX - rect.left) * (screenWidth / rect.width),
      y: (clientY - rect.top) * (screenHeight / rect.height)
    };
  }
}
