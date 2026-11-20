import type { MovableUnitDefinition } from "../../game/types";

export const KNIGHT: MovableUnitDefinition = {
  identity: { type: "knight" },
  health: { hp: 1120 },
  collision: { radius: 14, mass: 38 },
  movement: { speed: 43, isAir: false },
  combat: {
    damage: 112,
    range: 25,
    attackInterval: 1.15,
    attack: {
      type: "melee"
    },
    splashRadius: 0
  },
  targeting: { canTargetAir: false, targetsBuildingsOnly: false },
  audio: {},
  lifetime: { duration: 0 }
};
