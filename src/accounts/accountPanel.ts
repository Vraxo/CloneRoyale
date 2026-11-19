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
  const formElement = accountForm as HTMLFormElement;
  const usernameElement = username as HTMLInputElement;
  const passwordElement = password as HTMLInputElement;
  const submitElement = submit as HTMLButtonElement;

  function showError(message: string): void {
    if (error) error.textContent = message;
  }

  function setBusy(value: boolean): void {
    busy = value;
    submitElement.disabled = value;
    if (logoutButton instanceof HTMLButtonElement) logoutButton.disabled = value;
    if (loginTab instanceof HTMLButtonElement) loginTab.disabled = value;
    if (registerTab instanceof HTMLButtonElement) registerTab.disabled = value;
    submitElement.textContent = value ? "PLEASE WAIT…" : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT";
  }

  function render(): void {
    const authenticated = account !== null;
    formElement.hidden = authenticated;
    if (signedIn instanceof HTMLElement) signedIn.hidden = !authenticated;
    if (signedInLabel) signedInLabel.textContent = account?.username ?? "";
    if (loginTab instanceof HTMLButtonElement) loginTab.setAttribute("aria-pressed", String(mode === "login"));
    if (registerTab instanceof HTMLButtonElement) registerTab.setAttribute("aria-pressed", String(mode === "register"));
    passwordElement.autocomplete = mode === "login" ? "current-password" : "new-password";
    passwordElement.minLength = mode === "register" ? 12 : 1;
    passwordElement.placeholder = mode === "register" ? "At least 12 characters" : "Your password";
    if (helper) helper.textContent = mode === "register"
      ? "Use 3–20 letters, numbers or underscores for your username. Passwords must be at least 12 characters."
      : "Sign in with the username and password you used when creating your account.";
    submitElement.textContent = mode === "login" ? "SIGN IN" : "CREATE ACCOUNT";
  }

  function setMode(nextMode: AuthMode): void {
    if (busy || account) return;
    mode = nextMode;
    showError("");
    render();
    passwordElement.value = "";
    passwordElement.focus();
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

  formElement.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || account) return;

    const name = usernameElement.value.trim();
    const secret = passwordElement.value;
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
      passwordElement.value = "";
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
      usernameElement.value = "";
      passwordElement.value = "";
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
