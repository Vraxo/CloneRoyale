import type { TroopCardDefinition } from "../../game/types";
import { KNIGHT } from "./Knight";

export const KNIGHT_CARD: TroopCardDefinition = {
  id: "knight",
  name: "Knight",
  cost: 3,
  deployTime: 1,
  category: "troop",
  count: 1,
  unit: KNIGHT
};
