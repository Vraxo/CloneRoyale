import { randomUUID } from "node:crypto";
import { createAccountDatabase } from "./accountDatabase.js";
import type { AccountRecord } from "./accountDatabase.js";
import {
  createPasswordSalt,
  createSessionToken,
  derivePassword,
  hashSessionToken,
  verifyPassword
} from "./accountSecurity.js";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export interface PublicAccount {
  id: string;
  username: string;
  createdAt: number;
}

function publicAccount(account: AccountRecord): PublicAccount {
  return { id: account.id, username: account.username, createdAt: account.createdAt };
}

export function createAccountStore(filePath: string) {
  const database = createAccountDatabase(filePath);

  async function createAccount(usernameInput: string, password: string): Promise<PublicAccount> {
    const username = typeof usernameInput === "string" ? usernameInput.trim() : "";
    if (!USERNAME_PATTERN.test(username)) {
      throw new Error("Username must be 3–20 characters and contain only letters, numbers, or underscores.");
    }
    if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 1024) {
      throw new Error("Password must be at least 12 characters and no more than 1024 bytes.");
    }

    const salt = createPasswordSalt();
    const passwordHash = await derivePassword(password, salt);
    return database.update(records => {
      const usernameKey = username.toLowerCase();
      if (records.accounts.some(account => account.usernameKey === usernameKey)) {
        throw new Error("That username is already taken.");
      }
      const account: AccountRecord = {
        id: randomUUID(),
        username,
        usernameKey,
        passwordSalt: salt.toString("hex"),
        passwordHash: passwordHash.toString("hex"),
        createdAt: Date.now()
      };
      records.accounts.push(account);
      return publicAccount(account);
    });
  }

  async function authenticate(usernameInput: string, password: string): Promise<PublicAccount | null> {
    const usernameKey = typeof usernameInput === "string" ? usernameInput.trim().toLowerCase() : "";
    const records = await database.load();
    const account = records.accounts.find(candidate => candidate.usernameKey === usernameKey);
    const salt = account?.passwordSalt ?? Buffer.alloc(16).toString("hex");
    const hash = account?.passwordHash ?? Buffer.alloc(64).toString("hex");
    const valid = await verifyPassword(hash, salt, typeof password === "string" ? password : "");
    return account && valid ? publicAccount(account) : null;
  }

  async function createSession(accountId: string): Promise<{ token: string; expiresAt: number }> {
    const token = createSessionToken();
    const createdAt = Date.now();
    const expiresAt = createdAt + SESSION_LIFETIME_MS;
    await database.update(records => {
      if (!records.accounts.some(account => account.id === accountId)) {
        throw new Error("Account not found.");
      }
      records.sessions = records.sessions.filter(session => session.expiresAt > createdAt);
      records.sessions.push({ tokenHash: hashSessionToken(token), accountId, createdAt, expiresAt });
    });
    return { token, expiresAt };
  }

  async function resolveSession(token: string): Promise<PublicAccount | null> {
    if (typeof token !== "string" || token.length < 32 || token.length > 128) return null;
    const hash = hashSessionToken(token);
    const records = await database.load();
    const session = records.sessions.find(candidate => candidate.tokenHash === hash && candidate.expiresAt > Date.now());
    if (!session) return null;
    const account = records.accounts.find(candidate => candidate.id === session.accountId);
    return account ? publicAccount(account) : null;
  }

  async function revokeSession(token: string): Promise<boolean> {
    if (typeof token !== "string" || token.length < 32 || token.length > 128) return false;
    const hash = hashSessionToken(token);
    return database.update(records => {
      const before = records.sessions.length;
      records.sessions = records.sessions.filter(session => session.tokenHash !== hash);
      return records.sessions.length !== before;
    });
  }

  async function pruneExpiredSessions(now = Date.now()): Promise<number> {
    return database.update(records => {
      const before = records.sessions.length;
      records.sessions = records.sessions.filter(session => session.expiresAt > now);
      return before - records.sessions.length;
    });
  }

  return { createAccount, authenticate, createSession, resolveSession, revokeSession, pruneExpiredSessions };
}
