import type { Unit } from "../../game/types";
import { HumanoidUnitView } from "../../render/entities/units/humanoidUnitView";

export class KnightView extends HumanoidUnitView {
  public constructor(unit: Unit) {
    super(unit, "knight");
  }
}
