import type { BuildingCardDefinition } from "../../game/types";
import { CANNON } from "./Cannon";

export const CANNON_CARD: BuildingCardDefinition = {
  id: "cannon",
  name: "Cannon",
  cost: 3,
  category: "building",
  count: 1,
  unit: CANNON
};
