import type { UnitDefinition } from "../../game/types";

export const SKELETON: UnitDefinition = {
  identity: { type: "skeleton" },
  health: { hp: 115 },
  collision: { radius: 7, mass: 0.5 },
  movement: { speed: 67, isAir: false },
  combat: {
    damage: 54,
    range: 21,
    attackInterval: 1.05,
    attack: {
      type: "melee"
    },
    splashRadius: 0
  },
  targeting: { canTargetAir: false, targetsBuildingsOnly: false },
  lifetime: { duration: 0 }
};
