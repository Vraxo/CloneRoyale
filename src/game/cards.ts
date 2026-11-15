import type { CardDefinition, CardId } from "./types";
import { ARCHERS_CARD } from "./cards/archers";
import { ARROWS_CARD } from "./cards/arrows";
import { BABY_DRAGON_CARD } from "./cards/babyDragon";
import { CANNON_CARD } from "./cards/cannon";
import { FIREBALL_CARD } from "./cards/fireball";
import { GIANT_CARD } from "./cards/giant";
import { MINI_PEKKA_CARD } from "./cards/miniPekka";
import { SKELETON_ARMY_CARD } from "./cards/skeletonArmy";

export const STARTER_DECK: CardId[] = ["giant", "archers", "mini-pekka", "baby-dragon", "skeleton-army", "cannon", "fireball", "arrows"];

export const CARDS: Record<CardId, CardDefinition> = {
  giant: GIANT_CARD,
  archers: ARCHERS_CARD,
  "mini-pekka": MINI_PEKKA_CARD,
  "baby-dragon": BABY_DRAGON_CARD,
  "skeleton-army": SKELETON_ARMY_CARD,
  cannon: CANNON_CARD,
  fireball: FIREBALL_CARD,
  arrows: ARROWS_CARD
};

export function cardById(id: CardId): CardDefinition {
  return CARDS[id];
}
