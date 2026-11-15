import type { CardDefinition } from "../../game/types";
import { SKELETON } from "./Skeleton";

export const SKELETON_ARMY_CARD: CardDefinition = {
  id: "skeleton-army",
  name: "Skeleton Army",
  cost: 3,
  category: "troop",
  count: 15,
  unit: SKELETON
};
