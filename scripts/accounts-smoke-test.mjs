import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAccountStore } from "../dist-server/services.js";

const directory = await mkdtemp(join(tmpdir(), "clone-royale-accounts-"));
try {
  const databasePath = join(directory, "accounts.json");
  const store = createAccountStore(databasePath);

  await assert.rejects(store.createAccount("ab", "a sufficiently long password"), /Username/);
  await assert.rejects(store.createAccount("ValidUser", "short"), /Password/);

  const account = await store.createAccount("Knight_Main", "correct horse battery staple");
  assert.match(account.id, /^[0-9a-f-]{36}$/);
  assert.equal(account.username, "Knight_Main");
  assert.equal(await store.authenticate("knight_main", "correct horse battery staple") instanceof Object, true);
  assert.equal(await store.authenticate("Knight_Main", "incorrect password"), null);
  await assert.rejects(store.createAccount("KNIGHT_MAIN", "another sufficiently long password"), /already taken/);

  const session = await store.createSession(account.id);
  assert.equal(session.token.length, 43, "Session tokens should contain 256 bits of random data.");
  assert.equal((await store.resolveSession(session.token))?.id, account.id);
  assert.equal(await store.resolveSession("not-a-session-token"), null);

  const persisted = JSON.parse(await readFile(databasePath, "utf8"));
  assert.equal(persisted.accounts.length, 1);
  assert.equal(persisted.sessions.length, 1);
  assert.equal(persisted.accounts[0].passwordHash.includes("correct horse"), false);
  assert.equal(persisted.sessions[0].tokenHash.includes(session.token), false);

  const restartedStore = createAccountStore(databasePath);
  assert.equal((await restartedStore.authenticate("KNIGHT_MAIN", "correct horse battery staple"))?.id, account.id);
  assert.equal((await restartedStore.resolveSession(session.token))?.id, account.id);
  assert.equal(await restartedStore.revokeSession(session.token), true);
  assert.equal(await restartedStore.resolveSession(session.token), null);
  assert.equal(await restartedStore.revokeSession(session.token), false);

  const expiring = await restartedStore.createSession(account.id);
  const removed = await restartedStore.pruneExpiredSessions(expiring.expiresAt + 1);
  assert.equal(removed, 1);
  assert.equal(await restartedStore.resolveSession(expiring.token), null);

  const concurrent = await Promise.all([
    restartedStore.createAccount("ConcurrentOne", "another sufficiently long password"),
    restartedStore.createAccount("ConcurrentTwo", "another sufficiently long password")
  ]);
  assert.equal(new Set(concurrent.map(item => item.id)).size, 2);

  console.log("Account foundation tests passed: validation, case-insensitive usernames, password hashing, authentication, persistence, session creation, lookup, revocation, expiry, and concurrent writes.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
