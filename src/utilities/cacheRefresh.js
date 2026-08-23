const CHUNK_RELOAD_KEY = "vihanga_chunk_reload_attempt";

export async function clearAllCaches() {
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }
}

export async function clearCachesAndReload() {
  await clearAllCaches();

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.unregister();
      }
    } catch (e) {
      // ignore
    }
  }

  window.location.reload();
}

export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch (e) {
    // ignore
  }
}

function isChunkLoadError(error) {
  const message = error?.message || String(error || "");
  return /Loading chunk [\d]+ failed|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    message
  );
}

export function setupChunkLoadRecovery() {
  const handleChunkFailure = async () => {
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        return;
      }
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    } catch (e) {
      // ignore
    }
    await clearCachesAndReload();
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault();
      handleChunkFailure();
    }
  });

  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error || event.message)) {
      handleChunkFailure();
    }
  });

  clearChunkReloadFlag();
}
