import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';

// Create a cache instance with default TTL of 5 minutes and check period of 10 minutes
const cache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

/**
 * Middleware to cache responses
 * @param ttl Time to live in seconds (default: 300 seconds / 5 minutes)
 */
export const cacheResponse = (ttl: number = 300) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Create a cache key based on the URL and query parameters
    const cacheKey = `${req.originalUrl || req.url}`;

    // Check if we have a cached response
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.status(200).json(cachedResponse);
    }

    // Store the original send function
    const originalSend = res.send;

    // Override the send function to cache the response
    res.send = function(body): Response {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const parsedBody = JSON.parse(body);
          cache.set(cacheKey, parsedBody, ttl);
          console.log(`Cached response for ${cacheKey}`);
        } catch (error) {
          console.error('Error caching response:', error);
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
