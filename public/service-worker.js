const CACHE_VERSION = "__BUILD_DATE__";
const CACHE_NAME = `fy-app-cache-${CACHE_VERSION}`;
const TIME_TRACKING_API_PATTERN = /\/recruitment\/time-tracking/;

// IndexedDB helpers for queueing API requests
const DB_NAME = "fy-offline-db";
const STORE_NAME = "api-queue";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "timestamp" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function addToQueue(item) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).add(item);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  });
}

function getQueue() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });
  });
}

function clearQueue() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  });
}

function notifyClientsQueueLength(length) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: "pendingActionsCount", count: length });
    });
  });
}

function isHtmlRequest(request) {
  if (request.mode === "navigate") {
    return true;
  }
  const accept = request.headers.get("accept") || "";
  return request.method === "GET" && accept.includes("text/html");
}

function isHashedStaticAsset(pathname) {
  return /\/static\/(js|css|media)\/.+\.[a-f0-9]{8,}\.(js|css|woff2?|png|jpe?g|gif|svg|webp)$/i.test(
    pathname
  );
}

async function networkFirstNoCache(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

function queueApiRequest(request) {
  request
    .clone()
    .json()
    .then((body) => {
      addToQueue({
        url: request.url,
        method: request.method,
        body,
        headers: [...request.headers],
        timestamp: Date.now(),
      }).then(() => {
        getQueue().then((queue) => notifyClientsQueueLength(queue.length));
      });
    });
}

async function syncApiQueue() {
  const queue = await getQueue();
  if (queue.length > 0) {
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: "processQueuedActions",
          actions: queue,
        });
      });
    });
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await syncApiQueue();
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    TIME_TRACKING_API_PATTERN.test(url.href) &&
    (request.method === "POST" || request.method === "PUT")
  ) {
    if (!self.navigator.onLine) {
      event.respondWith(
        (async () => {
          queueApiRequest(request);
          return new Response(
            JSON.stringify({
              status: "pending",
              message: "Request queued for sync when online.",
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        })()
      );
    }
    return;
  }

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname === "/meta.json" || url.pathname === "/service-worker.js") {
    event.respondWith(fetch(request));
    return;
  }

  if (isHtmlRequest(request) || url.pathname === "/" || url.pathname === "/index.html") {
    event.respondWith(networkFirstNoCache(request));
    return;
  }

  if (isHashedStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-api-queue") {
    event.waitUntil(syncApiQueue());
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "syncApiQueue") {
    syncApiQueue();
  } else if (event.data === "getPendingCount") {
    getQueue().then((queue) => notifyClientsQueueLength(queue.length));
  } else if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data && event.data.type === "queueApiRequest") {
    const action = event.data.action;
    if (action.type === "clockIn") {
      const requestData = {
        type: "clockIn",
        data: action.data,
        timestamp: action.timestamp || Date.now(),
      };
      addToQueue(requestData).then(() => {
        getQueue().then((queue) => notifyClientsQueueLength(queue.length));
      });
    } else if (action.type === "clockOut") {
      const requestData = {
        type: "clockOut",
        data: action.data,
        timestamp: action.timestamp || Date.now(),
      };
      addToQueue(requestData).then(() => {
        getQueue().then((queue) => notifyClientsQueueLength(queue.length));
      });
    }
  } else if (event.data && event.data.type === "clearQueueAndAddFailed") {
    clearQueue().then(() => {
      const failedActions = event.data.failedActions || [];
      const promises = failedActions.map((action) => addToQueue(action));
      Promise.all(promises).then(() => {
        getQueue().then((queue) => notifyClientsQueueLength(queue.length));
      });
    });
  } else if (event.data && event.data.type === "clearQueue") {
    clearQueue().then(() => {
      notifyClientsQueueLength(0);
    });
  }
});
