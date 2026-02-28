import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createClient(): Redis {
  const client = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5_000,
    lazyConnect: true,
    retryStrategy: (times) => {
      // Give up after 3 attempts — don't spam reconnects
      if (times >= 3) return null;
      return Math.min(times * 500, 2000);
    },
  });

  // Prevent unhandled error events from crashing the process
  client.on("error", (err) => {
    if ((err as NodeJS.ErrnoException).code !== "ENOTFOUND") {
      console.warn("[redis]", err.message);
    }
  });

  return client;
}

/** Returns a Redis client, or null if REDIS_URL is not configured. */
export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  return (globalForRedis.redis ??= createClient());
}
