import { Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { CardId, GameState, Side } from "../../game/types";
import { cardById } from "../../game/cards";
import { MATCH_RULES } from "../../game/matchRules";
import { calculateHudLayout } from "./hudLayout";

const HUD_HEIGHT = 176;

const CARD_ART: Record<CardId, string> = {
  giant: "/cards/giant.png",
  archers: "/cards/archers.png",
  "mini-pekka": "/cards/mini-pekka.png",
  "baby-dragon": "/cards/baby-dragon.png",
  "skeleton-army": "/cards/skeleton-army.png",
  cannon: "/cards/cannon.png",
  fireball: "/cards/fireball.png",
  arrows: "/cards/arrows.png",
  knight: "/cards/knight.svg"
};

function formatClock(seconds: number): string {
  const remaining = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const rest = (remaining % 60).toString().padStart(2, "0");
  return minutes + ":" + rest;
}

function remainingMatchSeconds(state: GameState): number | null {
  if (state.phase === "regulation") {
    return MATCH_RULES.regulationSeconds - state.time;
  }
  if (state.phase === "overtime") {
    return MATCH_RULES.regulationSeconds + MATCH_RULES.overtimeSeconds - state.time;
  }
  return null;
}

function matchClock(state: GameState): string {
  switch (state.phase) {
    case "regulation":
      return formatClock(MATCH_RULES.regulationSeconds - state.time);
    case "overtime":
      return formatClock(MATCH_RULES.regulationSeconds + MATCH_RULES.overtimeSeconds - state.time);
    case "tiebreaker":
      return "TIE";
    case "finished":
      return "00:00";
  }
}

function createHudText(fontSize: number, fill: number, fontFamily = "SC CCBackBeat"): Text {
  const label = new Text({
    text: "",
    style: {
      fontFamily,
      fontSize,
      fill,
      fontWeight: "400",
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
    case "knight": return "K";
    default: return "";
  }
}

function fitCardArt(
  sprite: Sprite,
  texture: Texture,
  centerX: number,
  centerY: number,
  maxWidth: number,
  maxHeight: number
): void {
  const aspectRatio = texture.width / texture.height;
  const width = Math.min(maxWidth, maxHeight * aspectRatio);
  const height = width / aspectRatio;

  sprite.texture = texture;
  sprite.position.set(centerX, centerY);
  sprite.width = width;
  sprite.height = height;
}

export class BattleHud {
  public readonly container = new Container();

  private readonly graphics = new Graphics();
  private readonly cardOverlayGraphics = new Graphics();
  private readonly cardArts = Array.from({ length: 4 }, () => new Sprite(Texture.EMPTY));
  private readonly nextCardArt = new Sprite(Texture.EMPTY);
  private readonly cardTextures = new Map<CardId, Texture>();
  private lastHandCardIds: (CardId | undefined)[] = [];
  private readonly cardGlyphs = Array.from({ length: 4 }, () => createHudText(25, 0xf0dfb6, "Supercell Magic"));
  private readonly cardNames = Array.from({ length: 4 }, () => createHudText(11, 0xf4eedc, "Supercell Magic"));
  private readonly cardCosts = Array.from({ length: 4 }, () => createHudText(12, 0xffffff, "Supercell Magic"));
  private readonly nextCardLabel = createHudText(7, 0xf0e4c7);
  private readonly nextCardName = createHudText(9, 0xe7dfca, "Supercell Magic");
  private readonly nextCardCost = createHudText(10, 0xffffff, "Supercell Magic");
  private readonly elixirValue = createHudText(17, 0xf1d8ff);
  private readonly elixirMax = createHudText(8, 0xc1a5d8);
  private readonly placementHint = createHudText(9, 0xc5d9ee);
  private readonly matchClockLabel = createHudText(19, 0xf4eedc, "Supercell Magic");

  public constructor() {
    this.container.eventMode = "none";
    this.container.addChild(
      this.graphics,
      this.nextCardArt,
      ...this.cardArts,
      this.cardOverlayGraphics,
      ...this.cardGlyphs,
      ...this.cardNames,
      ...this.cardCosts,
      this.nextCardLabel,
      this.nextCardName,
      this.nextCardCost,
      this.elixirValue,
      this.elixirMax,
      this.placementHint,
      this.matchClockLabel,
    );

    this.nextCardArt.eventMode = "none";
    this.cardArts.forEach((art) => {
      art.eventMode = "none";
      art.anchor.set(0.5);
      art.visible = false;
    });
    this.nextCardArt.anchor.set(0.5);
    this.nextCardArt.visible = false;
  }

  public async loadCardArt(): Promise<void> {
    const loaded = await Promise.all(
      (Object.entries(CARD_ART) as [CardId, string][]).map(async ([cardId, source]) => {
        try {
          return [cardId, await Assets.load<Texture>(source)] as const;
        } catch {
          return null;
        }
      })
    );

    for (const entry of loaded) {
      if (!entry) continue;
      this.cardTextures.set(entry[0], entry[1]);
    }
  }

  public update(
    state: GameState,
    selectedCard: CardId | null,
    message: string,
    width: number,
    height: number,
    side: Side = "blue"
  ): void {
    const layout = calculateHudLayout(width, height);
    const graphics = this.graphics;
    const player = state.sides[side];
    const nextCardId = player.drawPile[0];
    this.lastHandCardIds = [...player.hand];
    const nextCard = nextCardId ? cardById(nextCardId) : null;

    graphics.clear();
    graphics
      .roundRect(7, layout.top + 4, layout.width - 14, HUD_HEIGHT - 8, 15)
      .fill({ color: 0x102d50, alpha: 0.99 });
    graphics
      .roundRect(7, layout.top + 4, layout.width - 14, HUD_HEIGHT - 8, 15)
      .stroke({ color: 0x477eae, alpha: 0.98, width: 1.5 });
    graphics
      .rect(18, layout.top + 5, layout.width - 36, 2)
      .fill({ color: 0xffcf55, alpha: 0.88 });

    const nextX = layout.padding;
    const nextY = layout.cardY + 16;
    graphics
      .roundRect(nextX, nextY, layout.nextWidth, layout.cardHeight - 16, 7)
      .fill({ color: 0x1b4771, alpha: 1 });
    graphics
      .roundRect(nextX, nextY, layout.nextWidth, layout.cardHeight - 16, 7)
      .stroke({ color: 0x6ba7d5, width: 1 });
    graphics
      .roundRect(nextX + 5, layout.cardY - 1, layout.nextWidth - 10, 14, 4)
      .fill({ color: 0x285783 });
    this.nextCardLabel.text = "NEXT";
    this.nextCardLabel.anchor.set(0.5);
    this.nextCardLabel.position.set(nextX + layout.nextWidth / 2, layout.cardY + 6);
    const nextTexture = nextCard ? this.cardTextures.get(nextCard.id) : undefined;
    this.nextCardArt.visible = nextTexture !== undefined;
    if (nextTexture) {
      fitCardArt(
        this.nextCardArt,
        nextTexture,
        nextX + layout.nextWidth / 2,
        nextY + (layout.cardHeight - 24) / 2 + 3,
        layout.nextWidth - 10,
        layout.cardHeight - 24
      );
    }
    this.nextCardName.visible = false;
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

    this.drawMatchClock(state, layout.width, graphics);
    this.drawCards(state, selectedCard, layout.cards, graphics, side);
    this.drawCardBadges(layout, selectedCard);
    this.drawElixir(player.elixir, layout, graphics);

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
    screenHeight: number,
    selectedCard: CardId | null = null
  ): number | null {
    const point = this.clientToScreen(clientX, clientY, canvas, screenWidth, screenHeight);
    if (!point) return null;

    const layout = calculateHudLayout(screenWidth, screenHeight);
    const index = layout.cards.findIndex((card, cardIndex) => {
      const isSelected = selectedCard !== null
        && this.lastHandCardIds[cardIndex] === selectedCard;
      const top = card.y - (isSelected ? 8 : 0);
      return point.x >= card.x && point.x <= card.x + card.width
        && point.y >= top && point.y <= top + card.height;
    });

    return index >= 0 ? index : null;
  }

  private drawMatchClock(state: GameState, width: number, graphics: Graphics): void {
    const clockWidth = 92;
    const clockHeight = 34;
    const x = (width - clockWidth) / 2;
    const y = 12;

    const remaining = remainingMatchSeconds(state);
    const countdownActive = remaining !== null && remaining > 0 && remaining <= 10;
    graphics
      .roundRect(x, y, clockWidth, clockHeight, 9)
      .fill({ color: countdownActive ? 0x4a2928 : 0x102d50, alpha: 0.99 });
    graphics
      .roundRect(x, y, clockWidth, clockHeight, 9)
      .stroke({
        color: countdownActive ? 0xe36b58 : 0xffcf55,
        alpha: 0.95,
        width: countdownActive ? 2 : 1.5
      });

    this.matchClockLabel.text = matchClock(state);
    this.matchClockLabel.style.fill = countdownActive ? 0xff8b78 : 0xfff3cf;
    this.matchClockLabel.anchor.set(0.5);
    this.matchClockLabel.position.set(width / 2, y + clockHeight / 2);
  }
  private drawCardBadges(
    layout: ReturnType<typeof calculateHudLayout>,
    selectedCard: CardId | null
  ): void {
    const graphics = this.cardOverlayGraphics;
    graphics.clear();

    const nextX = layout.padding;
    const nextCostX = nextX + layout.nextWidth - 11;
    const nextCostY = layout.cardY + layout.cardHeight - 11;
    graphics.circle(nextCostX, nextCostY, 9).fill({ color: 0x76569a });
    graphics.circle(nextCostX, nextCostY, 9).stroke({ color: 0xc2a4df, width: 1 });

    for (let index = 0; index < layout.cards.length; index += 1) {
      const rect = layout.cards[index];
      const badgeX = rect.x + rect.width - 14;
      const badgeY = rect.y + (this.lastHandCardIds[index] === selectedCard ? 6 : 14);
      graphics.circle(badgeX, badgeY, 12).fill({ color: 0x76569a, alpha: 0.98 });
      graphics.circle(badgeX, badgeY, 12).stroke({ color: 0xc2a4df, width: 1 });
    }
  }

  private drawCards(
    state: GameState,
    selectedCard: CardId | null,
    cards: ReturnType<typeof calculateHudLayout>["cards"],
    graphics: Graphics,
    side: Side
  ): void {
    const player = state.sides[side];

    for (let index = 0; index < 4; index += 1) {
      const cardId = player.hand[index];
      const card = cardId ? cardById(cardId) : null;
      const baseRect = cards[index];
      const isSelected = cardId !== undefined && cardId === selectedCard;
      const rect = isSelected ? { ...baseRect, y: baseRect.y - 8 } : baseRect;
      const affordable = card !== null && player.elixir >= card.cost;
      const fill = card?.category === "spell"
        ? 0x403a66
        : card?.category === "building" ? 0x62502f : 0x1e4b70;
      const border = isSelected ? 0xffd45e : affordable ? 0x8cc9f6 : 0x34516d;

      graphics
        .roundRect(rect.x, rect.y, rect.width, rect.height, 8)
        .fill({ color: fill, alpha: affordable ? 1 : 0.54 });
      graphics
        .roundRect(rect.x, rect.y, rect.width, rect.height, 8)
        .stroke({ color: border, alpha: 1, width: isSelected ? 3 : 1.5 });
      graphics
        .roundRect(rect.x + 5, rect.y + 5, rect.width - 10, rect.height - 10, 5)
        .stroke({ color: 0xe4d7ad, alpha: affordable ? 0.22 : 0.1, width: 1 });

      const art = this.cardArts[index];
      const texture = card ? this.cardTextures.get(card.id) : undefined;
      art.visible = texture !== undefined;
      if (texture) {
        const artHeight = Math.min(62, rect.height - 21);
        fitCardArt(
          art,
          texture,
          rect.x + rect.width / 2,
          rect.y + artHeight / 2 + 3,
          rect.width - 12,
          artHeight
        );
        art.alpha = affordable ? 1 : 0.5;
      } else {
        art.texture = Texture.EMPTY;
      }

      const glyph = this.cardGlyphs[index];
      glyph.visible = !art.visible;
      const name = this.cardNames[index];
      const cost = this.cardCosts[index];
      glyph.text = card ? cardGlyph(cardId) : "";
      glyph.anchor.set(0.5);
      glyph.position.set(rect.x + rect.width / 2, rect.y + rect.height * 0.38);
      glyph.alpha = affordable ? 1 : 0.45;
      glyph.style.fontSize = Math.max(16, Math.min(27, rect.width * 0.2));

      name.text = card?.name ?? "";
      name.anchor.set(0.5);
      name.position.set(rect.x + rect.width / 2, rect.y + rect.height - 8);
      name.style.fontSize = Math.max(7, Math.min(9, rect.width * 0.075));
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

    this.elixirValue.text = Math.floor(elixir).toString();
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
