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

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("clone-royale-") && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
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
