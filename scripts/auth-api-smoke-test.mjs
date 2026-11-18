import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a test port.");
  await new Promise(resolve => server.close(resolve));
  return address.port;
}

const directory = await mkdtemp(join(tmpdir(), "clone-royale-auth-api-"));
const port = await unusedPort();
const server = spawn(process.execPath, ["dist-server/index.js"], {
  env: {
    ...process.env,
    PORT: String(port),
    CLONEROYALE_ACCOUNT_FILE: join(directory, "accounts.json"),
    CLONEROYALE_REPLAY_DIR: join(directory, "replays")
  },
  stdio: ["ignore", "pipe", "pipe"]
});
let output = "";
server.stdout.on("data", chunk => { output += chunk.toString(); });
server.stderr.on("data", chunk => { output += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Server exited before becoming ready: " + output);
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/healthz");
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Server did not become ready: " + output);
}

async function request(path, options = {}) {
  return fetch("http://127.0.0.1:" + port + path, options);
}

try {
  await waitForServer();

  const anonymous = await request("/api/auth/me");
  assert.equal(anonymous.status, 200);
  assert.deepEqual(await anonymous.json(), { account: null });

  const invalid = await request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "ab", password: "short" })
  });
  assert.equal(invalid.status, 400);

  const registration = await request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "TestKnight", password: "correct horse battery staple" })
  });
  assert.equal(registration.status, 201);
  const { account } = await registration.json();
  assert.match(account.id, /^[0-9a-f-]{36}$/);
  assert.equal(account.username, "TestKnight");
  const cookie = registration.headers.get("set-cookie");
  assert.ok(cookie?.includes("clone_royale_session="));
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
  assert.ok(cookie.includes("SameSite=Lax"));
  const sessionCookie = cookie.split(";")[0];

  const current = await request("/api/auth/me", { headers: { cookie: sessionCookie } });
  assert.deepEqual((await current.json()).account, account);

  const duplicate = await request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "testknight", password: "another long enough password" })
  });
  assert.equal(duplicate.status, 409);

  const wrongPassword = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "TestKnight", password: "not the password" })
  });
  assert.equal(wrongPassword.status, 401);

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "testknight", password: "correct horse battery staple" })
  });
  assert.equal(login.status, 200);
  const loginCookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await (await request("/api/auth/me", { headers: { cookie: loginCookie } })).json()).account.id, account.id);

  const logout = await request("/api/auth/logout", { method: "POST", headers: { cookie: loginCookie } });
  assert.equal(logout.status, 200);
  assert.deepEqual(await logout.json(), { loggedOut: true });
  assert.deepEqual((await (await request("/api/auth/me", { headers: { cookie: loginCookie } })).json()).account, null);

  assert.equal(server.exitCode, null);
  console.log("Authentication API tests passed: guest access, registration, cookie sessions, current account, duplicate rejection, password verification, login, and logout.");
} finally {
  server.kill("SIGTERM");
  await new Promise(resolve => {
    if (server.exitCode !== null) resolve();
    else {
      server.once("exit", resolve);
      setTimeout(() => { server.kill("SIGKILL"); resolve(); }, 3000);
    }
  });
  await rm(directory, { recursive: true, force: true });
}
