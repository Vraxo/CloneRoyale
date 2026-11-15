import type { UnitDefinition } from "../../game/types";

export const CANNON: UnitDefinition = {
  type: "cannon",
  hp: 1050,
  damage: 78,
  speed: 0,
  range: 185,
  attackInterval: 1.05,
  attack: {
    type: "projectile",
    style: "cannon",
    speed: 430
  },
  radius: 15,
  splashRadius: 0,
  isAir: false,
  canTargetAir: false,
  targetsBuildingsOnly: false,
  lifetime: 32
};
