export function initializeNetworkStatus(): void {
  const networkStatus = document.querySelector<HTMLElement>("#network-status");
  if (!networkStatus) return;

  function update(): void {
    if (!navigator.onLine) {
      networkStatus.hidden = false;
      networkStatus.dataset.state = "offline";
      networkStatus.textContent = "NO INTERNET · SOLO PLAY AVAILABLE";
      return;
    }

    if (networkStatus.dataset.state === "offline") {
      networkStatus.hidden = true;
      networkStatus.dataset.state = "";
      networkStatus.textContent = "";
    }
  }

  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}
