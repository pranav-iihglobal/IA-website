/*
 * IKSARVA service worker.
 *
 * Deliberately conservative. The site is a marketing site with an admin
 * panel behind Google sign-in, so the rules are:
 *
 *   - /admin and /api are NEVER touched. Caching an authenticated page would
 *     be a security bug, and a cached API response would show a director
 *     stale data they are about to edit.
 *   - Page navigations are network-first, falling back to the cache and then
 *     to an offline page. A farmer on a weak connection in a field should get
 *     the last version they saw rather than the browser's error page, but a
 *     good connection must never serve them stale content.
 *   - Immutable build output (/_next/static) is cache-first — those URLs are
 *     content-hashed, so a cached copy is always correct.
 *   - Images and fonts are stale-while-revalidate.
 *
 * Bump CACHE_VERSION to evict everything on the next deploy.
 */

const CACHE_VERSION = "v1";
const PAGES = `iksarva-pages-${CACHE_VERSION}`;
const ASSETS = `iksarva-assets-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const KNOWN_CACHES = [PAGES, ASSETS];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      // A failed precache must not block activation — the worker is still
      // useful without the offline page.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("iksarva-") && !KNOWN_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Anything the worker must stay out of entirely. */
function isPrivate(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/_next/image")
  );
}

function isImmutableBuildAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isAsset(request, url) {
  return (
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style" ||
    request.destination === "script" ||
    url.pathname.startsWith("/icons/")
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit ?? network;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("You are offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable, and only our own origin is ours to cache.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (isPrivate(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (isImmutableBuildAsset(url)) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }
  if (isAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(request, ASSETS));
  }
});

// Lets a new worker take over as soon as the page asks it to, instead of
// waiting for every tab to close.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
