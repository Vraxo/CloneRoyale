import type { TroopCardDefinition } from "../../game/types";
import { GIANT } from "./Giant";

export const GIANT_CARD: TroopCardDefinition = {
  id: "giant",
  name: "Giant",
  cost: 5,
  category: "troop",
  count: 1,
  unit: GIANT
};
