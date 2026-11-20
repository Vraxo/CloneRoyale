import { Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { CardId, ReadonlyGameState, Side } from "../../../game/types";
import { cardById } from "../../../game/cards";
import { MATCH_RULES } from "../../../game/matchRules";
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
  knight: "/cards/knight.png"
};

function formatClock(seconds: number): string {
  const remaining = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const rest = (remaining % 60).toString().padStart(2, "0");
  return minutes + ":" + rest;
}

function remainingMatchSeconds(state: ReadonlyGameState): number | null {
  if (state.phase === "regulation") {
    return MATCH_RULES.regulationSeconds - state.time;
  }
  if (state.phase === "overtime") {
    return MATCH_RULES.regulationSeconds + MATCH_RULES.overtimeSeconds - state.time;
  }
  return null;
}

function matchClock(state: ReadonlyGameState): string {
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
  private readonly cardProgressGraphics = new Graphics();
  private readonly cardArts = Array.from({ length: 4 }, () => new Sprite(Texture.EMPTY));
  private readonly nextCardArt = new Sprite(Texture.EMPTY);
  private readonly cardTextures = new Map<CardId, Texture>();
  private lastHandCardIds: (CardId | undefined)[] = [];
  private readonly cardGlyphs = Array.from({ length: 4 }, () => createHudText(25, 0xf0dfb6, "Supercell Magic"));
  private readonly cardCosts = Array.from({ length: 4 }, () => createHudText(12, 0xffffff, "Supercell Magic"));
  private readonly nextCardCost = createHudText(10, 0xffffff, "Supercell Magic");
  private readonly elixirValue = createHudText(17, 0xf1d8ff);
  private readonly elixirMax = createHudText(8, 0xc1a5d8);
  private readonly placementHint = createHudText(9, 0xc5d9ee);
  private readonly matchClockLabel = createHudText(19, 0xf4eedc, "Supercell Magic");
  private readonly clockModeLabel = createHudText(8, 0xf4d8ff, "Supercell Magic");
  private readonly notificationGraphics = new Graphics();
  private readonly notificationLabel = createHudText(23, 0xfff1cf, "Supercell Magic");
  private previousPhase: ReadonlyGameState["phase"] | null = null;
  private previousTime = 0;
  private notificationText = "";
  private notificationStartedAt = 0;
  private notificationDuration = 2600;

  public constructor() {
    this.container.eventMode = "none";
    this.container.addChild(
      this.graphics,
      this.nextCardArt,
      ...this.cardArts,
      this.cardProgressGraphics,
      ...this.cardGlyphs,
      ...this.cardCosts,
      this.nextCardCost,
      this.elixirValue,
      this.elixirMax,
      this.placementHint,
      this.matchClockLabel,
      this.clockModeLabel,
      this.notificationGraphics,
      this.notificationLabel,
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
    state: ReadonlyGameState,
    selectedCard: CardId | null,
    message: string,
    width: number,
    height: number,
    side: Side = "blue"
  ): void {
    this.updateMatchNotification(state);
    const layout = calculateHudLayout(width, height);
    const graphics = this.graphics;
    this.cardProgressGraphics.clear();
    const player = state.sides[side];
    const nextCardId = player.drawPile[0];
    this.lastHandCardIds = [...player.hand];
    const nextCard = nextCardId ? cardById(nextCardId) : null;

    graphics.clear();
bottom panel    const nextX = layout.padding;
    const nextY = layout.cardY + 16;
next card frame    const nextTexture = nextCard ? this.cardTextures.get(nextCard.id) : undefined;
    this.nextCardArt.visible = nextTexture !== undefined;
    if (nextTexture) {
      fitCardArt(
        this.nextCardArt,
        nextTexture,
        nextX + layout.nextWidth / 2,
        nextY + (layout.cardHeight - 16) / 2,
        layout.nextWidth,
        layout.cardHeight - 16
      );
    }
next card name    const nextCostX = nextX + layout.nextWidth - 12;
    const nextCostY = nextY + 12;
    graphics.circle(nextCostX, nextCostY, 9).fill({ color: 0x76569a });
    graphics.circle(nextCostX, nextCostY, 9).stroke({ color: 0xc2a4df, width: 1 });
    this.nextCardCost.text = nextCard ? nextCard.cost.toString() : "—";
    this.nextCardCost.anchor.set(0.5);
    this.nextCardCost.position.set(nextCostX, nextCostY);

    this.drawMatchClock(state, layout.width, graphics);
    this.drawCards(state, selectedCard, layout.cards, graphics, side);
    this.drawElixir(player.elixir, layout, graphics, state.time);
    this.drawMatchNotification(width, height);

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

  private updateMatchNotification(state: ReadonlyGameState): void {
    const previousRemaining = this.previousPhase === "regulation"
      ? MATCH_RULES.regulationSeconds - this.previousTime
      : this.previousPhase === "overtime"
        ? MATCH_RULES.regulationSeconds + MATCH_RULES.overtimeSeconds - this.previousTime
        : null;
    const remaining = remainingMatchSeconds(state);

    if (this.previousPhase !== null && this.previousPhase !== state.phase) {
      if (state.phase === "overtime") {
        this.showMatchNotification("OVERTIME!", "SUDDEN DEATH", 0xf18a62, 3400);
      } else if (state.phase === "tiebreaker") {
        this.showMatchNotification("TIEBREAKER!", "TOWERS DECIDE THE WINNER", 0xffb36f, 3400);
      } else if (state.phase === "finished") {
        this.showMatchNotification(
          state.winner === "draw" ? "DRAW!" : state.winner === "blue" ? "BLUE VICTORY!" : "RED VICTORY!",
          "MATCH COMPLETE",
          state.winner === "draw" ? 0xffd27a : 0xffe6a0,
          3200
        );
      }
    } else if (this.previousPhase === "regulation" && state.phase === "regulation"
      && previousRemaining !== null && remaining !== null
      && previousRemaining > MATCH_RULES.doubleElixirStartsAt
      && remaining <= MATCH_RULES.doubleElixirStartsAt) {
      this.showMatchNotification("DOUBLE ELIXIR!", "1 MINUTE LEFT · 2× ELIXIR", 0xd8a0ff, 3200);
    } else if (this.previousPhase === "overtime" && state.phase === "overtime"
      && this.previousTime < MATCH_RULES.regulationSeconds + MATCH_RULES.overtimeTripleElixirStartsAt
      && state.time >= MATCH_RULES.regulationSeconds + MATCH_RULES.overtimeTripleElixirStartsAt) {
      this.showMatchNotification("TRIPLE ELIXIR!", "ELIXIR GENERATES 3× FASTER", 0xffa16d, 3200);
    } else if (remaining !== null && this.previousPhase === state.phase
      && previousRemaining !== null && previousRemaining > 10 && remaining <= 10) {
      this.showMatchNotification("10 SECONDS LEFT!", "FINAL COUNTDOWN", 0xff806b, 1800);
    } else if (remaining !== null && this.previousPhase === state.phase
      && previousRemaining !== null && previousRemaining > 3 && remaining <= 3) {
      this.showMatchNotification(Math.ceil(remaining) + "...", " ", 0xff806b, 850);
    }

    this.previousPhase = state.phase;
    this.previousTime = state.time;
  }

  private showMatchNotification(title: string, subtitle: string, color: number, duration: number): void {
    this.notificationText = title + (subtitle.trim() ? "|" + subtitle : "");
    this.notificationStartedAt = Date.now();
    this.notificationDuration = duration;
    this.notificationLabel.style.fill = color;
  }

  private drawMatchNotification(width: number, height: number): void {
    const graphics = this.notificationGraphics;
    graphics.clear();
    const elapsed = Date.now() - this.notificationStartedAt;
    if (!this.notificationText || elapsed >= this.notificationDuration) {
      this.notificationLabel.visible = false;
      return;
    }

    const progress = elapsed / this.notificationDuration;
    const fadeIn = Math.min(1, elapsed / 180);
    const fadeOut = Math.min(1, (1 - progress) * 5);
    const alpha = Math.min(fadeIn, fadeOut);
    const scale = 0.92 + Math.min(1, elapsed / 220) * 0.08;
    const [title, subtitle = ""] = this.notificationText.split("|");
    const bannerWidth = Math.min(width - 36, Math.max(230, Math.min(360, width * 0.62)));
    const bannerHeight = subtitle ? 68 : 52;
    const x = (width - bannerWidth) / 2;
    const y = Math.max(82, height * 0.29);

    graphics
      .roundRect(x - 5, y - 4, bannerWidth + 10, bannerHeight + 8, 13)
      .fill({ color: 0x07182b, alpha: 0.2 * alpha });
    graphics
      .roundRect(x, y, bannerWidth, bannerHeight, 10)
      .fill({ color: 0x102d50, alpha: 0.94 * alpha });
    graphics
      .roundRect(x, y, bannerWidth, bannerHeight, 10)
      .stroke({ color: 0xffd16a, alpha: 0.92 * alpha, width: 2 });
    graphics
      .rect(x + 12, y + 5, bannerWidth - 24, 2)
      .fill({ color: 0xffe4a0, alpha: 0.75 * alpha });

    this.notificationLabel.visible = true;
    this.notificationLabel.text = subtitle ? title + "\n" + subtitle : title;
    this.notificationLabel.anchor.set(0.5);
    this.notificationLabel.position.set(width / 2, y + bannerHeight / 2);
    this.notificationLabel.alpha = alpha;
    this.notificationLabel.scale.set(scale);
    this.notificationLabel.style.fontSize = subtitle ? 21 : 25;
    this.notificationLabel.style.lineHeight = subtitle ? 27 : 30;
  }

  private drawMatchClock(state: ReadonlyGameState, width: number, graphics: Graphics): void {
    const clockWidth = 104;
    const clockHeight = 36;
    const x = (width - clockWidth) / 2;
    const y = 10;
    const remaining = remainingMatchSeconds(state);
    const lastTenSeconds = remaining !== null && remaining > 0 && remaining <= 10;
    const doubleElixir = state.phase === "regulation"
      ? state.time >= MATCH_RULES.doubleElixirStartsAt
      : state.phase === "overtime" && state.time < MATCH_RULES.regulationSeconds + MATCH_RULES.overtimeTripleElixirStartsAt;
    const tripleElixir = state.phase === "overtime"
      && state.time >= MATCH_RULES.regulationSeconds + MATCH_RULES.overtimeTripleElixirStartsAt;
    const overtime = state.phase === "overtime";
    const tiebreaker = state.phase === "tiebreaker";
    const pulse = 0.5 + (Math.sin(state.time * 5) + 1) * 0.25;
    const urgentPulse = 0.5 + (Math.sin(state.time * 11) + 1) * 0.25;

    const accent = lastTenSeconds || tripleElixir || tiebreaker
      ? 0xf07855
      : overtime
        ? 0xe56d54
        : doubleElixir
          ? 0xc78aff
          : 0xffcf55;
    const background = lastTenSeconds || tripleElixir || tiebreaker
      ? 0x482522
      : overtime
        ? 0x42272d
        : doubleElixir
          ? 0x302342
          : 0x102d50;

    if (doubleElixir || overtime || tripleElixir || lastTenSeconds || tiebreaker) {
      const intensity = lastTenSeconds ? 0.25 + urgentPulse * 0.22 : 0.13 + pulse * 0.13;
      graphics
        .roundRect(x - 5, y - 5, clockWidth + 10, clockHeight + 10, 13)
        .stroke({ color: accent, alpha: intensity, width: lastTenSeconds ? 8 : 6 });
    }

    graphics
      .roundRect(x, y, clockWidth, clockHeight, 9)
      .fill({ color: background, alpha: 0.99 });
    graphics
      .roundRect(x, y, clockWidth, clockHeight, 9)
      .stroke({
        color: accent,
        alpha: lastTenSeconds ? 0.72 + urgentPulse * 0.28 : 0.9,
        width: lastTenSeconds ? 2.5 : 1.7
      });

    if (doubleElixir && !overtime && !lastTenSeconds) {
      graphics.circle(x + 8, y + clockHeight / 2, 2.2).fill({ color: 0xe3b8ff, alpha: 0.9 });
      graphics.circle(x + clockWidth - 8, y + clockHeight / 2, 2.2).fill({ color: 0xe3b8ff, alpha: 0.9 });
    }
    if (lastTenSeconds) {
      graphics
        .roundRect(x + 3, y + 3, clockWidth - 6, clockHeight - 6, 7)
        .stroke({ color: 0xffa18b, alpha: 0.18 + urgentPulse * 0.25, width: 1.5 });
    }

    this.matchClockLabel.text = matchClock(state);
    this.matchClockLabel.style.fill = lastTenSeconds || tiebreaker
      ? 0xffa18b
      : tripleElixir
        ? 0xffb18c
        : overtime
          ? 0xffc0a6
          : doubleElixir
            ? 0xe5c5ff
            : 0xfff3cf;
    this.matchClockLabel.style.fontSize = lastTenSeconds ? 21 : 19;
    this.matchClockLabel.anchor.set(0.5);
    this.matchClockLabel.position.set(width / 2, y + clockHeight / 2);

    const modeLabel = tiebreaker
      ? "TIEBREAKER"
      : tripleElixir
        ? "TRIPLE ELIXIR"
        : overtime
          ? "OVERTIME · 2× ELIXIR"
          : doubleElixir
            ? remaining !== null && remaining <= 60 && remaining > 55
              ? "60 SECONDS LEFT · 2×"
              : "DOUBLE ELIXIR"
            : "";
    this.clockModeLabel.text = modeLabel;
    this.clockModeLabel.visible = modeLabel.length > 0;
    this.clockModeLabel.anchor.set(0.5);
    this.clockModeLabel.position.set(width / 2, y + clockHeight + 11);
    this.clockModeLabel.style.fill = accent;
    this.clockModeLabel.style.fontSize = 8;
    this.clockModeLabel.alpha = lastTenSeconds ? 0.7 + urgentPulse * 0.3 : 0.92;
  }
  drawCardBadges method  private drawCards(
    state: ReadonlyGameState,
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
card foreground      const art = this.cardArts[index];
      const texture = card ? this.cardTextures.get(card.id) : undefined;
      art.visible = texture !== undefined;
      if (texture) {
        fitCardArt(
          art,
          texture,
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          rect.width,
          rect.height
        );
        art.alpha = 1;
      } else {
        art.texture = Texture.EMPTY;
      }

      if (card && !affordable) {
        const progress = Math.max(0, Math.min(1, player.elixir / card.cost));
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const radius = Math.min(rect.width, rect.height) * 0.43;
        const startAngle = -Math.PI / 2;
        const remainingAngle = (1 - progress) * Math.PI * 2;
        const progressGraphics = this.cardProgressGraphics;

        if (remainingAngle > 0.001) {
          progressGraphics
            .moveTo(centerX, centerY)
            .lineTo(centerX, centerY - radius)
            .arc(centerX, centerY, radius, startAngle, startAngle + remainingAngle)
            .closePath()
            .fill({ color: 0x07182b, alpha: 0.58 });
        }

        progressGraphics
          .circle(centerX, centerY, radius + 2)
          .stroke({ color: 0x101d31, alpha: 0.8, width: 3 });
        if (progress > 0.002) {
          progressGraphics
            .moveTo(
              centerX + (radius + 2) * Math.cos(startAngle),
              centerY + (radius + 2) * Math.sin(startAngle)
            )
            .arc(centerX, centerY, radius + 2, startAngle, startAngle + progress * Math.PI * 2)
            .stroke({ color: 0xd7b5f2, alpha: 0.98, width: 3 });
        }
      }

      const glyph = this.cardGlyphs[index];
      glyph.visible = !art.visible;
      const cost = this.cardCosts[index];
      glyph.text = card ? cardGlyph(cardId) : "";
      glyph.anchor.set(0.5);
      glyph.position.set(rect.x + rect.width / 2, rect.y + rect.height * 0.38);
      glyph.alpha = affordable ? 1 : 0.7;
      glyph.style.fontSize = Math.max(16, Math.min(27, rect.width * 0.2));

name rendering      const badgeX = rect.x + rect.width - 13;
      const badgeY = rect.y + 13;
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
    graphics: Graphics,
    time: number
  ): void {
    const meterX = layout.padding + 2;
    const meterY = layout.top + 112;
    const meterWidth = layout.width - layout.padding * 2 - 4;
    const isFull = elixir >= 10;
    const pulse = 0.5 + (Math.sin(time * 5) + 1) * 0.25;
    const fillWidth = meterWidth * Math.max(0, Math.min(1, elixir / 10));

    if (isFull) {
      graphics
        .roundRect(meterX - 4, meterY - 4, meterWidth + 8, 25, 12)
        .stroke({ color: 0xd99aff, alpha: 0.16 + pulse * 0.16, width: 9 });
      graphics
        .roundRect(meterX - 2, meterY - 2, meterWidth + 4, 21, 10)
        .stroke({ color: 0xe7baff, alpha: 0.38 + pulse * 0.25, width: 3 });
    }

    graphics
      .roundRect(meterX, meterY, meterWidth, 17, 8)
      .fill({ color: 0x3c3048 });
    graphics
      .roundRect(meterX, meterY, fillWidth, 17, 8)
      .fill({ color: isFull ? 0xb96bea : 0x9956c8 });

    if (isFull) {
      graphics
        .roundRect(meterX + 2, meterY + 2, Math.max(0, fillWidth - 4), 4, 2)
        .fill({ color: 0xf4d9ff, alpha: 0.38 + pulse * 0.3 });
      graphics
        .roundRect(meterX, meterY, meterWidth, 17, 8)
        .stroke({ color: 0xf0caff, alpha: 0.8 + pulse * 0.2, width: 1.5 });
    }

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
