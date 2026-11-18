import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const PASSWORD_BYTES = 64;
const SCRYPT_OPTIONS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

interface AccountRecord {
  id: string;
  username: string;
  usernameKey: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: number;
}

interface SessionRecord {
  tokenHash: string;
  accountId: string;
  createdAt: number;
  expiresAt: number;
}

interface AccountDatabase {
  version: 1;
  accounts: AccountRecord[];
  sessions: SessionRecord[];
}

export interface PublicAccount {
  id: string;
  username: string;
  createdAt: number;
}

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolveKey, reject) => {
    scryptCallback(password, salt, PASSWORD_BYTES, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolveKey(key as Buffer);
    });
  });
}

function publicAccount(account: AccountRecord): PublicAccount {
  return { id: account.id, username: account.username, createdAt: account.createdAt };
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function emptyDatabase(): AccountDatabase {
  return { version: 1, accounts: [], sessions: [] };
}

function isDatabase(value: unknown): value is AccountDatabase {
  if (!value || typeof value !== "object") return false;
  const database = value as Partial<AccountDatabase>;
  return database.version === 1 && Array.isArray(database.accounts) && Array.isArray(database.sessions);
}

export function createAccountStore(filePath: string) {
  const path = resolve(filePath);
  let writeQueue: Promise<void> = Promise.resolve();

  async function load(): Promise<AccountDatabase> {
    try {
      const value: unknown = JSON.parse(await readFile(path, "utf8"));
      if (!isDatabase(value)) throw new Error("Account database has an unsupported or invalid format.");
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyDatabase();
      throw error;
    }
  }

  async function save(database: AccountDatabase): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = path + "." + randomBytes(8).toString("hex") + ".tmp";
    await writeFile(temporary, JSON.stringify(database), { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  }

  function update<T>(operation: (database: AccountDatabase) => Promise<T> | T): Promise<T> {
    const pending = writeQueue.then(async () => {
      const database = await load();
      const result = await operation(database);
      await save(database);
      return result;
    });
    writeQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async function createAccount(usernameInput: string, password: string): Promise<PublicAccount> {
    const username = typeof usernameInput === "string" ? usernameInput.trim() : "";
    if (!USERNAME_PATTERN.test(username)) {
      throw new Error("Username must be 3–20 characters and contain only letters, numbers, or underscores.");
    }
    if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 1024) {
      throw new Error("Password must be at least 12 characters and no more than 1024 bytes.");
    }

    const salt = randomBytes(16);
    const passwordHash = await derivePassword(password, salt);
    return update(database => {
      const usernameKey = username.toLowerCase();
      if (database.accounts.some(account => account.usernameKey === usernameKey)) {
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
      database.accounts.push(account);
      return publicAccount(account);
    });
  }

  async function authenticate(usernameInput: string, password: string): Promise<PublicAccount | null> {
    const usernameKey = typeof usernameInput === "string" ? usernameInput.trim().toLowerCase() : "";
    const database = await load();
    const account = database.accounts.find(candidate => candidate.usernameKey === usernameKey);
    const salt = account ? Buffer.from(account.passwordSalt, "hex") : Buffer.alloc(16);
    const expected = account ? Buffer.from(account.passwordHash, "hex") : Buffer.alloc(PASSWORD_BYTES);
    const supplied = await derivePassword(typeof password === "string" ? password : "", salt);
    const valid = expected.length === supplied.length && timingSafeEqual(expected, supplied);
    return account && valid ? publicAccount(account) : null;
  }

  async function createSession(accountId: string): Promise<{ token: string; expiresAt: number }> {
    const token = randomBytes(32).toString("base64url");
    const createdAt = Date.now();
    const expiresAt = createdAt + SESSION_LIFETIME_MS;
    await update(database => {
      if (!database.accounts.some(account => account.id === accountId)) {
        throw new Error("Account not found.");
      }
      database.sessions = database.sessions.filter(session => session.expiresAt > createdAt);
      database.sessions.push({ tokenHash: tokenHash(token), accountId, createdAt, expiresAt });
    });
    return { token, expiresAt };
  }

  async function resolveSession(token: string): Promise<PublicAccount | null> {
    if (typeof token !== "string" || token.length < 32 || token.length > 128) return null;
    const hash = tokenHash(token);
    const database = await load();
    const session = database.sessions.find(candidate => candidate.tokenHash === hash && candidate.expiresAt > Date.now());
    if (!session) return null;
    const account = database.accounts.find(candidate => candidate.id === session.accountId);
    return account ? publicAccount(account) : null;
  }

  async function revokeSession(token: string): Promise<boolean> {
    if (typeof token !== "string" || token.length < 32 || token.length > 128) return false;
    const hash = tokenHash(token);
    return update(database => {
      const before = database.sessions.length;
      database.sessions = database.sessions.filter(session => session.tokenHash !== hash);
      return database.sessions.length !== before;
    });
  }

  async function pruneExpiredSessions(now = Date.now()): Promise<number> {
    return update(database => {
      const before = database.sessions.length;
      database.sessions = database.sessions.filter(session => session.expiresAt > now);
      return before - database.sessions.length;
    });
  }

  return { createAccount, authenticate, createSession, resolveSession, revokeSession, pruneExpiredSessions };
}
