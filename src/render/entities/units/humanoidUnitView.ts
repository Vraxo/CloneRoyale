import type { Unit } from "../../../game/types";
import { SkeletalRig, type HumanoidStyle } from "../../animation/skeletalRig";
import { UnitView } from "../unitView";

export class HumanoidUnitView extends UnitView {
  private readonly rig: SkeletalRig;

  public constructor(unit: Unit, style: HumanoidStyle) {
    super(unit);
    this.rig = new SkeletalRig(style);
    this.body.addChild(this.rig.container);
  }

  public update(unit: Unit, time: number): void {
    this.updateCommon(unit, time);
    this.rig.update(unit, time);
  }
}
