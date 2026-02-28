import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createClient(): Redis {
  return new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10_000,
  });
}

/** Returns a Redis client, or null if REDIS_URL is not configured. */
export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  return (globalForRedis.redis ??= createClient());
}
