import type { SoundEffects } from "../audio/soundEffects";

export function bindHoldControl(
  button: HTMLButtonElement,
  action: () => void,
  canRepeat: () => boolean,
  soundEffects: SoundEffects
): void {
  const initialDelay = 300;
  const repeatInterval = 34;
  let delayTimer = 0;
  let repeatTimer = 0;
  let activePointer: number | null = null;

  function stopHolding(): void {
    window.clearTimeout(delayTimer);
    window.clearInterval(repeatTimer);
    delayTimer = 0;
    repeatTimer = 0;
    activePointer = null;
  }

  function repeatAction(): void {
    if (!canRepeat()) {
      stopHolding();
      return;
    }
    action();
  }

  button.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0 || button.disabled || activePointer !== null) return;
    event.preventDefault();
    activePointer = event.pointerId;
    button.setPointerCapture(event.pointerId);
    soundEffects.play("ui-click");
    action();
    delayTimer = window.setTimeout(() => {
      repeatTimer = window.setInterval(repeatAction, repeatInterval);
    }, initialDelay);
  });

  button.addEventListener("pointerup", (event: PointerEvent) => {
    if (event.pointerId === activePointer) stopHolding();
  });
  button.addEventListener("pointercancel", stopHolding);
  button.addEventListener("lostpointercapture", stopHolding);
  button.addEventListener("click", (event: MouseEvent) => {
    if (event.detail === 0 && !button.disabled) {
      soundEffects.play("ui-click");
      action();
    }
  });

  window.addEventListener("blur", stopHolding);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopHolding();
  });
}
