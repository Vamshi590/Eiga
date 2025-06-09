import axios from 'axios';
import { cacheService, CACHE_EXPIRY, CACHE_KEYS } from './cacheService';

// TMDB API configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = 'b72b9895959820722fbb3a5e2d5d6e76';
const TMDB_READ_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiNzJiOTg5NTk1OTgyMDcyMmZiYjNhNWUyZDVkNmU3NiIsIm5iZiI6MTc0ODY5ODA5OC4wNTIsInN1YiI6IjY4M2IwM2YyZjEzZGM5NmVhYmFkNzY1YiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.ah44XG5LjmboU1tN6wYTfkH3UvFZJQKnhP_u1xBbEzQ';

// Create axios instance for TMDB API
const tmdbApi = axios.create({
  baseURL: TMDB_BASE_URL,
  headers: {
    'Authorization': `Bearer ${TMDB_READ_ACCESS_TOKEN}`
  },
  params: {
    api_key: TMDB_API_KEY,
    language: 'en-US',
  },
  timeout: 10000,
});

// Movie providers IDs (from TMDB)
// Helper to get region (stubbed as 'IN' for now, can be made dynamic)
const getRegion = () => 'IN';

// Expanded list of major streaming providers (IDs from TMDB)
export const PROVIDERS = {
  NETFLIX: 8,
  AMAZON_PRIME: 119,
  DISNEY_PLUS: 337,
  HOTSTAR: 122,
  APPLE_TV: 350,
  ZEE5: 232,
  JIOCINEMA: 970,
};

// Movie genres
const GENRES = {
  ACTION: 28,
  ADVENTURE: 12,
  ANIMATION: 16,
  COMEDY: 35,
  CRIME: 80,
  DOCUMENTARY: 99,
  DRAMA: 18,
  FAMILY: 10751,
  FANTASY: 14,
  HISTORY: 36,
  HORROR: 27,
  MUSIC: 10402,
  MYSTERY: 9648,
  ROMANCE: 10749,
  SCIENCE_FICTION: 878,
  TV_MOVIE: 10770,
  THRILLER: 53,
  WAR: 10752,
  WESTERN: 37,
};

// API functions with caching implementation
export const tmdbService = {
  // Get streaming providers for a movie
  getMovieProviders: async (movieId: number) => {
    const cacheKey = `${CACHE_KEYS.MOVIE_DETAILS}_providers_${movieId}`;
    
    return cacheService.withCache(
      cacheKey,
      async () => {
        const response = await tmdbApi.get(`/movie/${movieId}/watch/providers`);
        return response.data;
      },
      undefined,
      CACHE_EXPIRY.LONG // Providers don't change often
    );
  },
  
  // Search for movies by query (autocomplete)
  searchMovies: async (query: string) => {
    // Don't cache very short queries
    if (query.length < 3) {
      try {
        const response = await tmdbApi.get('/search/movie', {
          params: {
            query,
            include_adult: false,
            page: 1,
          },
        });
        return response.data;
      } catch (error) {
        console.error('Error searching movies:', error);
        throw error;
      }
    }
    
    // Cache longer search queries
    const cacheKey = `${CACHE_KEYS.SEARCH_RESULTS}_${query.toLowerCase().trim()}`;
    
    return cacheService.withCache(
      cacheKey,
      async () => {
        const response = await tmdbApi.get('/search/movie', {
          params: {
            query,
            include_adult: false,
            page: 1,
          },
        });
        return response.data;
      },
      undefined,
      CACHE_EXPIRY.SHORT // Search results can change, so use shorter cache
    );
  },
  
  // Search for TV shows by query
  searchTV: async (query: string) => {
    // Don't cache very short queries
    if (query.length < 3) {
      try {
        const response = await tmdbApi.get('/search/tv', {
          params: {
            query,
            include_adult: false,
            page: 1,
          },
        });
        return response.data;
      } catch (error) {
        console.error('Error searching TV shows:', error);
        throw error;
      }
    }
    
    // Cache longer search queries
    const cacheKey = `${CACHE_KEYS.SEARCH_RESULTS}_tv_${query.toLowerCase().trim()}`;
    
    return cacheService.withCache(
      cacheKey,
      async () => {
        const response = await tmdbApi.get('/search/tv', {
          params: {
            query,
            include_adult: false,
            page: 1,
          },
        });
        return response.data;
      },
      undefined,
      CACHE_EXPIRY.SHORT
    );
  },

  // Get movie details by ID
  getMovieDetails: async (movieId: number) => {
    const cacheKey = `${CACHE_KEYS.MOVIE_DETAILS}_${movieId}`;
    
    return cacheService.withCache(
      cacheKey,
      async () => {
        const response = await tmdbApi.get(`/movie/${movieId}`, {
          params: {
            append_to_response: 'credits,videos,images',
          },
        });
        return response.data;
      },
      undefined,
      CACHE_EXPIRY.LONG // Movie details don't change often
    );
  },

  // Get trending movies
  getTrendingMovies: async (timeWindow: 'day' | 'week' = 'week') => {
    const cacheKey = `${CACHE_KEYS.TRENDING_MOVIES}_${timeWindow}`;
    
    return cacheService.withCache(
      cacheKey,
      async () => {
        const response = await tmdbApi.get(`/trending/movie/${timeWindow}`);
        return response.data.results;
      },
      undefined,
      timeWindow === 'day' ? CACHE_EXPIRY.SHORT : CACHE_EXPIRY.DEFAULT
    );
  },

  // Get movies by streaming provider
  getMoviesByProvider: async (providerId: number, page: number = 1, region: string = getRegion()) => {
    const cacheKey = `${CACHE_KEYS.PROVIDER_GENRE_MOVIES}_provider_${providerId}_page_${page}_region_${region}`;
    
    return cacheService.withCache(
      cacheKey,
      async () => {
        const response = await tmdbApi.get('/discover/movie', {
          params: {
            with_watch_providers: providerId,
            watch_region: region,
            page,
          },
        });
        return response.data.results;
      },
      undefined,
      CACHE_EXPIRY.DEFAULT
    );
  },

  // Get movies by genre
  getMoviesByGenre: async (genreId: number, page: number = 1) => {
    const cacheKey = `${CACHE_KEYS.PROVIDER_GENRE_MOVIES}_genre_${genreId}_page_${page}`;
    
    return cacheService.withCache(
      cacheKey,
      async () => {
        const response = await tmdbApi.get('/discover/movie', {
          params: {
            with_genres: genreId,
            page,
          },
        });
        return response.data.results;
      },
      undefined,
      CACHE_EXPIRY.DEFAULT
    );
  },

  // Get movies by provider and genre
  getMoviesByProviderAndGenre: async (providerId: number, genreId: number, page: number = 1, region: string = getRegion()) => {
    const cacheKey = `${CACHE_KEYS.PROVIDER_GENRE_MOVIES}_provider_${providerId}_genre_${genreId}_page_${page}_region_${region}`;
    
    return cacheService.withCache(
      cacheKey,
      async () => {
        const response = await tmdbApi.get('/discover/movie', {
          params: {
            with_watch_providers: providerId,
            with_genres: genreId,
            watch_region: region,
            page,
          },
        });
        return response.data.results;
      },
      undefined,
      CACHE_EXPIRY.DEFAULT
    );
  },

  // Get image URL (no caching needed, just a utility function)
  getImageUrl: (path: string, size: string = 'w500') => {
    return `https://image.tmdb.org/t/p/${size}${path}`;
  },
  
  // Get backdrop image URL (higher resolution for backdrops)
  getBackdropUrl: (path: string, size: string = 'w1280') => {
    return `https://image.tmdb.org/t/p/${size}${path}`;
  },
  
  // Clear all TMDB-related caches
  clearCache: async () => {
    // Clear trending movies cache
    await cacheService.clearCache(`${CACHE_KEYS.TRENDING_MOVIES}_day`);
    await cacheService.clearCache(`${CACHE_KEYS.TRENDING_MOVIES}_week`);
    
    // Note: We don't clear movie details or provider caches as they rarely change
    console.log('[TMDB] Cache cleared');
  }
};

export { GENRES };

