import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const outputDirectory = resolve("dist");
const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(absolutePath);
    } else if (entry.isFile() && entry.name !== "service-worker.js") {
      const path = "/" + relative(outputDirectory, absolutePath).split(sep).join("/");
      const content = await readFile(absolutePath);
      files.push({ path, content });
    }
  }
}

await collect(outputDirectory);
files.sort((left, right) => left.path.localeCompare(right.path));

const revision = createHash("sha256");
for (const file of files) {
  revision.update(file.path);
  revision.update(file.content);
}
const cacheName = "clone-royale-" + revision.digest("hex").slice(0, 12);
const urls = ["/", ...files.map(file => file.path)];

const worker = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${JSON.stringify(urls)};

async function notifyClients(message) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) client.postMessage(message);
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    let completed = 0;
    await notifyClients({ type: "PRECACHE_PROGRESS", completed, total: PRECACHE_URLS.length });

    try {
      for (const url of PRECACHE_URLS) {
        const response = await fetch(url, { cache: "reload" });
        if (!response.ok) throw new Error("Could not download " + url + " (" + response.status + ").");
        await cache.put(url, response);
        completed += 1;
        await notifyClients({ type: "PRECACHE_PROGRESS", completed, total: PRECACHE_URLS.length });
      }
      await notifyClients({ type: "PRECACHE_COMPLETE" });
      await self.skipWaiting();
    } catch (error) {
      await caches.delete(CACHE_NAME);
      await notifyClients({
        type: "PRECACHE_ERROR",
        message: error instanceof Error ? error.message : "A game file could not be downloaded."
      });
      throw error;
    }
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("clone-royale-") && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
    await notifyClients({ type: "PRECACHE_COMPLETE" });
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type !== "GET_PRECACHE_STATUS") return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const ready = keys.length >= PRECACHE_URLS.length;
    event.source?.postMessage({
      type: "PRECACHE_STATUS",
      ready,
      completed: keys.length,
      total: PRECACHE_URLS.length
    });
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    try {
      return await fetch(request);
    } catch (error) {
      if (request.mode === "navigate") {
        const appShell = await cache.match("/");
        if (appShell) return appShell;
      }
      throw error;
    }
  })());
});
`;

await writeFile(join(outputDirectory, "service-worker.js"), worker);
console.log("Generated offline cache for " + files.length + " client files (" + cacheName + ").");
