import { createMenuAudio } from "../audio/menuAudio";

type MenuAudio = ReturnType<typeof createMenuAudio>;

export function initializeGameMenu(menuAudio: MenuAudio): (open: boolean) => void {
  const toggle = document.getElementById("game-menu-toggle");

  function setGameMenuOpen(open: boolean): void {
    document.body.dataset.controlsOpen = open ? "true" : "false";
    toggle?.setAttribute("aria-expanded", String(open));
  }

  document.getElementById("close-game-menu")?.addEventListener("click", () => setGameMenuOpen(false));
  toggle?.addEventListener("click", () => {
    const open = document.body.dataset.controlsOpen !== "true";
    menuAudio.playTransition();
    setGameMenuOpen(open);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") setGameMenuOpen(false);
  });
  document.addEventListener("pointerdown", event => {
    if (document.body.dataset.controlsOpen !== "true" || !(event.target instanceof Element)) return;
    if (event.target.closest(".control-panel, #game-menu-toggle")) return;
    setGameMenuOpen(false);
  });

  return setGameMenuOpen;
}
