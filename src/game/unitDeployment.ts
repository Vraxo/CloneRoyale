import type { GameState, Unit } from "./types";

type DeployingUnit = Pick<Unit, "deployment" | "audio" | "transform" | "collision" | "side">;
type DeploymentState = Pick<GameState, "nextId" | "effects" | "audioEvents">;

export function updateUnitDeployment(
  state: DeploymentState,
  unit: DeployingUnit,
  dt: number
): boolean {
  const appearanceDelay = unit.deployment.appearanceDelay;
  if (appearanceDelay > 0) {
    const remaining = Math.max(0, appearanceDelay - dt);
    unit.deployment.appearanceDelay = remaining;
    if (remaining <= 0) {
      if (unit.audio?.deploy) state.audioEvents.push(unit.audio.deploy);

      state.effects.push({
        id: state.nextId++,
        x: unit.transform.x,
        y: unit.transform.y,
        age: 0,
        lifetime: 0.62,
        radius: Math.max(22, unit.collision.radius * 2.2),
        style: "deployment",
        side: unit.side
      });
    }

    return true;
  }

  const remaining = unit.deployment.remaining;
  if (remaining <= 0) return false;

  unit.deployment.remaining = Math.max(0, remaining - dt);
  return true;
}
