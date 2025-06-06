import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import zlib from 'zlib';

// Create a cache instance with improved settings
// - Increased max keys to 1000 (default is 100)
// - Default TTL of 5 minutes
// - Check period of 10 minutes
// - Use clone option to avoid reference issues
const cache = new NodeCache({ 
  stdTTL: 300, 
  checkperiod: 600,
  maxKeys: 1000,
  useClones: true
});

// Track cache statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  errors: 0
};

// Compress data before storing in cache
const compressData = (data: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const jsonString = JSON.stringify(data);
    zlib.deflate(jsonString, (err, buffer) => {
      if (err) {
        reject(err);
      } else {
        resolve(buffer);
      }
    });
  });
};

// Decompress data from cache
const decompressData = (buffer: Buffer): Promise<any> => {
  return new Promise((resolve, reject) => {
    zlib.inflate(buffer, (err, result) => {
      if (err) {
        reject(err);
      } else {
        try {
          const jsonString = result.toString();
          const data = JSON.parse(jsonString);
          resolve(data);
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    });
  });
};

/**
 * Get cache key based on request and user
 * This creates user-specific caches for authenticated requests
 */
const getCacheKey = (req: Request): string => {
  // Extract user ID from request if available
  let userId = 'anonymous';
  
  // Check for user ID in request object (added by auth middleware)
  if (req.user && (req.user as any).id) {
    userId = (req.user as any).id;
  }
  
  // Create a cache key based on the URL, query parameters, and user ID
  return `${userId}:${req.originalUrl || req.url}`;
};

/**
 * Middleware to cache responses
 * @param ttl Time to live in seconds (default: 300 seconds / 5 minutes)
 * @param compress Whether to compress the cached data (default: true)
 */
export const cacheResponse = (ttl: number = 300, compress: boolean = true) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Create a cache key
    const cacheKey = getCacheKey(req);

    // Check if we have a cached response
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      try {
        // Decompress if needed
        let responseData;
        if (compress && Buffer.isBuffer(cachedData)) {
          responseData = await decompressData(cachedData);
        } else {
          responseData = cachedData;
        }
        
        // Update stats
        cacheStats.hits++;
        
        // Log cache hit (only in development)
        if (process.env.NODE_ENV === 'development') {
          console.log(`Cache hit for ${cacheKey}`);
        }
        
        // Add cache header
        res.setHeader('X-Cache', 'HIT');
        
        return res.status(200).json(responseData);
      } catch (error) {
        console.error(`Error decompressing cached response for ${cacheKey}:`, error);
        cacheStats.errors++;
        // Continue with normal request if decompression fails
      }
    } else {
      // Update stats
      cacheStats.misses++;
      
      // Log cache miss (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log(`Cache miss for ${cacheKey}`);
      }
    }

    // Store the original send function
    const originalSend = res.send;

    // Override the send function to cache the response
    res.send = function(body): Response {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const parsedBody = JSON.parse(body);
          
          // Process caching asynchronously (don't block response)
          (async () => {
            try {
              // Compress data if enabled
              if (compress) {
                try {
                  const compressedData = await compressData(parsedBody);
                  cache.set(cacheKey, compressedData, ttl);
                } catch (compressError) {
                  console.error(`Error compressing data for ${cacheKey}:`, compressError);
                  // Fall back to uncompressed caching
                  cache.set(cacheKey, parsedBody, ttl);
                }
              } else {
                cache.set(cacheKey, parsedBody, ttl);
              }
              
              // Update stats
              cacheStats.sets++;
              
              // Log cache set (only in development)
              if (process.env.NODE_ENV === 'development') {
                console.log(`Cached response for ${cacheKey}`);
              }
            } catch (error) {
              console.error(`Error in async caching for ${cacheKey}:`, error);
              cacheStats.errors++;
            }
          })();
          
          // Add cache header
          res.setHeader('X-Cache', 'MISS');
        } catch (error) {
          console.error(`Error parsing response for ${cacheKey}:`, error);
          cacheStats.errors++;
        }
      }
      
      // Call the original send function
      return originalSend.call(this, body);
    };

    next();
  };
};

/**
 * Clear cache for a specific key or pattern
 * @param keyPattern Key or pattern to match
 */
export const clearCache = (keyPattern: string): void => {
  const keys = cache.keys();
  const matchingKeys = keys.filter((key: string) => key.includes(keyPattern));
  
  if (matchingKeys.length > 0) {
    cache.del(matchingKeys);
    console.log(`Cleared cache for pattern: ${keyPattern}`);
  }
};

/**
 * Middleware to clear cache when data is modified
 * @param keyPattern Key pattern to clear from cache
 */
export const clearCacheMiddleware = (keyPattern: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store the original send function
    const originalSend = res.send;

    // Override the send function to clear cache after successful modification
    res.send = function(body): Response {
      // Only clear cache for successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        clearCache(keyPattern);
      }
      
      // Call the original send function
      return originalSend.call(this, body);
    };

    next();
  };
};

/**
 * Get cache statistics
 * @returns Object with cache statistics
 */
export const getCacheStats = () => {
  return {
    ...cacheStats,
    cacheSize: cache.keys().length,
    cacheKeys: cache.keys(),
    memoryUsage: process.memoryUsage(),
    cacheInfo: {
      maxKeys: 1000,
      stdTTL: 300,
      checkperiod: 600
    },
    hitRatio: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0
  };
};
