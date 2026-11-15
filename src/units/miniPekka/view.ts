import type { Unit } from "../../game/types";
import { HumanoidUnitView } from "../../render/entities/units/humanoidUnitView";
export class MiniPekkaView extends HumanoidUnitView {
  public constructor(unit: Unit) { super(unit, "mini-pekka"); }
}