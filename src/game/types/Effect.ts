import type { Side } from "./Side";

export interface Effect {
  id: number;
  x: number;
  y: number;
  age: number;
  lifetime: number;
  radius: number;
  style: "hit" | "explosion" | "fireball" | "arrows" | "deployment";
  side?: Side;
}
