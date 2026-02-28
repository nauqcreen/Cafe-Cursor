import Redis from "ioredis";

// Re-use a single connection across hot-reloads in dev
const globalForRedis = globalThis as unknown as { redis?: Redis };

function createClient() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is not set.");
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10_000,
  });
}

export const redis: Redis =
  globalForRedis.redis ?? (globalForRedis.redis = createClient());
