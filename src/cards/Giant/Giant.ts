import type { UnitDefinition } from "../../game/types";

export const GIANT: UnitDefinition = {
  type: "giant",
  hp: 1850,
  damage: 125,
  speed: 31,
  range: 27,
  attackInterval: 1.55,
  attack: {
    type: "melee"
  },
  radius: 22,
  collisionMass: 100,
  splashRadius: 0,
  isAir: false,
  canTargetAir: false,
  targetsBuildingsOnly: true,
  lifetime: 0
};
