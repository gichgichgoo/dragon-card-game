const CACHE_NAME = "dragon-duel-pwa-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./css/style.css",
  "./js/main.js",
  "./js/game.js",
  "./js/ui.js",
  "./js/cards.js",
  "./js/effects.js",
  "./js/deck.js",
  "./js/combat.js",
  "./js/enemyDecks.js",
  "./js/enemyAI.js",
  "./assets/dragons/dragon.webp",
  "./assets/dragons/whelp.webp",
  "./assets/dragons/mirror.webp",
  "./assets/dragons/shell.webp",
  "./assets/dragons/life.webp",
  "./assets/dragons/thunder.webp"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html", { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
