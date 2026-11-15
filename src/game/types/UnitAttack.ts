export type ProjectileAttackStyle = "arrow" | "fire" | "cannon";

export type UnitAttack =
  | {
      type: "melee";
    }
  | {
      type: "projectile";
      style: ProjectileAttackStyle;
      speed: number;
    };
