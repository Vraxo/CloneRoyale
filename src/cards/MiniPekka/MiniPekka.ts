import type { MovableUnitDefinition } from "../../game/types";

export const MINI_PEKKA: MovableUnitDefinition = {
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
  audio: {
    attack: "mini-pekka-attack",
    hit: "mini-pekka-hit",
    deploy: "mini-pekka-deploy",
    death: "mini-pekka-death",
    movement: { event: "mini-pekka-step", interval: 0.42 }
  },
};
