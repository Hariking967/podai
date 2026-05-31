import { Redis } from "@upstash/redis";

const LOG_PREFIX = "[Cache]";
const memoryStore = new Map<string, { value: unknown; expiresAt: number }>();

let redisClient: Redis | null = null;

const getRedisClient = () => {
  if (redisClient) return redisClient;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return null;
  }

  redisClient = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  return redisClient;
};

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const now = Date.now();
  const memoryHit = memoryStore.get(key);

  if (memoryHit && memoryHit.expiresAt > now) {
    return memoryHit.value as T;
  }

  if (memoryHit && memoryHit.expiresAt <= now) {
    memoryStore.delete(key);
  }

  const client = getRedisClient();
  if (!client) return null;

  try {
    const value = await client.get<T>(key);
    return value ?? null;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Redis get failed, using fallback only`, error);
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: unknown,
  ttlSeconds: number,
) => {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  memoryStore.set(key, { value, expiresAt });

  const client = getRedisClient();
  if (!client) return;

  try {
    await client.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    console.warn(`${LOG_PREFIX} Redis set failed, using fallback only`, error);
  }
};
