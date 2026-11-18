import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const workerSource = await readFile("dist/service-worker.js", "utf8");
const cacheName = workerSource.match(/const CACHE_NAME = ("[^"]+");/)?.[1];
const precacheStart = workerSource.indexOf("const PRECACHE_URLS = ") + "const PRECACHE_URLS = ".length;
const precacheEnd = workerSource.indexOf(";", precacheStart);
assert.ok(cacheName, "Generated service worker must declare its cache name.");
assert.ok(precacheStart >= "const PRECACHE_URLS = ".length && precacheEnd > precacheStart, "Generated service worker must declare its precache list.");

const currentCacheName = JSON.parse(cacheName);
const precacheUrls = JSON.parse(workerSource.slice(precacheStart, precacheEnd));
assert.ok(precacheUrls.includes("/"), "The app shell must be included in the offline cache.");
assert.ok(precacheUrls.length > 1, "The offline cache should include built game assets.");

const origin = "https://clone-royale.test";
const cacheStore = new Map();

function cacheKey(request) {
  const value = typeof request === "string" ? request : request.url;
  return new URL(value, origin).href;
}

class MemoryCache {
  constructor() {
    this.entries = new Map();
  }

  async put(request, response) {
    this.entries.set(cacheKey(request), response.clone());
  }

  async match(request) {
    const response = this.entries.get(cacheKey(request));
    return response?.clone();
  }

  async keys() {
    return [...this.entries.keys()].map(url => new Request(url));
  }
}

const caches = {
  async open(name) {
    if (!cacheStore.has(name)) cacheStore.set(name, new MemoryCache());
    return cacheStore.get(name);
  },
  async keys() {
    return [...cacheStore.keys()];
  },
  async delete(name) {
    return cacheStore.delete(name);
  }
};

const previousCacheName = "clone-royale-previous";
const previousCache = await caches.open(previousCacheName);
const reusableAsset = precacheUrls.find(url => url.startsWith("/assets/"));
assert.ok(reusableAsset, "Build should contain at least one hashed /assets file.");
await previousCache.put(reusableAsset, new Response("previously cached immutable asset"));

const networkRequests = [];
let offline = false;
async function mockFetch(request) {
  const url = new URL(typeof request === "string" ? request : request.url, origin);
  networkRequests.push(url.pathname);
  if (offline) throw new Error("Network unavailable");
  return new Response("network:" + url.pathname, {
    status: 200,
    headers: { "content-type": url.pathname.endsWith(".js") ? "text/javascript" : "text/plain" }
  });
}

const listeners = new Map();
const self = {
  location: { origin },
  clients: {
    async matchAll() { return []; },
    async claim() {}
  },
  async skipWaiting() {},
  addEventListener(type, listener) { listeners.set(type, listener); }
};

const context = {
  self,
  caches,
  fetch: mockFetch,
  URL,
  Request,
  Response,
  Error
};
vm.runInNewContext(workerSource, context);

async function dispatch(type, event) {
  const listener = listeners.get(type);
  assert.ok(listener, "Service worker must register " + type + " handler.");
  listener(event);
  if (event.pending) await event.pending;
  if (event.response) return await event.response;
}

await dispatch("install", {
  waitUntil(promise) { this.pending = promise; }
});

const installedCache = await caches.open(currentCacheName);
const installedKeys = await installedCache.keys();
assert.equal(installedKeys.length, precacheUrls.length, "Install must cache every precache URL.");
assert.ok(!networkRequests.includes(reusableAsset), "Unchanged hashed assets must be reused from the previous cache.");
assert.ok(networkRequests.includes("/"), "The app shell must be fetched during first installation.");

await dispatch("activate", {
  waitUntil(promise) { this.pending = promise; }
});
assert.ok(!(await caches.keys()).includes(previousCacheName), "Activation must remove the previous cache.");

offline = true;
let offlineResponse;
await dispatch("fetch", {
  request: { method: "GET", url: origin + "/", mode: "navigate" },
  respondWith(promise) { this.response = promise; }
}).then(response => { offlineResponse = response; });

assert.ok(offlineResponse, "Offline navigation must return a response.");
assert.match(await offlineResponse.text(), /^network:\//, "Offline navigation must serve the cached app shell.");

console.log("Offline smoke test passed: precache, incremental asset reuse, cache cleanup, and offline app-shell fallback.");
