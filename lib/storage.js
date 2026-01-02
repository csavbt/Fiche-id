import { Redis } from "@upstash/redis";

const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

let redis = null;
if (url && token) {
  redis = new Redis({ url, token });
}

// Fallback in-memory (non fiable en serverless)
const mem = globalThis.__FIP_MEM__ || new Map();
globalThis.__FIP_MEM__ = mem;

function keyFor(tok) { return `fip:token:${tok}`; }

export async function saveToken(tok, payload, ttlSeconds) {
  const k = keyFor(tok);
  const mode = redis ? "redis" : "memory";
  const data = { ...payload, storageMode: mode, used: false, createdAt: new Date().toISOString() };
  if (redis) {
    await redis.set(k, data, { ex: ttlSeconds });
    return { mode };
  }
  mem.set(k, data);
  return { mode };
}

export async function getToken(tok) {
  const k = keyFor(tok);
  if (redis) return await redis.get(k);
  return mem.get(k) || null;
}

export async function markTokenUsed(tok) {
  const k = keyFor(tok);
  if (redis) {
    const data = await redis.get(k);
    if (!data) return false;
    data.used = true;
    await redis.set(k, data, { ex: 24 * 3600 });
    return true;
  }
  const d = mem.get(k);
  if (!d) return false;
  d.used = true;
  mem.set(k, d);
  return true;
}
