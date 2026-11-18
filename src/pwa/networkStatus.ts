export function initializeNetworkStatus(): void {
  const status = document.querySelector<HTMLElement>("#network-status");
  if (!status) return;

  function updateNetworkStatus(element: HTMLElement): void {
    if (!navigator.onLine) {
      element.hidden = false;
      element.dataset.state = "offline";
      element.textContent = "NO INTERNET · SOLO PLAY AVAILABLE";
      return;
    }

    if (element.dataset.state === "offline") {
      element.hidden = true;
      element.dataset.state = "";
      element.textContent = "";
    }
  }

  const update = () => updateNetworkStatus(status as HTMLElement);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}
