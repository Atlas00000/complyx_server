import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (client) {
    return client;
  }

  if (connecting) {
    return connecting;
  }

  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  const redisClient = createClient({ url }) as RedisClientType;

  connecting = (async () => {
    redisClient.on('error', (err) => {
      console.error('Redis Client Error', err);
    });

    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    client = redisClient;
    connecting = null;
    return redisClient;
  })();

  return connecting;
}

