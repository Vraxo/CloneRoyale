import type { UnitDefinition } from "../../game/types";

export const KNIGHT: UnitDefinition = {
  type: "knight",
  hp: 1120,
  damage: 112,
  speed: 43,
  range: 25,
  attackInterval: 1.15,
  attack: {
    type: "melee"
  },
  radius: 14,
  collisionMass: 38,
  splashRadius: 0,
  isAir: false,
  canTargetAir: false,
  targetsBuildingsOnly: false,
  lifetime: 0
};
