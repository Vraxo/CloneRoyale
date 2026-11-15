import type { Unit } from "../../game/types";
import { ArcherView } from "../../units/Archer/ArcherView";
import { BabyDragonView } from "../../units/BabyDragon/BabyDragonView";
import { CannonView } from "../../units/Cannon/CannonView";
import { GiantView } from "../../units/Giant/GiantView";
import { MiniPekkaView } from "../../units/MiniPekka/MiniPekkaView";
import { SkeletonView } from "../../units/Skeleton/SkeletonView";
import type { UnitView } from "./unitView";

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
