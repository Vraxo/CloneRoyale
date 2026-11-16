import type { TroopCardDefinition } from "../../game/types";
import { BABY_DRAGON } from "./BabyDragon";

export const BABY_DRAGON_CARD: TroopCardDefinition = {
  id: "baby-dragon",
  name: "Baby Dragon",
  cost: 4,
  deployTime: 1,
  category: "troop",
  count: 1,
  unit: BABY_DRAGON
};
