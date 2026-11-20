import type { UnitDefinition } from "../../game/types";

export const MINI_PEKKA: UnitDefinition = {
  identity: { type: "mini-pekka" },
  health: { hp: 900 },
  collision: { radius: 14 },
  movement: { speed: 55, isAir: false },
  combat: {
    damage: 245,
    range: 27,
    attackInterval: 1.45,
    attack: {
      type: "melee"
    },
    splashRadius: 0
  },
  targeting: { canTargetAir: false, targetsBuildingsOnly: false },
  lifetime: { duration: 0 }
};
