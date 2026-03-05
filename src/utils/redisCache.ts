import { getRedisClient } from './redisClient';

const DEFAULT_TTL_SECONDS = 60;

/**
 * Get a value from Redis cache. Returns null if missing or on error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedisClient();
    const raw = await redis.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    return null;
  }
}

/**
 * Set a value in Redis cache with optional TTL in seconds.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<void> {
  try {
    const redis = await getRedisClient();
    const serialized = JSON.stringify(value);
    await redis.setEx(key, ttlSeconds, serialized);
  } catch (err) {
    // Cache miss is acceptable; don't fail the request
  }
}

/**
 * Cache key prefix for app data (avoids collisions with token blacklist etc.)
 */
export const CACHE_PREFIX = 'cache:';

export function cacheKey(parts: string[]): string {
  return CACHE_PREFIX + parts.join(':');
}
