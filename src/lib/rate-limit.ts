type RateLimitStore = Map<string, { count: number; expiresAt: number }>;

const store: RateLimitStore = new Map();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (record.expiresAt < now) {
      store.delete(key);
    }
  }
}, 60000);

export function checkRateLimit(
  identifier: string,
  limit: number = 60, // 60 requests per window
  windowMs: number = 60000 // 1 minute window
): { success: boolean; remaining: number } {
  const now = Date.now();
  const record = store.get(identifier);

  if (!record || record.expiresAt < now) {
    store.set(identifier, {
      count: 1,
      expiresAt: now + windowMs,
    });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  record.count += 1;
  return { success: true, remaining: limit - record.count };
}
