import type { CardDefinition, CardId } from "./types";
import { ARCHERS_CARD } from "../units/Archer/ArcherCard";
import { ARROWS_CARD } from "../cards/Arrows/ArrowsCard";
import { BABY_DRAGON_CARD } from "../units/BabyDragon/BabyDragonCard";
import { CANNON_CARD } from "../units/Cannon/CannonCard";
import { FIREBALL_CARD } from "../cards/Fireball/FireballCard";
import { GIANT_CARD } from "../units/Giant/GiantCard";
import { MINI_PEKKA_CARD } from "../units/MiniPekka/MiniPekkaCard";
import { SKELETON_ARMY_CARD } from "../units/Skeleton/SkeletonArmyCard";

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
  arrows: ARROWS_CARD
};

export function cardById(id: CardId): CardDefinition {
  return CARDS[id];
}
