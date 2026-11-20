import type { DeepReadonly, Unit } from "../../../../game/types";
import { SkeletalRig, type HumanoidStyle } from "../../animation/skeletalRig";
import { UnitView } from "../unitView";

export class HumanoidUnitView extends UnitView {
  private readonly rig: SkeletalRig;

  public constructor(unit: DeepReadonly<Unit>, style: HumanoidStyle) {
    super(unit);
    this.rig = new SkeletalRig(style);
    this.body.addChild(this.rig.container);
  }

  public update(unit: DeepReadonly<Unit>, time: number): void {
    this.updateCommon(unit, time);
    this.rig.update(unit, time);
  }
}
