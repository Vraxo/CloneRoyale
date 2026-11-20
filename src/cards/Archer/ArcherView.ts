import type { DeepReadonly, Unit } from "../../game/types";
import { HumanoidUnitView } from "../../battle/render/entities/units/humanoidUnitView";

export class ArcherView extends HumanoidUnitView {
  public constructor(unit: DeepReadonly<Unit>) {
    super(unit, "archer");
  }
}
