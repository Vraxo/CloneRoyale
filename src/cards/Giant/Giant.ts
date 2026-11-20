import type { UnitDefinition } from "../../game/types";

export const GIANT: UnitDefinition = {
  identity: { type: "giant" },
  health: { hp: 1850 },
  collision: { radius: 22, mass: 100 },
  movement: { speed: 31, isAir: false },
  combat: {
    damage: 125,
    range: 27,
    attackInterval: 1.55,
    attack: {
      type: "melee"
    },
    splashRadius: 0
  },
  targeting: { canTargetAir: false, targetsBuildingsOnly: true },
  lifetime: { duration: 0 }
};
