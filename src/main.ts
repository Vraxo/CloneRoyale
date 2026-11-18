if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
}

const parameters = new URLSearchParams(window.location.search);
const mode = parameters.get("mode") ?? "player";

if (mode === "simulation") {
  await import("./simulationMain");
} else {
  await import("./style.css");
  await import("./gameMain");
}

export {};
