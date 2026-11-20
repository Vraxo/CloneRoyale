import type { AudioEvent, TroopUnit } from "./types";

type MovementAudioUnit = Pick<TroopUnit, "movement" | "audio">;

export function updateMovementAudio(
  unit: MovementAudioUnit,
  audioEvents: AudioEvent[],
  dt: number
): void {
  const movementSound = unit.audio?.movement;
  if (!movementSound) return;

  if (unit.movement.isMoving) {
    unit.movement.footstepCooldown = (unit.movement.footstepCooldown ?? 0) - dt;
    if (unit.movement.footstepCooldown <= 0) {
      audioEvents.push(movementSound.event);
      unit.movement.footstepCooldown = movementSound.interval;
    }
  } else {
    unit.movement.footstepCooldown = Math.min(unit.movement.footstepCooldown ?? 0.12, 0.12);
  }
}
