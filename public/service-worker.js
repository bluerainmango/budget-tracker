const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/styles.css",
  "/index.js",
  "/indexedDB.js",
  "/service-worker.js",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

//! Cache storage names(static files / data)
const CACHE_NAME = "static-cache-v1";
const DATA_CACHE_NAME = "data-cache-v1";

//! 1. Add static files to cache when intalling
// Install?: init cache and add files for offline
self.addEventListener("install", function(e) {
  // waitUntil: service worker will be installed after the below code is executed and finished.
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("⛑ The static files were pre-cached successfully!");
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

//! 2. Delete old cache when activating
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(keyList => {
      // caches: CacheStorage {}
      // keyList: ["static-cache-v1", "data-cache-v1"]

      return Promise.all(
        keyList.map(key => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            console.log("🧹 Removing old cache data", key);
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

//! 3. Get data and static file from server or cache when fetching
self.addEventListener("fetch", function(e) {
  // 1. Bring API data from cache or server
  if (e.request.url.includes("/api/")) {
    e.respondWith(
      caches
        .open(DATA_CACHE_NAME)
        .then(cache => {
          return fetch(e.request)
            .then(response => {
              //* Online: clone the response and store it in the cache.
              if (response.status === 200 && e.request.method === "GET") {
                cache.put(e.request.url, response.clone());
              }

              return response;
            })
            .catch(err => {
              //* Offline: try to get the data from the saved cache.
              if (e.request.method === "GET") {
                return cache.match(e.request.url);
              }
            });
        })
        .catch(err => console.log(err))
    );

    return;
  }

  // 2. Bring static files from cache or server
  e.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(e.request).then(response => {
        return response || fetch(e.request);
      });
    })
  );
});
