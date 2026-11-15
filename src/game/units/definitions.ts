import type { UnitDefinition, UnitType } from "../types";
import { ARCHER } from "../../units/Archer/Archer";
import { BABY_DRAGON } from "../../units/BabyDragon/BabyDragon";
import { CANNON } from "../../units/Cannon/Cannon";
import { GIANT } from "../../units/Giant/Giant";
import { MINI_PEKKA } from "../../units/MiniPekka/MiniPekka";
import { SKELETON } from "../../units/Skeleton/Skeleton";

export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  giant: GIANT,
  archer: ARCHER,
  "mini-pekka": MINI_PEKKA,
  "baby-dragon": BABY_DRAGON,
  skeleton: SKELETON,
  cannon: CANNON
};

export function unitDefinition(type: UnitType): UnitDefinition {
  return UNIT_DEFINITIONS[type];
}
