import crypto from 'crypto';
import { getRedisClient } from '../../utils/redisClient';

const REDIS_KEY_PREFIX = 'token:blacklist:';

/**
 * Derive a stable key from a token for blacklist storage (SHA-256 hash).
 * Callers can pass the raw JWT; we never store the token itself.
 */
export function tokenId(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Revoke a token by adding it to the Redis blacklist with the given TTL (seconds).
 * After TTL the key expires; typically use access token TTL so revoked tokens
 * are rejected until they would have expired anyway.
 */
export async function revokeToken(token: string, ttlSeconds: number): Promise<void> {
  if (!token || ttlSeconds <= 0) return;
  try {
    const redis = await getRedisClient();
    const key = REDIS_KEY_PREFIX + tokenId(token);
    await redis.setEx(key, ttlSeconds, '1');
  } catch (err) {
    console.error('Token blacklist revoke error:', err);
    // Don't throw: logout should still succeed if Redis is down
  }
}

/**
 * Check whether a token has been revoked (e.g. after logout).
 * Returns true if revoked, false if not in blacklist or Redis error (fail open for availability).
 */
export async function isTokenRevoked(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const redis = await getRedisClient();
    const key = REDIS_KEY_PREFIX + tokenId(token);
    const value = await redis.get(key);
    return value === '1';
  } catch (err) {
    console.error('Token blacklist check error:', err);
    return false; // fail open so auth still works if Redis is down
  }
}
