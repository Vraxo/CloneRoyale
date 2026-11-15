import type { Unit } from "../../../game/types";
import { HumanoidUnitView } from "./humanoidUnitView";

export class MiniPekkaView extends HumanoidUnitView {
  public constructor(unit: Unit) {
    super(unit, "mini-pekka");
  }
}
