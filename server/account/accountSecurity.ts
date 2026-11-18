import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const PASSWORD_BYTES = 64;
const SCRYPT_OPTIONS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function createPasswordSalt(): Buffer {
  return randomBytes(16);
}

export function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolveKey, reject) => {
    scryptCallback(password, salt, PASSWORD_BYTES, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolveKey(key as Buffer);
    });
  });
}

export function verifyPassword(passwordHash: string, passwordSalt: string, password: string): Promise<boolean> {
  const salt = Buffer.from(passwordSalt, "hex");
  const expected = Buffer.from(passwordHash, "hex");
  return derivePassword(password, salt).then(supplied =>
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
