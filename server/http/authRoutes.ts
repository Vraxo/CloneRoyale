import type { IncomingMessage, ServerResponse } from "node:http";
import type { createAccountStore } from "../accounts.js";
import { readJsonBody, sendJson } from "./httpUtils.js";

type AccountStore = ReturnType<typeof createAccountStore>;

interface AuthRouteOptions {
  accountStore: AccountStore;
}

interface AuthAttempt {
  count: number;
  resetAt: number;
}

const SESSION_COOKIE = "clone_royale_session";
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_ATTEMPT_LIMIT = 10;

function readSessionCookie(request: IncomingMessage): string {
  const cookies = request.headers.cookie?.split(";") ?? [];

  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;

    const name = cookie.slice(0, separator).trim();
    if (name === SESSION_COOKIE) {
      return cookie.slice(separator + 1).trim();
    }
  }

  return "";
}

function createSessionCookie(token: string, maxAge: number): string {
  return [
    SESSION_COOKIE + "=" + token,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=" + maxAge
  ].join("; ");
}

function createAuthRateLimiter() {
  const attempts = new Map<string, AuthAttempt>();

  return function allowAttempt(
    request: IncomingMessage,
    response: ServerResponse
  ): boolean {
    const now = Date.now();
    const address = request.socket.remoteAddress ?? "unknown";
    let attempt = attempts.get(address);

    if (!attempt || attempt.resetAt <= now) {
      attempt = {
        count: 0,
        resetAt: now + AUTH_WINDOW_MS
      };
      attempts.set(address, attempt);
    }

    if (attempt.count >= AUTH_ATTEMPT_LIMIT) {
      const retryAfter = Math.max(
        1,
        Math.ceil((attempt.resetAt - now) / 1000)
      );

      sendJson(
        response,
        429,
        { error: "Too many authentication attempts. Please try again later." },
        { "retry-after": String(retryAfter) }
      );
      return false;
    }

    attempt.count += 1;

    if (attempts.size > 5000) {
      for (const [key, value] of attempts) {
        if (value.resetAt <= now) {
          attempts.delete(key);
        }
      }
    }

    return true;
  };
}

export function createAuthRoutes(options: AuthRouteOptions) {
  const { accountStore } = options;
  const allowAttempt = createAuthRateLimiter();

  return async function handleAuthRoute(
    request: IncomingMessage,
    response: ServerResponse,
    pathname: string
  ): Promise<boolean> {
    if (!pathname.startsWith("/api/auth/")) {
      return false;
    }

    if (pathname === "/api/auth/me" && request.method === "GET") {
      const account = await accountStore.resolveSession(readSessionCookie(request));
      sendJson(response, 200, { account });
      return true;
    }

    if (pathname === "/api/auth/logout" && request.method === "POST") {
      const token = readSessionCookie(request);

      if (token) {
        await accountStore.revokeSession(token);
      }

      sendJson(
        response,
        200,
        { loggedOut: true },
        { "set-cookie": createSessionCookie("", 0) }
      );
      return true;
    }

    const isRegistration = pathname === "/api/auth/register";
    const isLogin = pathname === "/api/auth/login";

    if ((!isRegistration && !isLogin) || request.method !== "POST") {
      sendJson(response, 404, { error: "Not found." });
      return true;
    }

    if (!allowAttempt(request, response)) {
      return true;
    }

    let body: Record<string, unknown>;

    try {
      body = await readJsonBody(request, 2048);
    } catch {
      sendJson(response, 400, { error: "Invalid JSON request." });
      return true;
    }

    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";

    try {
      const account = isRegistration
        ? await accountStore.createAccount(username, password)
        : await accountStore.authenticate(username, password);

      if (!account) {
        sendJson(response, 401, { error: "Incorrect username or password." });
        return true;
      }

      const session = await accountStore.createSession(account.id);
      const maxAge = Math.max(
        0,
        Math.floor((session.expiresAt - Date.now()) / 1000)
      );

      sendJson(
        response,
        isRegistration ? 201 : 200,
        { account },
        { "set-cookie": createSessionCookie(session.token, maxAge) }
      );
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Unable to create account.";
      const isDuplicate = message.includes("already taken");

      sendJson(response, isDuplicate ? 409 : 400, { error: message });
    }

    return true;
  };
}
