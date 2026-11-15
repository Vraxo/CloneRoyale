import type { Side } from "./Side";

export interface Projectile {
  id: number;
  side: Side;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetId: number | null;
  targetX: number;
  targetY: number;
  age: number;
  duration: number;
  damage: number;
  splashRadius: number;
  style: "arrow" | "fire" | "cannon" | "fireball" | "arrows";
}
