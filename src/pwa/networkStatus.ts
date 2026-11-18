export function initializeNetworkStatus(): void {
  const status = document.querySelector<HTMLElement>("#network-status");
  if (!status) return;

  function update(): void {
    if (!navigator.onLine) {
      status.hidden = false;
      status.dataset.state = "offline";
      status.textContent = "NO INTERNET · SOLO PLAY AVAILABLE";
      return;
    }

    if (status.dataset.state === "offline") {
      status.hidden = true;
      status.dataset.state = "";
      status.textContent = "";
    }
  }

  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}
