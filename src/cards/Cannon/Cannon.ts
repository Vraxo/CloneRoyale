import type { UnitDefinition } from "../../game/types";

export const CANNON: UnitDefinition = {
  identity: { type: "cannon" },
  health: { hp: 1050 },
  collision: { radius: 15 },
  movement: { speed: 0, isAir: false },
  combat: {
    damage: 78,
    range: 185,
    attackInterval: 1.05,
    attack: {
      type: "projectile",
      style: "cannon",
      speed: 430
    },
    splashRadius: 0
  },
  targeting: { canTargetAir: false, targetsBuildingsOnly: false },
  lifetime: { duration: 32 }
};
