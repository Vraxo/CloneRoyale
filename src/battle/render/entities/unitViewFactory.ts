import type { Unit } from "../../../game/types";
import { ArcherView } from "../../../cards/Archer/ArcherView";
import { BabyDragonView } from "../../cards/BabyDragon/BabyDragonView";
import { CannonView } from "../../cards/Cannon/CannonView";
import { GiantView } from "../../cards/Giant/GiantView";
import { KnightView } from "../../cards/Knight/KnightView";
import { MiniPekkaView } from "../../cards/MiniPekka/MiniPekkaView";
import { SkeletonView } from "../../cards/Skeleton/SkeletonView";
import type { UnitView } from "./unitView";

type UnitViewConstructor = new (unit: Unit) => UnitView;

const UNIT_VIEWS: Record<Unit["type"], UnitViewConstructor> = {
  giant: GiantView,
  archer: ArcherView,
  "mini-pekka": MiniPekkaView,
  "baby-dragon": BabyDragonView,
  skeleton: SkeletonView,
  cannon: CannonView,
  knight: KnightView
};

export function createUnitView(unit: Unit): UnitView {
  const View = UNIT_VIEWS[unit.type];
  return new View(unit);
}
