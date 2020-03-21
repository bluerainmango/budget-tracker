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

// Names to store for offline(static, data)
const CACHE_NAME = "static-cache-v1";
const DATA_CACHE_NAME = "data-cache-v1";

// Add cashes when intalling
self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Your files were pre-cached successfully!");
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

// Delete old cache when activating
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(keyList => {
      console.log("🍓", caches, keyList); // CacheStorage {}, ["static-cache-v1", "data-cache-v1"]

      return Promise.all(
        keyList.map(key => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            console.log("Removing old cache data", key);
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// Get data and static file from backend server or cache when fetching
self.addEventListener("fetch", function(e) {
  // 1. get data
  if (e.request.url.includes("/api/")) {
    e.respondWith(
      caches
        .open(DATA_CACHE_NAME)
        .then(cache => {
          return fetch(e.request)
            .then(response => {
              // Network reqeust succeeded, clone the response and store it in the cache.
              if (response.status === 200) {
                cache.put(e.request.url, response.clone());
              }

              return response;
            })
            .catch(err => {
              // Network request failed, try to get it from the cache.
              return cache.match(e.request);
            });
        })
        .catch(err => console.log(err))
    );

    return;
  }

  // 2. Get static files from cache or backend server
  e.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(e.request).then(response => {
        return response || fetch(e.request);
      });
    })
  );
});
