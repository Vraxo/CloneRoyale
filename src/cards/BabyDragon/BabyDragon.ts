import type { UnitDefinition } from "../../game/types";

export const BABY_DRAGON: UnitDefinition = {
  type: "baby-dragon",
  hp: 850,
  damage: 88,
  speed: 43,
  range: 125,
  attackInterval: 1.4,
  attack: {
    type: "projectile",
    style: "fire",
    speed: 290
  },
  radius: 17,
  splashRadius: 42,
  isAir: true,
  canTargetAir: true,
  targetsBuildingsOnly: false,
  lifetime: 0
};
