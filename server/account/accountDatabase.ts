import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface AccountRecord {
  id: string;
  username: string;
  usernameKey: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: number;
}

export interface SessionRecord {
  tokenHash: string;
  accountId: string;
  createdAt: number;
  expiresAt: number;
}

export interface AccountDatabase {
  version: 1;
  accounts: AccountRecord[];
  sessions: SessionRecord[];
}

function emptyDatabase(): AccountDatabase {
  return { version: 1, accounts: [], sessions: [] };
}

function isDatabase(value: unknown): value is AccountDatabase {
  if (!value || typeof value !== "object") return false;
  const database = value as Partial<AccountDatabase>;
  return database.version === 1 && Array.isArray(database.accounts) && Array.isArray(database.sessions);
}

export function createAccountDatabase(filePath: string) {
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

  return { load, update };
}
