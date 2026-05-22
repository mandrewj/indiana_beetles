/**
 * Tiny versioned localStorage cache used for GBIF/iNat fetches.
 * - Key shape: `bin:v${VERSION}:${namespace}:${id}`
 * - Value shape: `{ ts: epoch_ms, data: T }`
 * Bump VERSION to invalidate everything if the cached shape changes.
 */

// Bump on any change that affects cached payload shape OR query scoping
// (e.g. correcting iNat place_id from 30 → 20, adding point-in-polygon county
// resolver, filtering iNat-sourced occurrences out of GBIF). Old entries
// become unreadable and the next visit will re-fetch.
const VERSION = 4;
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

interface WithCacheOptions {
  /** Cache lifetime in ms. Default 24h. */
  ttlMs?: number;
  /** When true, ignore the cached entry and always call `loader`. */
  force?: boolean;
}

/**
 * Wrap a fetcher with the cache. If cached and fresh (and not force), returns
 * instantly; otherwise calls `loader`, writes, returns.
 */
export async function withCache<T>(
  namespace: string,
  id: string,
  loader: () => Promise<T>,
  options: WithCacheOptions = {}
): Promise<T> {
  const ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
  if (!options.force) {
    const cached = readCache<T>(namespace, id, ttlMs);
    if (cached) return cached;
  }
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
