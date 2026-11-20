import type { DeepReadonly, Unit } from "../../game/types";
import { HumanoidUnitView } from "../../battle/render/entities/units/humanoidUnitView";

export class KnightView extends HumanoidUnitView {
  public constructor(unit: DeepReadonly<Unit>) {
    super(unit, "knight");
  }
}
