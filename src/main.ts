import { initializeInstallPrompt } from "./pwa/installPrompt";
import { initializeNetworkStatus } from "./pwa/networkStatus";
import { initializeOfflineSetup } from "./pwa/offlineSetup";

initializeOfflineSetup();
initializeInstallPrompt();
initializeNetworkStatus();

const parameters = new URLSearchParams(window.location.search);
const mode = parameters.get("mode") ?? "player";

if (mode === "simulation") {
  await import("./simulationMain");
} else {
  await import("./styles/main.css");
  await import("./gameMain");
}

export {};
