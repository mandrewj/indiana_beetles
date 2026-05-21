/**
 * Tiny versioned localStorage cache used for GBIF/iNat fetches.
 * - Key shape: `bin:v${VERSION}:${namespace}:${id}`
 * - Value shape: `{ ts: epoch_ms, data: T }`
 * Bump VERSION to invalidate everything if the cached shape changes.
 */

const VERSION = 1;
const PREFIX = `bin:v${VERSION}:`;

interface Entry<T> {
  ts: number;
  data: T;
}

function storageAvailable(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const test = "__bin_cache_probe__";
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function makeKey(namespace: string, id: string): string {
  return `${PREFIX}${namespace}:${id}`;
}

export function readCache<T>(
  namespace: string,
  id: string,
  ttlMs: number
): T | null {
  if (!storageAvailable()) return null;
  const raw = window.localStorage.getItem(makeKey(namespace, id));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Entry<T>;
    if (Date.now() - parsed.ts > ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeCache<T>(namespace: string, id: string, data: T): void {
  if (!storageAvailable()) return;
  try {
    const entry: Entry<T> = { ts: Date.now(), data };
    window.localStorage.setItem(makeKey(namespace, id), JSON.stringify(entry));
  } catch {
    // Quota / private mode — best-effort cache.
  }
}

/**
 * Wrap a fetcher with the cache. ttlMs defaults to 24h.
 * If cached, returns instantly; otherwise calls `loader`, writes, returns.
 */
export async function withCache<T>(
  namespace: string,
  id: string,
  loader: () => Promise<T>,
  ttlMs: number = 24 * 60 * 60 * 1000
): Promise<T> {
  const cached = readCache<T>(namespace, id, ttlMs);
  if (cached) return cached;
  const fresh = await loader();
  writeCache(namespace, id, fresh);
  return fresh;
}

export function clearCacheNamespace(namespace: string): void {
  if (!storageAvailable()) return;
  const prefix = `${PREFIX}${namespace}:`;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }
  keys.forEach((k) => window.localStorage.removeItem(k));
}
