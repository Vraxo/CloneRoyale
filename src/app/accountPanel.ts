type PublicAccount = {
  id: string;
  username: string;
  createdAt: number;
};

type AuthResponse = {
  account?: PublicAccount | null;
  error?: string;
  loggedOut?: boolean;
};

type AuthMode = "login" | "register";

export function initializeAccountPanel(): void {
  const form = document.getElementById("account-form");
  const usernameInput = document.getElementById("account-username");
  const passwordInput = document.getElementById("account-password");
  const loginTab = document.getElementById("account-login-tab");
  const registerTab = document.getElementById("account-register-tab");
  const submitButton = document.getElementById("account-submit");
  const errorLabel = document.getElementById("account-error");
  const helper = document.getElementById("account-helper");
  const signedIn = document.getElementById("account-signed-in");
  const signedInName = document.getElementById("account-signed-in-name");
  const logoutButton = document.getElementById("account-logout");
  const accountForm = form instanceof HTMLFormElement ? form : null;
  const username = usernameInput instanceof HTMLInputElement ? usernameInput : null;
  const password = passwordInput instanceof HTMLInputElement ? passwordInput : null;
  const submit = submitButton instanceof HTMLButtonElement ? submitButton : null;
  const error = errorLabel;
  const signedInLabel = signedInName;
  let mode: AuthMode = "login";
  let account: PublicAccount | null = null;
  let busy = false;

  if (!accountForm || !username || !password || !submit) return;

  function showError(message: string): void {
    if (error) error.textContent = message;
  }

  function setBusy(value: boolean): void {
    busy = value;
    submit.disabled = value;
    if (logoutButton instanceof HTMLButtonElement) logoutButton.disabled = value;
    if (loginTab instanceof HTMLButtonElement) loginTab.disabled = value;
    if (registerTab instanceof HTMLButtonElement) registerTab.disabled = value;
    submit.textContent = value ? "PLEASE WAIT…" : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT";
  }

  function render(): void {
    const authenticated = account !== null;
    accountForm.hidden = authenticated;
    if (signedIn instanceof HTMLElement) signedIn.hidden = !authenticated;
    if (signedInLabel) signedInLabel.textContent = account?.username ?? "";
    if (loginTab instanceof HTMLButtonElement) loginTab.setAttribute("aria-pressed", String(mode === "login"));
    if (registerTab instanceof HTMLButtonElement) registerTab.setAttribute("aria-pressed", String(mode === "register"));
    password.autocomplete = mode === "login" ? "current-password" : "new-password";
    password.minLength = mode === "register" ? 12 : 1;
    password.placeholder = mode === "register" ? "At least 12 characters" : "Your password";
    if (helper) helper.textContent = mode === "register"
      ? "Use 3–20 letters, numbers or underscores for your username. Passwords must be at least 12 characters."
      : "Sign in with the username and password you used when creating your account.";
    submit.textContent = mode === "login" ? "SIGN IN" : "CREATE ACCOUNT";
  }

  function setMode(nextMode: AuthMode): void {
    if (busy || account) return;
    mode = nextMode;
    showError("");
    render();
    password.value = "";
    password.focus();
  }

  async function request(path: string, body?: { username?: string; password?: string }): Promise<AuthResponse> {
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    const result = await response.json() as AuthResponse;
    if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
    return result;
  }

  async function restoreSession(): Promise<void> {
    try {
      const result = await request("/api/auth/me");
      if (!busy) {
        account = result.account ?? null;
        render();
      }
    } catch {
      if (busy) return;
      showError(navigator.onLine
        ? "Account services are unavailable right now. You can still play as a guest."
        : "You're offline. Account sign-in needs an internet connection; guest play is still available.");
    }
  }

  accountForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || account) return;

    const name = username.value.trim();
    const secret = password.value;
    if (!name || !secret) {
      showError("Enter your username and password.");
      return;
    }
    if (mode === "register") {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(name)) {
        showError("Username must be 3–20 letters, numbers or underscores.");
        return;
      }
      if (secret.length < 12) {
        showError("Choose a password with at least 12 characters.");
        return;
      }
    }

    setBusy(true);
    showError("");
    try {
      const result = await request(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        username: name,
        password: secret
      });
      account = result.account ?? null;
      if (!account) throw new Error("The server did not return an account.");
      password.value = "";
      render();
    } catch (caught) {
      showError(caught instanceof Error
        ? caught.message
        : "Unable to reach the account service. You can continue as a guest.");
    } finally {
      setBusy(false);
      render();
    }
  });

  loginTab?.addEventListener("click", () => setMode("login"));
  registerTab?.addEventListener("click", () => setMode("register"));

  logoutButton?.addEventListener("click", async () => {
    if (busy || !account) return;
    setBusy(true);
    showError("");
    try {
      await request("/api/auth/logout", {});
      account = null;
      username.value = "";
      password.value = "";
      mode = "login";
      render();
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Unable to sign out.");
    } finally {
      setBusy(false);
      render();
    }
  });

  render();
  void restoreSession();
}
