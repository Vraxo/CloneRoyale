import type { Unit } from "../../game/types";
import { HumanoidUnitView } from "../../battle/render/entities/units/humanoidUnitView";

export class SkeletonView extends HumanoidUnitView {
  public constructor(unit: Unit) {
    super(unit, "skeleton");
  }
}
