type PrecacheMessage =
  | { type: "PRECACHE_PROGRESS"; completed: number; total: number }
  | { type: "PRECACHE_COMPLETE" }
  | { type: "PRECACHE_ERROR"; message?: string }
  | { type: "PRECACHE_STATUS"; ready: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePrecacheMessage(value: unknown): PrecacheMessage | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;

  if (value.type === "PRECACHE_PROGRESS"
    && typeof value.completed === "number"
    && Number.isFinite(value.completed)
    && typeof value.total === "number"
    && Number.isFinite(value.total)) {
    return { type: value.type, completed: value.completed, total: value.total };
  }

  if (value.type === "PRECACHE_COMPLETE") return { type: value.type };

  if (value.type === "PRECACHE_ERROR") {
    return {
      type: value.type,
      message: typeof value.message === "string" ? value.message : undefined
    };
  }

  if (value.type === "PRECACHE_STATUS" && typeof value.ready === "boolean") {
    return { type: value.type, ready: value.ready };
  }

  return null;
}

export function initializeOfflineSetup(): void {
  const setup = document.querySelector<HTMLElement>("#offline-setup");
  const status = document.querySelector<HTMLElement>("#offline-setup-status");
  const progress = document.querySelector<HTMLElement>("#offline-progress");
  const progressFill = document.querySelector<HTMLElement>("#offline-progress-fill");
  const progressPercent = document.querySelector<HTMLElement>("#offline-progress-percent");
  const progressCount = document.querySelector<HTMLElement>("#offline-progress-count");
  const error = document.querySelector<HTMLElement>("#offline-setup-error");
  const continueButton = document.querySelector<HTMLButtonElement>("#offline-continue");

  function show(): void {
    setup?.classList.remove("is-hidden");
    setup?.classList.add("is-visible");
  }

  function hide(): void {
    setup?.classList.remove("is-visible");
    setup?.classList.add("is-hidden");
  }

  function updateProgress(completed: number, total: number): void {
    const safeTotal = Math.max(1, total);
    const safeCompleted = Math.min(safeTotal, Math.max(0, completed));
    const percent = Math.round((safeCompleted / safeTotal) * 100);

    progress?.setAttribute("aria-valuenow", String(percent));
    if (progressFill) progressFill.style.width = percent + "%";
    if (progressPercent) progressPercent.textContent = percent + "%";
    if (progressCount) progressCount.textContent = safeCompleted + " of " + safeTotal + " files";
  }

  function markReady(): void {
    if (status) status.textContent = "Everything is saved on this device. You're ready to play.";
    updateProgress(1, 1);
    window.setTimeout(hide, 650);
  }

  function showError(message: string): void {
    show();
    if (status) status.textContent = "The game can still be played online.";
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    if (continueButton) continueButton.hidden = false;
  }

  continueButton?.addEventListener("click", hide);

  if (!("serviceWorker" in navigator)) {
    hide();
    return;
  }

  navigator.serviceWorker.addEventListener("message", event => {
    const message = parsePrecacheMessage(event.data);
    if (!message) return;

    switch (message.type) {
      case "PRECACHE_PROGRESS":
        show();
        updateProgress(message.completed, message.total);
        if (status) {
          status.textContent = "Saving the game files. Unchanged files are reused when the game updates.";
        }
        break;
      case "PRECACHE_COMPLETE":
        markReady();
        break;
      case "PRECACHE_ERROR":
        showError(message.message ?? "Some files could not be saved. Check your connection and try again.");
        break;
      case "PRECACHE_STATUS":
        if (message.ready) markReady();
        break;
    }
  });

  navigator.serviceWorker.register("/service-worker.js")
    .then(async registration => {
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      worker?.postMessage({ type: "GET_PRECACHE_STATUS" });
      await navigator.serviceWorker.ready;
      navigator.serviceWorker.controller?.postMessage({ type: "GET_PRECACHE_STATUS" });
    })
    .catch(() => {
      showError("Automatic offline setup is unavailable in this browser. You can still play while connected.");
    });
}
