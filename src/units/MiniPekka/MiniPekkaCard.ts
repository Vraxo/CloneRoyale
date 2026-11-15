import type { TroopCardDefinition } from "../../game/types";
import { MINI_PEKKA } from "./MiniPekka";

export const MINI_PEKKA_CARD: TroopCardDefinition = {
  id: "mini-pekka",
  name: "Mini P.E.K.K.A",
  cost: 4,
  deployTime: 1,
  category: "troop",
  count: 1,
  unit: MINI_PEKKA
};
