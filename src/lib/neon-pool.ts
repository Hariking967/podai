import { Pool } from "@neondatabase/serverless";

const LOG_PREFIX = "[NeonPool]";

/**
 * Singleton pool manager for Neon database connections.
 * Maintains a cache of connection pools per connection string.
 * NEVER calls pool.end() - pools are reused across requests.
 */
class NeonPoolManager {
  private pools: Map<string, Pool> = new Map();

  /**
   * Get or create a connection pool for the given connection string.
   * Pools are cached and reused across requests.
   */
  getPool(connectionString: string): Pool {
    // Use first 50 chars as cache key (includes host/db, excludes password)
    const cacheKey = this.getCacheKey(connectionString);

    let pool = this.pools.get(cacheKey);

    if (!pool) {
      console.log(
        `${LOG_PREFIX} Creating new pool for key: ${cacheKey.substring(0, 20)}...`,
      );
      pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 10000, // 10 second connection timeout
        max: 10, // Maximum 10 connections per pool
        idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      });
      this.pools.set(cacheKey, pool);
    }

    return pool;
  }

  /**
   * Create a cache key from connection string.
   * Uses host + database name to cache pools per unique database.
   */
  private getCacheKey(connectionString: string): string {
    try {
      const url = new URL(connectionString);
      return `${url.host}${url.pathname}`;
    } catch {
      // Fallback: use first 50 chars
      return connectionString.substring(0, 50);
    }
  }

  /**
   * Get pool statistics (for debugging).
   */
  getStats() {
    return {
      poolCount: this.pools.size,
      pools: Array.from(this.pools.keys()).map((key) => ({
        key: key.substring(0, 30) + "...",
      })),
    };
  }
}

// Export singleton instance
export const neonPoolManager = new NeonPoolManager();

/**
 * Get a connection pool for the given connection string.
 * IMPORTANT: Do NOT call pool.end() on the returned pool.
 * The pool is managed by the singleton and will be reused across requests.
 */
export function getNeonPool(connectionString: string): Pool {
  return neonPoolManager.getPool(connectionString);
}
