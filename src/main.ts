const offlineSetup = document.querySelector<HTMLElement>("#offline-setup");
const offlineStatus = document.querySelector<HTMLElement>("#offline-setup-status");
const offlineProgress = document.querySelector<HTMLElement>("#offline-progress");
const offlineProgressFill = document.querySelector<HTMLElement>("#offline-progress-fill");
const offlineProgressPercent = document.querySelector<HTMLElement>("#offline-progress-percent");
const offlineProgressCount = document.querySelector<HTMLElement>("#offline-progress-count");
const offlineError = document.querySelector<HTMLElement>("#offline-setup-error");
const offlineContinue = document.querySelector<HTMLButtonElement>("#offline-continue");

function showOfflineSetup(): void {
  offlineSetup?.classList.remove("is-hidden");
  offlineSetup?.classList.add("is-visible");
}

function hideOfflineSetup(): void {
  offlineSetup?.classList.remove("is-visible");
  offlineSetup?.classList.add("is-hidden");
}

function updateOfflineProgress(completed: number, total: number): void {
  const safeTotal = Math.max(1, total);
  const safeCompleted = Math.min(safeTotal, Math.max(0, completed));
  const percent = Math.round((safeCompleted / safeTotal) * 100);

  if (offlineProgress) offlineProgress.setAttribute("aria-valuenow", String(percent));
  if (offlineProgressFill) offlineProgressFill.style.width = percent + "%";
  if (offlineProgressPercent) offlineProgressPercent.textContent = percent + "%";
  if (offlineProgressCount) offlineProgressCount.textContent = safeCompleted + " of " + safeTotal + " files";
}

function markOfflineReady(): void {
  if (offlineStatus) offlineStatus.textContent = "Everything is saved on this device. You're ready to play.";
  updateOfflineProgress(1, 1);
  window.setTimeout(hideOfflineSetup, 650);
}

function showOfflineError(message: string): void {
  showOfflineSetup();
  if (offlineStatus) offlineStatus.textContent = "The game can still be played online.";
  if (offlineError) {
    offlineError.textContent = message;
    offlineError.hidden = false;
  }
  if (offlineContinue) offlineContinue.hidden = false;
}

offlineContinue?.addEventListener("click", hideOfflineSetup);

if (!("serviceWorker" in navigator)) {
  hideOfflineSetup();
} else {
  navigator.serviceWorker.addEventListener("message", event => {
    const data = event.data as { type?: string; completed?: number; total?: number; message?: string; ready?: boolean } | null;
    if (!data) return;

    if (data.type === "PRECACHE_PROGRESS" && typeof data.completed === "number" && typeof data.total === "number") {
      showOfflineSetup();
      updateOfflineProgress(data.completed, data.total);
      if (offlineStatus) offlineStatus.textContent = "Saving the game files. Unchanged files are reused when the game updates.";
    } else if (data.type === "PRECACHE_COMPLETE") {
      markOfflineReady();
    } else if (data.type === "PRECACHE_ERROR") {
      showOfflineError(data.message ?? "Some files could not be saved. Check your connection and try again.");
    } else if (data.type === "PRECACHE_STATUS" && data.ready === true) {
      markOfflineReady();
    }
  });

  navigator.serviceWorker.register("/service-worker.js")
    .then(async registration => {
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      worker?.postMessage({ type: "GET_PRECACHE_STATUS" });
      await navigator.serviceWorker.ready;
      navigator.serviceWorker.controller?.postMessage({ type: "GET_PRECACHE_STATUS" });
    })
    .catch(() => showOfflineError("Automatic offline setup is unavailable in this browser. You can still play while connected."));
}


const installButton = document.querySelector<HTMLButtonElement>("#install-game");
const networkStatus = document.querySelector<HTMLElement>("#network-status");
const installHelp = document.querySelector<HTMLElement>("#install-help");
const closeInstallHelp = document.querySelector<HTMLButtonElement>("#close-install-help");
const isIosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandaloneApp = window.matchMedia("(display-mode: standalone)").matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

if (isIosDevice && !isStandaloneApp && installButton) {
  installButton.hidden = false;
  installButton.innerHTML = '<span aria-hidden="true">＋</span> ADD TO HOME SCREEN';
}

function closeInstallHelpPanel(): void {
  if (installHelp) installHelp.hidden = true;
}
closeInstallHelp?.addEventListener("click", closeInstallHelpPanel);
installHelp?.addEventListener("click", event => {
  if (event.target === installHelp) closeInstallHelpPanel();
});
let deferredInstallPrompt: { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> } | null = null;

function updateNetworkStatus(): void {
  if (networkStatus) networkStatus.hidden = navigator.onLine;
}

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);
updateNetworkStatus();

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  if (installButton) installButton.hidden = false;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (installButton) installButton.hidden = true;
});

installButton?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  installButton.hidden = true;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  if (choice.outcome === "dismissed" && deferredInstallPrompt === null) {
    // The browser may dispatch beforeinstallprompt again if installation remains available.
  }
});

const parameters = new URLSearchParams(window.location.search);
const mode = parameters.get("mode") ?? "player";

if (mode === "simulation") {
  await import("./simulationMain");
} else {
  await import("./style.css");
  await import("./gameMain");
}

export {};
