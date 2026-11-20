import type { UnitDefinition } from "../../game/types";

export const BABY_DRAGON: UnitDefinition = {
  identity: { type: "baby-dragon" },
  health: { hp: 850 },
  collision: { radius: 17 },
  movement: { speed: 43, isAir: true },
  combat: {
    damage: 88,
    range: 125,
    attackInterval: 1.4,
    attack: {
      type: "projectile",
      style: "fire",
      speed: 290
    },
    splashRadius: 42
  },
  targeting: { canTargetAir: true, targetsBuildingsOnly: false },
  audio: {
    attack: "baby-dragon-attack",
    deploy: "baby-dragon-deploy",
    death: "baby-dragon-death",
    movement: { event: "baby-dragon-wing", interval: 0.58 }
  },
  lifetime: { duration: 0 }
};
