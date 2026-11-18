type Account = { id: string; username: string; createdAt: number };

type AuthResponse = { account?: Account | null; error?: string; loggedOut?: boolean };

export function initializeAccountPanel(): void {
  const panel = document.getElementById("account-panel");
  const openButton = document.getElementById("account-open");
  const closeButton = document.getElementById("account-close");
  const title = document.getElementById("account-title");
  const description = document.getElementById("account-description");
  const form = document.getElementById("account-form");
  const username = document.getElementById("account-username");
  const password = document.getElementById("account-password");
  const submit = document.getElementById("account-submit");
  const switchButton = document.getElementById("account-switch");
  const error = document.getElementById("account-error");
  const signedIn = document.getElementById("account-signed-in");
  const signedInName = document.getElementById("account-signed-in-name");
  const logout = document.getElementById("account-logout");
  const status = document.getElementById("account-status");

  if (!(panel instanceof HTMLDivElement) || !(form instanceof HTMLFormElement)
    || !(username instanceof HTMLInputElement) || !(password instanceof HTMLInputElement)
    || !(submit instanceof HTMLButtonElement) || !(switchButton instanceof HTMLButtonElement)
    || !(title instanceof HTMLElement) || !(description instanceof HTMLElement)
    || !(error instanceof HTMLElement) || !(signedIn instanceof HTMLElement)
    || !(signedInName instanceof HTMLElement) || !(logout instanceof HTMLButtonElement)
    || !(status instanceof HTMLElement)) return;

  let mode: "login" | "register" = "login";
  let account: Account | null = null;
  let busy = false;

  function setBusy(value: boolean): void {
    busy = value;
    submit.disabled = value;
    switchButton.disabled = value;
    logout.disabled = value;
    submit.textContent = value ? "PLEASE WAIT…" : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT";
  }

  function render(): void {
    const authenticated = account !== null;
    form.hidden = authenticated;
    signedIn.hidden = !authenticated;
    title.textContent = authenticated ? "You're signed in" : mode === "login" ? "Welcome back" : "Create your account";
    description.textContent = authenticated
      ? "Your account is ready. You can keep playing as a guest on other devices until profile linking is added."
      : mode === "login"
        ? "Sign in to your Clone Royale account. Guest play remains available."
        : "Choose a username and password. Your account is stored securely on the game host.";
    switchButton.textContent = mode === "login" ? "CREATE AN ACCOUNT" : "I ALREADY HAVE AN ACCOUNT";
    signedInName.textContent = account?.username ?? "";
    status.textContent = authenticated ? "ACCOUNT CONNECTED" : "GUEST PLAY IS ALWAYS AVAILABLE";
    if (!busy) submit.textContent = mode === "login" ? "SIGN IN" : "CREATE ACCOUNT";
    if (authenticated) {
      openButton?.setAttribute("aria-label", "Account: " + account?.username);
      openButton?.classList.add("is-authenticated");
    } else {
      openButton?.setAttribute("aria-label", "Sign in or create an account");
      openButton?.classList.remove("is-authenticated");
    }
  }

  function open(): void {
    panel.hidden = false;
    error.textContent = "";
    render();
    if (!account) username.focus();
    else closeButton?.focus();
  }

  function close(): void {
    panel.hidden = true;
    error.textContent = "";
  }

  async function refresh(): Promise<void> {
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Could not check your account session.");
      const result = await response.json() as AuthResponse;
      account = result.account ?? null;
    } catch {
      account = null;
      status.textContent = "ACCOUNT STATUS UNAVAILABLE";
    }
    render();
  }

  openButton?.addEventListener("click", open);
  closeButton?.addEventListener("click", close);
  panel.addEventListener("click", event => {
    if (event.target === panel) close();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) close();
  });

  switchButton.addEventListener("click", () => {
    if (busy) return;
    mode = mode === "login" ? "register" : "login";
    error.textContent = "";
    password.value = "";
    render();
    username.focus();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    error.textContent = "";
    const name = username.value.trim();
    const secret = password.value;
    if (!name || !secret) {
      error.textContent = "Enter both your username and password.";
      return;
    }
    if (mode === "register" && secret.length < 12) {
      error.textContent = "Your password must be at least 12 characters.";
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/" + (mode === "login" ? "login" : "register"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: name, password: secret })
      });
      const result = await response.json() as AuthResponse;
      if (!response.ok || !result.account) throw new Error(result.error ?? "Unable to sign in.");
      account = result.account;
      password.value = "";
      render();
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : "Something went wrong. Try again.";
    } finally {
      setBusy(false);
      render();
    }
  });

  logout.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin"
      });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      account = null;
      mode = "login";
      password.value = "";
      error.textContent = "";
      render();
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : "Could not sign out.";
    } finally {
      setBusy(false);
      render();
    }
  });

  render();
  void refresh();
}
