/**
 * Cache Layer
 *
 * In-memory caching utilities for performance optimization.
 * Replaces Redis cache with simple LRU-style in-memory cache.
 *
 * Cache keys follow the pattern: `resource:id:subkey`
 * TTL (Time-To-Live) is in seconds
 */

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Simple in-memory LRU cache with TTL support
 */
class InMemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize = 1000; // Maximum number of entries
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Run cleanup every 5 minutes
    const interval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    interval.unref?.();
    this.cleanupInterval = interval;
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end for LRU (Map maintains insertion order)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Set a value in cache with TTL
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Delete keys matching a pattern (simple prefix matching)
   */
  deleteByPattern(pattern: string): number {
    let deleted = 0;
    const prefix = pattern.replace(/\*/g, '');

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global cache instance
const memoryCache = new InMemoryCache();
const inFlight = new Map<string, { promise: Promise<CachedResult<unknown>> }>();

/**
 * Cache options for getCached function
 */
export interface CacheOptions<T> {
  key: string;
  ttl?: number; // Time to live in seconds (default: 5 minutes)
  fetch: () => Promise<{ data: T | null; error: any }>;
}

/**
 * Cached result with metadata
 */
export interface CachedResult<T> {
  data: T | null;
  cached: boolean; // true if data came from cache, false if fetched fresh
  error: any;
}

/**
 * Generic cache wrapper with automatic TTL and error handling
 *
 * Usage:
 * ```ts
 * const result = await getCached({
 *   key: 'dashboard:agency-123',
 *   ttl: 300, // 5 minutes
 *   fetch: async () => {
 *     // Your data fetching logic here
 *     return { data: someData, error: null };
 *   }
 * });
 * ```
 */
export async function getCached<T>({ key, ttl = 300, fetch }: CacheOptions<T>): Promise<CachedResult<T>> {
  // Try cache first
  try {
    const cached = memoryCache.get<T>(key);
    if (cached !== null) {
      cacheStats.recordHit();
      return { data: cached, cached: true, error: null };
    }
  } catch (error) {
    // Cache read failed - continue to fetch from database
    console.warn(`Cache read failed for key "${key}":`, error);
  }

  cacheStats.recordMiss();

  // A joined read is still a cache miss; only the source call is shared.
  const existing = inFlight.get(key);
  if (existing) return existing.promise as Promise<CachedResult<T>>;

  const entry = {} as { promise: Promise<CachedResult<unknown>> };
  const pending = (async (): Promise<CachedResult<T>> => {
    const result = await fetch();
    // Invalidation detaches old work. It may finish for its original callers,
    // but cannot overwrite a newer read for this key.
    if (result.data && !result.error && inFlight.get(key) === entry) {
      try {
        memoryCache.set(key, result.data, ttl);
      } catch (error) {
        console.warn(`Cache write failed for key "${key}":`, error);
      }
    }
    return { ...result, cached: false };
  })();
  entry.promise = pending;
  inFlight.set(key, entry);
  try {
    return await pending;
  } finally {
    if (inFlight.get(key) === entry) inFlight.delete(key);
  }
}

/**
 * Invalidate cache by key pattern
 *
 * Uses simple prefix matching for pattern support.
 *
 * @param pattern - Cache key pattern to match (supports prefix matching with *)
 * @returns Object with success status and number of keys deleted
 */
export async function invalidateCache(pattern: string): Promise<{ success: boolean; keysDeleted: number; error?: any }> {
  try {
    const keysDeleted = memoryCache.deleteByPattern(pattern);
    const prefix = pattern.replace(/\*/g, '');
    for (const key of inFlight.keys()) {
      if (key.startsWith(prefix)) inFlight.delete(key);
    }
    return { success: true, keysDeleted };
  } catch (error) {
    console.error(`Cache invalidation failed for pattern "${pattern}":`, error);
    return {
      success: false,
      keysDeleted: 0,
      error,
    };
  }
}

/**
 * Delete a specific cache key
 *
 * @param key - Exact cache key to delete
 */
export async function deleteCache(key: string): Promise<boolean> {
  try {
    inFlight.delete(key);
    return memoryCache.delete(key);
  } catch (error) {
    console.warn(`Failed to delete cache key "${key}":`, error);
    return false;
  }
}

/**
 * Cache key generators
 *
 * Provides consistent cache key naming across the application.
 * Format: `resource:identifier:subkey`
 */
export const CacheKeys = {
  // Dashboard cache
  dashboard: (agencyId: string) => `dashboard:${agencyId}`,

  // Public marketing aggregate (anonymous counts, hourly refresh)
  marketingStats: () => 'marketing-stats:global',

  // Dashboard components
  stats: (agencyId: string) => `dashboard:${agencyId}:stats`,
  requests: (agencyId: string) => `dashboard:${agencyId}:requests`,
  connections: (agencyId: string) => `dashboard:${agencyId}:connections`,

  // Agency data
  agency: (agencyIdOrClerkId: string) => `agency:${agencyIdOrClerkId}`,
  agencyByClerkId: (clerkUserId: string) => `agency:clerk:${clerkUserId}`,
  agencyByEmail: (email: string) => `agency:email:${email}`,
  agencyMembers: (agencyId: string) => `agency:${agencyId}:members`,

  // Access requests
  accessRequest: (requestId: string) => `access-request:${requestId}`,
  agencyAccessRequests: (agencyId: string) => `agency:${agencyId}:access-requests`,

  // Client connections
  clientConnection: (connectionId: string) => `connection:${connectionId}`,
  agencyConnections: (agencyId: string) => `agency:${agencyId}:connections`,

  // Platform authorizations
  platformAuth: (connectionId: string, platform: string) => `auth:${connectionId}:${platform}`,

  // OAuth tokens (not cached - in Infisical)
  // Token cache keys are managed by the token refresh system
};

/**
 * Invalidate all dashboard-related cache for an agency.
 * Clears both the main dashboard key and sub-keys (stats, requests, connections).
 */
export async function invalidateDashboardCache(agencyId: string): Promise<void> {
  await Promise.all([
    deleteCache(CacheKeys.dashboard(agencyId)),
    invalidateCache(`dashboard:${agencyId}:*`),
  ]);
}

/**
 * Cache TTL constants (in seconds)
 *
 * Predefined TTL values for different data types.
 */
export const CacheTTL = {
  SHORT: 60, // 1 minute - rapidly changing data
  MEDIUM: 300, // 5 minutes - default for dashboard
  LONG: 600, // 10 minutes - relatively static data
  EXTENDED: 1800, // 30 minutes - rarely changing data
};

/**
 * Cache statistics (for monitoring)
 *
 * Track cache hit/miss ratios to optimize TTL values.
 */
export class CacheStats {
  private hits = 0;
  private misses = 0;

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  getStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

// Global cache stats instance
export const cacheStats = new CacheStats();

/**
 * Get cache statistics including memory usage
 */
export function getCacheStats(): {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
} {
  const stats = cacheStats.getStats();
  const memStats = memoryCache.getStats();

  return {
    ...stats,
    size: memStats.size,
    maxSize: memStats.maxSize,
  };
}

/**
 * Stop cache cleanup interval (for graceful shutdown)
 */
export function stopCache(): void {
  memoryCache.stop();
}
