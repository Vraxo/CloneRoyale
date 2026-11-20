import type { UnitDefinition } from "../../game/types";

export const ARCHER: UnitDefinition = {
  identity: { type: "archer" },
  health: { hp: 285 },
  collision: { radius: 10 },
  movement: { speed: 48, isAir: false },
  combat: {
    damage: 48,
    range: 155,
    attackInterval: 1.15,
    attack: {
      type: "projectile",
      style: "arrow",
      speed: 430
    },
    splashRadius: 0
  },
  targeting: { canTargetAir: true, targetsBuildingsOnly: false },
  audio: {
    attack: "archer-attack",
    deploy: "archer-deploy",
    death: "archer-death",
    movement: { event: "archer-step", interval: 0.48 }
  },
  lifetime: { duration: 0 }
};
