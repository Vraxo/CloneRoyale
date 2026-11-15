import type { CardDefinition } from "../../game/types";
import { ARCHER } from "./Archer";

export const ARCHERS_CARD: CardDefinition = {
  id: "archers",
  name: "Archers",
  cost: 3,
  category: "troop",
  count: 2,
  unit: ARCHER
};
