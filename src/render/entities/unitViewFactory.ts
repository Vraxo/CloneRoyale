import type { Unit } from "../../game/types";
import type { UnitView } from "./unitView";
import { ArcherView } from "../../units/archer/view";
import { BabyDragonView } from "../../units/babyDragon/view";
import { CannonView } from "../../units/cannon/view";
import { GiantView } from "../../units/giant/view";
import { MiniPekkaView } from "../../units/miniPekka/view";
import { SkeletonView } from "../../units/skeleton/view";
type UnitViewConstructor = new (unit: Unit) => UnitView;
const UNIT_VIEWS: Record<Unit["type"], UnitViewConstructor> = {
  giant: GiantView,
  archer: ArcherView,
  "mini-pekka": MiniPekkaView,
  "baby-dragon": BabyDragonView,
  skeleton: SkeletonView,
  cannon: CannonView
};
export function createUnitView(unit: Unit): UnitView {
  const View = UNIT_VIEWS[unit.type];
  return new View(unit);
}