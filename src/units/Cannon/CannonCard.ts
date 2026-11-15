import type { CardDefinition } from "../../game/types";
import { CANNON } from "./Cannon";

export const CANNON_CARD: CardDefinition = {
  id: "cannon",
  name: "Cannon",
  cost: 3,
  category: "building",
  count: 1,
  unit: CANNON
};
