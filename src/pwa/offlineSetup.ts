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
    return { type: value.type, message: typeof value.message === "string" ? value.message : undefined };
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
  const saveButton = document.querySelector<HTMLButtonElement>("#offline-save");
  const closeButton = document.querySelector<HTMLButtonElement>("#offline-continue");

  if (!saveButton) return;

  function show(): void {
    setup?.classList.remove("is-hidden");
    setup?.classList.add("is-visible");
    closeButton?.focus();
  }

  function hide(): void {
    setup?.classList.remove("is-visible");
    setup?.classList.add("is-hidden");
    saveButton.focus();
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
    if (status) status.textContent = "Saved on this device. You can now launch the game without an internet connection for solo play.";
    updateProgress(1, 1);
    saveButton.textContent = "✓ OFFLINE READY";
    saveButton.disabled = true;
    window.setTimeout(hide, 1200);
  }

  function showError(message: string): void {
    show();
    if (status) status.textContent = "The game remains fully playable online. Offline saving can be tried again later.";
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    openButton.disabled = false;
  }

  closeButton?.addEventListener("click", hide);
  setup?.addEventListener("click", event => {
    if (event.target === setup) hide();
  });
  setup?.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
    }
  });

  if (!("serviceWorker" in navigator)) return;
  saveButton.hidden = false;

  let registration: ServiceWorkerRegistration | null = null;
  let preparationStarted = false;

  navigator.serviceWorker.addEventListener("message", event => {
    const message = parsePrecacheMessage(event.data);
    if (!message) return;
    switch (message.type) {
      case "PRECACHE_PROGRESS":
        show();
        updateProgress(message.completed, message.total);
        if (status) status.textContent = "Saving game files for offline solo play. You can close this window and keep playing online.";
        break;
      case "PRECACHE_COMPLETE":
        markReady();
        break;
      case "PRECACHE_ERROR":
        showError(message.message ?? "Some files could not be saved. Check your connection and try again.");
        break;
      case "PRECACHE_STATUS":
        if (message.ready) {
          openButton.textContent = "✓ OFFLINE READY";
          openButton.disabled = true;
        }
        break;
    }
  });

  navigator.serviceWorker.register("/service-worker.js")
    .then(async value => {
      registration = value;
      await navigator.serviceWorker.ready;
      const worker = registration.active ?? navigator.serviceWorker.controller;
      worker?.postMessage({ type: "GET_PRECACHE_STATUS" });
    })
    .catch(() => {
      // Registration is optional; the game itself continues to work online.
      openButton.hidden = true;
    });

  saveButton.addEventListener("click", async () => {
    if (openButton.disabled) return;
    show();
    if (error) error.hidden = true;
    if (preparationStarted) return;
    preparationStarted = true;
    openButton.disabled = true;
    if (status) status.textContent = "Connecting to offline storage…";

    try {
      registration ??= await navigator.serviceWorker.getRegistration("/");
      await navigator.serviceWorker.ready;
      const worker = registration?.active ?? navigator.serviceWorker.controller;
      if (!worker) throw new Error("Offline storage is not available in this browser.");
      worker.postMessage({ type: "PREPARE_OFFLINE" });
    } catch (cause) {
      preparationStarted = false;
      showError(cause instanceof Error ? cause.message : "Offline preparation is unavailable.");
    }
  });
}
