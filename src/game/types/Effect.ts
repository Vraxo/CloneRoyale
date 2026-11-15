export interface Effect {
  id: number;
  x: number;
  y: number;
  age: number;
  lifetime: number;
  radius: number;
  style: "hit" | "explosion" | "arrows";
}
