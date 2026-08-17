/**
 * Server-Side In-Memory TTL Cache
 * 
 * Caches expensive DB query results server-side for a configurable TTL.
 * This is shared across ALL incoming requests (unlike client-cache which is per-browser).
 * 
 * Key benefit: When 50+ students hit the app simultaneously,
 * the mentor dashboard only fires DB queries ONCE per TTL window,
 * not once per concurrent request.
 */

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

/**
 * Get data from cache. Returns null if missing or expired.
 */
export function getCached(key: string): any | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Set data in cache with a TTL in milliseconds.
 */
export function setCached(key: string, data: any, ttlMs: number): void {
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Invalidate all cache keys that contain the given substring.
 * Call this after any write (attendance marked, class updated, etc.)
 */
export function invalidateServerCache(keySubstring?: string): void {
  if (!keySubstring) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.includes(keySubstring)) {
      store.delete(key);
    }
  }
}

/**
 * Helper: get from cache or run the fetcher and cache the result.
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = getCached(key);
  if (cached !== null) return cached as T;

  const data = await fetcher();
  setCached(key, data, ttlMs);
  return data;
}
