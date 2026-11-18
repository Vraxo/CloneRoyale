interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

export function initializeInstallPrompt(): void {
  const installButton = document.querySelector<HTMLButtonElement>("#install-game");
  const helpPanel = document.querySelector<HTMLElement>("#install-help");
  const closeButton = document.querySelector<HTMLButtonElement>("#close-install-help");
  if (!installButton) return;

  const isIosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandaloneApp = window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;

  let deferredPrompt: InstallPromptEvent | null = null;
  let previousFocus: HTMLElement | null = null;

  function closeHelp(): void {
    if (!helpPanel) return;
    helpPanel.hidden = true;
    previousFocus?.focus();
    previousFocus = null;
  }

  function openHelp(): void {
    if (!helpPanel) return;
    previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : installButton;
    helpPanel.hidden = false;
    closeButton?.focus();
  }

  if (isIosDevice && !isStandaloneApp) {
    installButton.hidden = false;
    installButton.innerHTML = '<span aria-hidden="true">＋</span> ADD TO HOME SCREEN';
    installButton.addEventListener("click", openHelp);
  }

  closeButton?.addEventListener("click", closeHelp);
  helpPanel?.addEventListener("click", event => {
    if (event.target === helpPanel) closeHelp();
  });
  helpPanel?.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeHelp();
    }
  });

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    if (!isIosDevice && !isStandaloneApp) installButton.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installButton.hidden = true;
    closeHelp();
  });

  if (!isIosDevice) {
    installButton.addEventListener("click", async () => {
      if (!deferredPrompt) return;

      const prompt = deferredPrompt;
      deferredPrompt = null;
      installButton.hidden = true;

      try {
        await prompt.prompt();
        await prompt.userChoice;
      } catch {
        // Installation prompts can be rejected by the browser; avoid an unhandled rejection.
      }
    });
  }
}
