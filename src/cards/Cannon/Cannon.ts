import type { StationaryUnitDefinition } from "../../game/types";

export const CANNON: StationaryUnitDefinition = {
  identity: { type: "cannon" },
  health: { hp: 1050 },
  collision: { radius: 15 },
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
  audio: {
    attack: "cannon-attack",
    deploy: "cannon-deploy",
    death: "cannon-death"
  },
  lifetime: { duration: 32 }
};
