const STORAGE_KEY = "cloneroyale.resume-token";

export function readOnlineResumeToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveOnlineResumeToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Multiplayer remains usable when browser storage is unavailable.
  }
}

export function clearOnlineResumeToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The server-side session can still expire independently.
  }
}
