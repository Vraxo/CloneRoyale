import type { TroopCardDefinition } from "../../game/types";
import { ARCHER } from "./Archer";

export const ARCHERS_CARD: TroopCardDefinition = {
  id: "archers",
  name: "Archers",
  cost: 3,
  deployTime: 1,
  category: "troop",
  count: 2,
  unit: ARCHER
};
