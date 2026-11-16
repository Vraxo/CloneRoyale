import type { BattleController } from "./battleController";
import { bindHoldControl } from "./holdControl";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing required element: #${id}`);
  return found as T;
}

function updateVolumeLabel(output: HTMLOutputElement, value: number): void {
  output.value = `${Math.round(value * 100)}%`;
}

export function bindBattleInput(controller: BattleController): void {
  const renderer = controller.renderer;
  const pauseButton = element<HTMLButtonElement>("pause");
  const speedButton = element<HTMLButtonElement>("speed");
  const musicVolume = element<HTMLInputElement>("music-volume");
  const soundEffectsVolume = element<HTMLInputElement>("sound-effects-volume");
  const musicVolumeValue = element<HTMLOutputElement>("music-value");
  const soundEffectsVolumeValue = element<HTMLOutputElement>("sound-effects-value");

  element<HTMLButtonElement>("new-battle").addEventListener("click", () => {
    controller.soundEffects.play("ui-click");
    controller.startNewBattle();
  });
  element<HTMLButtonElement>("play-again").addEventListener("click", () => {
    controller.soundEffects.play("ui-click");
    controller.startNewBattle();
  });
  pauseButton.addEventListener("click", () => {
    controller.soundEffects.play("ui-click");
    controller.togglePaused();
  });

  const canvas = renderer.app.canvas;
  canvas.addEventListener("pointermove", (event) => controller.updatePlacementPreview(event));
  canvas.addEventListener("pointerleave", () => controller.clearPointerPreview());
  canvas.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0) return;
    const handIndex = renderer.handCardAt(event.clientX, event.clientY, controller.currentSelectedCard);
    if (handIndex !== null) {
      const cardId = controller.state.sides.blue.hand[handIndex];
      if (cardId) controller.selectCard(cardId);
      controller.clearPointerPreview();
      return;
    }
    controller.playSelectedCardAt(event.clientX, event.clientY);
  });

  bindHoldControl(
    element<HTMLButtonElement>("step"),
    () => controller.stepForward(),
    () => !controller.isGameOver,
    controller.soundEffects
  );
  bindHoldControl(
    element<HTMLButtonElement>("step-back"),
    () => controller.stepBackward(),
    () => controller.canStepBack,
    controller.soundEffects
  );

  speedButton.addEventListener("click", () => {
    controller.soundEffects.play("ui-click");
    const speeds = [0.5, 1, 2, 4, 8];
    const current = Number.parseFloat(speedButton.textContent ?? "1");
    const currentIndex = speeds.indexOf(current);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    speedButton.textContent = `${nextSpeed}×`;
    controller.setSpeed(nextSpeed);
  });

  soundEffectsVolume.addEventListener("input", () => {
    const volume = Number(soundEffectsVolume.value);
    controller.soundEffects.unlock();
    controller.soundEffects.setVolume(volume);
    updateVolumeLabel(soundEffectsVolumeValue, volume);
  });
  musicVolume.addEventListener("input", () => {
    const volume = Number(musicVolume.value);
    controller.music.setVolume(volume);
    updateVolumeLabel(musicVolumeValue, volume);
  });
}
