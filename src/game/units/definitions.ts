import type { UnitDefinition, UnitType } from "../types";
import { ARCHER } from "../../units/archer/definition";
import { BABY_DRAGON } from "../../units/babyDragon/definition";
import { CANNON } from "../../units/cannon/definition";
import { GIANT } from "../../units/giant/definition";
import { MINI_PEKKA } from "../../units/miniPekka/definition";
import { SKELETON } from "../../units/skeleton/definition";
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