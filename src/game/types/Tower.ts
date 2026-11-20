import type { Lane } from "./Lane";
import type { Side } from "./Side";

export interface Tower {
  id: number;
  side: Side;
  kind: "princess" | "king";
  lane: Lane | "center";
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  damage: number;
  range: number;
  attackInterval: number;
  attackCooldown: number;
  stunRemaining?: number;
  activated?: boolean;
}
