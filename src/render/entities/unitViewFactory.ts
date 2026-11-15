import type { Unit } from "../../game/types";
import type { UnitView } from "./unitView";
import { ArcherView } from "./units/archerView";
import { BabyDragonView } from "./units/babyDragonView";
import { CannonView } from "./units/cannonView";
import { GiantView } from "./units/giantView";
import { MiniPekkaView } from "./units/miniPekkaView";
import { SkeletonView } from "./units/skeletonView";

export function createUnitView(unit: Unit): UnitView {
  switch (unit.type) {
    case "skeleton":
      return new SkeletonView(unit);
    case "giant":
      return new GiantView(unit);
    case "archer":
      return new ArcherView(unit);
    case "mini-pekka":
      return new MiniPekkaView(unit);
    case "baby-dragon":
      return new BabyDragonView(unit);
    case "cannon":
      return new CannonView(unit);
  }
}
