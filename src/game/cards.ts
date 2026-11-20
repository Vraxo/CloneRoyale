import type { CardDefinition, CardId } from "./types";
import { ARCHERS_CARD } from "../cards/Archer/ArcherCard";
import { ARROWS_CARD } from "../cards/Arrows/ArrowsCard";
import { BABY_DRAGON_CARD } from "../cards/BabyDragon/BabyDragonCard";
import { CANNON_CARD } from "../cards/Cannon/CannonCard";
import { FIREBALL_CARD } from "../cards/Fireball/FireballCard";
import { GIANT_CARD } from "../cards/Giant/GiantCard";
import { KNIGHT_CARD } from "../cards/Knight/KnightCard";
import { MINI_PEKKA_CARD } from "../cards/MiniPekka/MiniPekkaCard";
import { SKELETON_ARMY_CARD } from "../cards/Skeleton/SkeletonArmyCard";
import { ZAP_CARD } from "../cards/Zap/ZapCard";
import { ZAP_CARD } from "../cards/Zap/ZapCard";

export const STARTER_DECK: CardId[] = [
  "giant",
  "archers",
  "mini-pekka",
  "baby-dragon",
  "skeleton-army",
  "cannon",
  "fireball",
  "arrows"
];

export const CARDS: Record<CardId, CardDefinition> = {
  giant: GIANT_CARD,
  archers: ARCHERS_CARD,
  "mini-pekka": MINI_PEKKA_CARD,
  "baby-dragon": BABY_DRAGON_CARD,
  "skeleton-army": SKELETON_ARMY_CARD,
  cannon: CANNON_CARD,
  fireball: FIREBALL_CARD,
  arrows: ARROWS_CARD,
  knight: KNIGHT_CARD,
  zap: ZAP_CARD
};

export function cardById(id: CardId): CardDefinition {
  return CARDS[id];
}
