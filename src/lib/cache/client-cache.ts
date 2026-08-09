const cacheMap = new Map<string, { data: any; timestamp: number }>();
const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds cache duration

/**
 * Fetch data with client-side in-memory caching.
 * If data exists in cache and hasn't expired, returns cached data instantly without hitting the server/DB.
 */
export async function fetchWithCache(url: string, ttlMs: number = DEFAULT_TTL_MS): Promise<any> {
  const cached = cacheMap.get(url);
  const now = Date.now();

  // Return cached result if still fresh
  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data;
  }

  // Fetch fresh data
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();

  if (res.ok) {
    cacheMap.set(url, { data, timestamp: now });
  }

  return data;
}

/**
 * Clear cached data for specific endpoints or all cache when data is modified (created/updated/deleted).
 */
export function invalidateCache(urlSubstring?: string) {
  if (!urlSubstring) {
    cacheMap.clear();
    return;
  }
  for (const key of cacheMap.keys()) {
    if (key.includes(urlSubstring)) {
      cacheMap.delete(key);
    }
  }
}
