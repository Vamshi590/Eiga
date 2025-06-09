import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache configuration
const DEFAULT_CACHE_EXPIRY = 1000 * 60 * 15; // 15 minutes cache expiry
const LONG_CACHE_EXPIRY = 1000 * 60 * 60; // 1 hour cache expiry
const SHORT_CACHE_EXPIRY = 1000 * 60 * 5; // 5 minutes cache expiry

// In-memory request cache to prevent duplicate in-flight requests
const pendingRequests: { [key: string]: Promise<any> } = {};

// Cache service for handling data caching
export const cacheService = {
  // Load data from cache
  loadFromCache: async <T>(key: string, userId?: string): Promise<T | null> => {
    try {
      const cacheKey = userId ? `${key}_${userId}` : key;
      const cachedDataString = await AsyncStorage.getItem(cacheKey);
      
      if (cachedDataString) {
        const { data, timestamp, expiry = DEFAULT_CACHE_EXPIRY } = JSON.parse(cachedDataString);
        const now = Date.now();
        
        // Check if cache is still valid
        if (now - timestamp < expiry) {
          console.log(`[CACHE] Using cached ${key} data`);
          return data as T;
        } else {
          console.log(`[CACHE] ${key} cache expired`);
        }
      }
    } catch (error) {
      console.error(`[CACHE] Error loading ${key} from cache:`, error);
    }
    return null;
  },
  
  // Save data to cache
  saveToCache: async <T>(key: string, data: T, userId?: string, expiry: number = DEFAULT_CACHE_EXPIRY): Promise<void> => {
    try {
      const cacheKey = userId ? `${key}_${userId}` : key;
      const cacheData = {
        data,
        timestamp: Date.now(),
        expiry
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`[CACHE] ${key} data cached successfully`);
    } catch (error) {
      console.error(`[CACHE] Error caching ${key} data:`, error);
    }
  },
  
  // Clear specific cache
  clearCache: async (key: string, userId?: string): Promise<void> => {
    try {
      const cacheKey = userId ? `${key}_${userId}` : key;
      await AsyncStorage.removeItem(cacheKey);
      console.log(`[CACHE] ${key} cache cleared`);
    } catch (error) {
      console.error(`[CACHE] Error clearing ${key} cache:`, error);
    }
  },
  
  // Clear all cache for a user
  clearUserCache: async (userId: string): Promise<void> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter(key => key.includes(`_${userId}`));
      if (userKeys.length > 0) {
        await AsyncStorage.multiRemove(userKeys);
        console.log(`[CACHE] All cache cleared for user ${userId}`);
      }
    } catch (error) {
      console.error(`[CACHE] Error clearing user cache:`, error);
    }
  },
  
  // Execute a function with caching
  withCache: async <T>(
    key: string, 
    fetchFn: () => Promise<T>, 
    userId?: string, 
    expiry: number = DEFAULT_CACHE_EXPIRY,
    forceRefresh: boolean = false
  ): Promise<T> => {
    const cacheKey = userId ? `${key}_${userId}` : key;
    
    // If we're forcing a refresh, clear the cache for this key
    if (forceRefresh) {
      await cacheService.clearCache(key, userId);
    } else {
      // Try to get from cache first
      const cachedData = await cacheService.loadFromCache<T>(key, userId);
      if (cachedData !== null) {
        return cachedData;
      }
    }
    
    // Check if there's already a pending request for this key
    if (await pendingRequests[cacheKey]) {
      console.log(`[CACHE] Reusing pending request for ${key}`);
      return pendingRequests[cacheKey];
    }
    
    // Create a new request and store it
    try {
      pendingRequests[cacheKey] = fetchFn();
      const data = await pendingRequests[cacheKey];
      
      // Cache the result
      await cacheService.saveToCache(key, data, userId, expiry);
      
      return data;
    } finally {
      // Clean up the pending request
      delete pendingRequests[cacheKey];
    }
  }
};

// Export cache expiry constants
export const CACHE_EXPIRY = {
  DEFAULT: DEFAULT_CACHE_EXPIRY,
  LONG: LONG_CACHE_EXPIRY,
  SHORT: SHORT_CACHE_EXPIRY
};

// Cache keys
export const CACHE_KEYS = {
  USER_ROOMS: 'eiga_user_rooms',
  USER_PLAN: 'eiga_user_plan',
  TRENDING_MOVIES: 'eiga_trending_movies',
  PROVIDER_GENRE_MOVIES: 'eiga_provider_genre_movies',
  MOVIE_DETAILS: 'eiga_movie_details',
  ROOM_DETAILS: 'eiga_room_details',
  SEARCH_RESULTS: 'eiga_search_results',
  USER_WATCHED_MOVIES: 'eiga_user_watched_movies',
  ROOM_WATCHED_MOVIES: 'eiga_room_watched_movies',
  ROOM_SUGGESTIONS: 'eiga_room_suggestions',
  ROOM_MEMBERS: 'eiga_room_members',
};
