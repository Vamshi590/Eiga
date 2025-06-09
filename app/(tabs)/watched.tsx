import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabase';

import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useColorScheme } from '../../hooks/useColorScheme';
import { tmdbService } from '../../services/tmdbapi';
import { Movie } from '../../types';

// Use memo to prevent unnecessary re-renders
const WatchedScreen = memo(() => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();
  const { user, userData, loading: authLoading, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [watchedMovies, setWatchedMovies] = useState<any[]>([]);
  const [genreSections, setGenreSections] = useState<any[]>([]);
  
  // Use refs to track component state without triggering re-renders
  const isMountedRef = useRef(true);
  const dataLoadedRef = useRef(false);
  const [moviesByGenre, setMoviesByGenre] = useState<{title: string, data: Movie[]}[]>([]);
  
  // Cache keys and expiry time
  const WATCHED_MOVIES_CACHE_KEY = 'eiga_watched_screen_movies';
  const WATCHED_GENRES_CACHE_KEY = 'eiga_watched_screen_genres';
  const CACHE_EXPIRY = 1000 * 60 * 15; // 15 minutes cache expiry
  
  // Set up cleanup when component unmounts
  useEffect(() => {
    console.log('[WATCHED] Watched screen mounted');
    isMountedRef.current = true;
    
    return () => {
      console.log('[WATCHED] Watched screen unmounting');
      isMountedRef.current = false;
    };
  }, []);

  // Load data from cache
  const loadFromCache = async (key: string) => {
    if (!user) return null;
    
    try {
      const cachedDataString = await AsyncStorage.getItem(`${key}_${user.id}`);
      if (cachedDataString) {
        const { data, timestamp } = JSON.parse(cachedDataString);
        const now = Date.now();
        
        // Check if cache is still valid
        if (now - timestamp < CACHE_EXPIRY) {
          console.log(`[WATCHED] Using cached ${key} data`);
          return data;
        } else {
          console.log(`[WATCHED] ${key} cache expired`);
        }
      }
    } catch (error) {
      console.error(`[WATCHED] Error loading ${key} from cache:`, error);
    }
    return null;
  };
  
  // Save data to cache
  const saveToCache = async (key: string, data: any) => {
    if (!user) return;
    
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(`${key}_${user.id}`, JSON.stringify(cacheData));
    } catch (error) {
      console.error(`[WATCHED] Error caching ${key} data:`, error);
    }
  };
  
  // Clear cache
  const clearCache = async () => {
    if (!user) return;
    
    try {
      await AsyncStorage.removeItem(`${WATCHED_MOVIES_CACHE_KEY}_${user.id}`);
      await AsyncStorage.removeItem(`${WATCHED_GENRES_CACHE_KEY}_${user.id}`);
      console.log('[WATCHED] Cache cleared');
    } catch (error) {
      console.error('[WATCHED] Error clearing cache:', error);
    }
  };
  
  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await clearCache();
    dataLoadedRef.current = false;
    
    // Reset the refresh attempt flag to allow refreshUserData to be called again
    hasAttemptedRefreshRef.current = false;
    
    await loadWatchedMovies();
    setRefreshing(false);
  };

  // Track if we've already attempted to refresh user data
  const hasAttemptedRefreshRef = useRef(false);
  
  // Load watched movies
  useEffect(() => {
    // Skip if component is unmounted
    if (!isMountedRef.current) return;
    
    console.log('[WATCHED] Data effect triggered. authLoading:', authLoading);
    console.log('[WATCHED] userData state:', userData ? 'exists' : 'null/undefined');
    console.log('[WATCHED] dataLoaded:', dataLoadedRef.current);
    
    // Only proceed if auth is not loading
    if (authLoading) {
      console.log('[WATCHED] Auth is still loading, waiting...');
      return;
    }
    
    // If we have user but no userData, try to refresh user data ONCE
    if (user && !userData && !hasAttemptedRefreshRef.current) {
      console.log('[WATCHED] User exists but no userData, refreshing user data (first attempt)');
      hasAttemptedRefreshRef.current = true;
      refreshUserData();
      return;
    }
    
    if (userData) {
      console.log('[WATCHED] userData available:', JSON.stringify(userData).substring(0, 100) + '...');
      console.log('[WATCHED] watchedMovies in userData:', 
        userData.watchedMovies ? 
          `${userData.watchedMovies.length} movies` : 
          'no watched movies array');
      
      // Reset dataLoadedRef when userData changes to force reload
      const userDataChanged = watchedMovies.length === 0 || 
        (userData.watchedMovies && userData.watchedMovies.length !== watchedMovies.length);
      
      if (userDataChanged || !dataLoadedRef.current) {
        console.log('[WATCHED] Loading watched movies from userData');
        dataLoadedRef.current = false;  
        loadWatchedMovies();
      } else {
        console.log('[WATCHED] Watched movies already loaded, skipping');
        setLoading(false);
      }
    } else {
      console.log('[WATCHED] No userData available');
      setLoading(false);
    }
  }, [userData, authLoading, user, refreshUserData]);
  
  const loadWatchedMovies = async () => {
    if (dataLoadedRef.current) {
      console.log('[WATCHED] Data already loaded, skipping');
      return;
    }
    
    try {
      console.log('[WATCHED] loadWatchedMovies started');
      setLoading(true);
      
      if (!user) {
        console.log('[WATCHED] No user in loadWatchedMovies');
        setWatchedMovies([]);
        setMoviesByGenre([]);
        setLoading(false);
        return;
      }
      
      // Try to get movies from cache first
      const cachedMovies = await loadFromCache(WATCHED_MOVIES_CACHE_KEY);
      const cachedGenres = await loadFromCache(WATCHED_GENRES_CACHE_KEY);
      
      if (cachedMovies && cachedGenres) {
        console.log('[WATCHED] Using cached movies and genres');
        setWatchedMovies(cachedMovies);
        setMoviesByGenre(cachedGenres);
        dataLoadedRef.current = true;
        setLoading(false);
        return;
      }
      
      // Query the watched_movies table directly if cache miss
      console.log('[WATCHED] Querying watched_movies table for user ID:', user.id);
      const { data: watchedMoviesData, error: watchedMoviesError } = await supabase
        .from('watched_movies')
        .select('*')
        .eq('user_id', user.id);
      
      if (watchedMoviesError) {
        console.error('[WATCHED] Error fetching watched movies:', watchedMoviesError);
        setWatchedMovies([]);
        setMoviesByGenre([]);
        setLoading(false);
        return;
      }
      
      console.log('[WATCHED] Fetched watched movies from table:', 
        Array.isArray(watchedMoviesData) ? watchedMoviesData.length : 'not an array');
      
      // If no watched movies found, handle accordingly
      if (!Array.isArray(watchedMoviesData) || watchedMoviesData.length === 0) {
        console.log('[WATCHED] No watched movies found in table');
        setWatchedMovies([]);
        setMoviesByGenre([]);
        setLoading(false);
        return;
      }
      
      // Separate movies that need TMDB fetching from those that already have data
      const moviesNeedingTMDB: number[] = [];
      const moviesWithData: Movie[] = [];
      
      // First pass: collect movie IDs that need TMDB fetching and extract existing movie data
      watchedMoviesData.forEach((wm: any, idx: number) => {
        try {
          if (wm.movie_id && (!wm.movie_data || typeof wm.movie_data !== 'object')) {
            // Need to fetch from TMDB
            moviesNeedingTMDB.push(Number(wm.movie_id));
          } else if (wm.movie_data && typeof wm.movie_data === 'object') {
            // Already have movie data as object
            moviesWithData.push(wm.movie_data);
          } else if (wm.movie_data && typeof wm.movie_data === 'string') {
            // Parse movie data from string
            try {
              const parsedData = JSON.parse(wm.movie_data);
              moviesWithData.push(parsedData);
            } catch (parseError) {
              console.error(`Error parsing movie_data at index ${idx}:`, parseError);
              // If we have movie_id as fallback, add to TMDB fetch list
              if (wm.movie_id) {
                moviesNeedingTMDB.push(Number(wm.movie_id));
              }
            }
          } else if (wm.id && wm.title) {
            // Direct movie details
            moviesWithData.push(wm);
          } else {
            console.warn('Unexpected watched_movies structure at index', idx, wm);
          }
        } catch (error) {
          console.error(`Error processing watched movie at index ${idx}:`, error);
          // If we have movie_id as fallback, add to TMDB fetch list
          if (wm.movie_id) {
            moviesNeedingTMDB.push(Number(wm.movie_id));
          }
        }
      });
      
      console.log(`[WATCHED] Found ${moviesWithData.length} movies with data, ${moviesNeedingTMDB.length} need TMDB fetching`);
      
      // Batch fetch movies from TMDB in chunks to avoid rate limiting
      const tmdbMovies: Movie[] = [];
      const BATCH_SIZE = 20; // Adjust based on API limits
      
      for (let i = 0; i < moviesNeedingTMDB.length; i += BATCH_SIZE) {
        const batch = moviesNeedingTMDB.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(movieId => tmdbService.getMovieDetails(movieId));
        
        try {
          const batchResults = await Promise.all(batchPromises);
          const validBatchResults = batchResults.filter(movie => movie !== null) as Movie[];
          tmdbMovies.push(...validBatchResults);
        } catch (error) {
          console.error(`[WATCHED] Error fetching batch of movies from TMDB:`, error);
        }
        
        // Add a small delay between batches if needed
        if (i + BATCH_SIZE < moviesNeedingTMDB.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Combine all valid movies
      const allMovies = [...moviesWithData, ...tmdbMovies];
      const validMovies = allMovies.filter((movie: Movie | null) => movie !== null) as Movie[];
      console.log(`Found ${validMovies.length} valid movies out of ${allMovies.length} total`);
      setWatchedMovies(validMovies);

      // Group movies by genre and remove duplicates
      const genreMap: { [key: string]: Movie[] } = {};
      const movieIdSet = new Set<number>();
      const processedMovies: { [key: number]: boolean } = {};

      // First pass: collect all unique movies and their primary genres
      const uniqueMovies = validMovies.filter((movie) => {
        const movieId = typeof movie.id === 'string' ? parseInt(movie.id) : movie.id;
        if (movieIdSet.has(movieId)) return false;
        movieIdSet.add(movieId);
        return true;
      });

      console.log(`Found ${uniqueMovies.length} unique movies out of ${validMovies.length} total`);

      // Second pass: assign each movie to exactly one genre (its first genre)
      uniqueMovies.forEach((movie) => {
        const movieId = typeof movie.id === 'string' ? parseInt(movie.id) : movie.id;

        // Skip if we've already assigned this movie to a genre
        if (processedMovies[movieId]) return;

        // Mark this movie as processed
        processedMovies[movieId] = true;

        if (movie.genres && movie.genres.length > 0) {
          // Use only the first genre from the movie
          const primaryGenre = typeof movie.genres[0] === 'object' && movie.genres[0].name
            ? movie.genres[0].name
            : typeof movie.genres[0] === 'string'
            ? movie.genres[0]
            : 'Other';
          if (!genreMap[primaryGenre]) {
            genreMap[primaryGenre] = [];
          }
          genreMap[primaryGenre].push(movie);
        } else {
          // Fallback if no genres available
          if (!genreMap['Other']) {
            genreMap['Other'] = [];
          }
          genreMap['Other'].push(movie);
        }
      });

      // Convert the map to an array of sections
      const sections = Object.keys(genreMap).map((genre) => ({
        title: genre,
        data: genreMap[genre],
      }));

      // Sort sections by number of movies (most popular genres first)
      sections.sort((a, b) => b.data.length - a.data.length);

      // Count total unique movies across all genres
      const totalUniqueMovies = Object.values(genreMap).reduce((total, movies) => total + movies.length, 0);
      console.log(`Grouped ${totalUniqueMovies} unique movies into ${sections.length} genres`);
      setMoviesByGenre(sections);
      
      // Cache the processed data
      saveToCache(WATCHED_MOVIES_CACHE_KEY, validMovies);
      saveToCache(WATCHED_GENRES_CACHE_KEY, sections);
      
      // Mark data as loaded
      dataLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading watched movies:', error);
      setWatchedMovies([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Render movie item with smaller cards
  const renderMovieItem = ({ item }: { item: Movie }) => {
    // Safely handle missing poster path
    const posterUri = item.poster_path ? 
      tmdbService.getImageUrl(item.poster_path) : 
      'https://via.placeholder.com/150x225?text=No+Image';
      
    return (
      <TouchableOpacity 
        style={styles.movieCard}
        onPress={() => router.push(`/movies/${item.id}` as any)}
      >
        <Image
          source={{ uri: posterUri }}
          style={styles.moviePoster}
          contentFit="cover"
          transition={200}
        />
        <Text 
          style={[styles.movieTitle, { color: Colors[colorScheme || 'light'].text }]}
          numberOfLines={1}
        >
          {item.title || 'Unknown Title'}
        </Text>
        <Text style={[styles.movieYear, { color: Colors[colorScheme || 'light'].icon }]}>
          {item.release_date ? new Date(item.release_date).getFullYear() : 'N/A'}
        </Text>
      </TouchableOpacity>
    );
  };
  
  // Render section header for genre groups
  const renderSectionHeader = ({ section }: { section: {title: string, data: Movie[]} }) => (
    <View style={[styles.sectionHeader, { backgroundColor: Colors[colorScheme || 'light'].background }]}>
      <Text style={[styles.sectionHeaderText, { color: Colors[colorScheme || 'light'].text }]}>{section.title}</Text>
      <Text style={[styles.movieCount, { color: Colors[colorScheme || 'light'].textSecondary }]}>{section.data.length} movies</Text>
    </View>
  );
  
  // Render a horizontal row of movies for each genre
  const renderSectionItem = ({ section }: { section: {title: string, data: Movie[]} }) => (
    <FlatList
      horizontal
      data={section.data}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderMovieItem}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalMovieList}
    />
  );
  
  // Add a useEffect to call refreshUserData when component mounts if user exists but userData doesn't
  useEffect(() => {
    if (user && !userData && !authLoading) {
      console.log('[WATCHED] User exists but no userData on mount, refreshing user data');
      refreshUserData();
    }
  }, []);
  
  if (authLoading || loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: Colors[colorScheme || 'light'].background }]}>
        <Stack.Screen
          options={{
            headerTitle: 'Watched Movies',
            headerShown: false,
            headerStyle: {
              backgroundColor: Colors[colorScheme || 'light'].background,
            },
            headerTintColor: Colors[colorScheme || 'light'].text,
          }}
        />
        <ActivityIndicator size="large" color={Colors[colorScheme || 'light'].primary} />
        <Text style={{marginTop: 16, color: Colors[colorScheme || 'light'].textSecondary}}>
          Loading your watched movies...
        </Text>
      </View>
    );
  }
  
  if (!user) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            headerTitle: 'Watched Movies',
            headerShown: true,
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <Ionicons name="film-outline" size={64} color={colors.icon} />
        <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
          Sign in to track watched movies
        </Text>
        <TouchableOpacity
          style={[styles.signInButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/auth/login' as any)}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerTitle: 'Watched Movies',
          headerShown: false,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      
      {loading ? (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{marginTop: 16, color: colors.textSecondary}}>
            Loading your watched movies...
          </Text>
        </View>
      ) : !userData || !userData.watchedMovies || watchedMovies.length === 0 ? (
        <View style={styles.centerContent}>
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)', 'transparent']}
            style={styles.emptyStateGradient}
          >
            <Ionicons name="film-outline" size={64} color="#fff" />
          </LinearGradient>
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
            No watched movies yet
          </Text>
          <Text style={[styles.emptyStateSubtitle, { color: colors.icon }]}>
            Movies you mark as watched will appear here
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.exploreButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(tabs)/explore' as any)}
            >
              <Text style={styles.exploreButtonText}>Explore Movies</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: colors.card }]}
              onPress={async () => {
                setLoading(true);
                dataLoadedRef.current = false;
                await refreshUserData();
                setTimeout(() => loadWatchedMovies(), 1000); // Give time for userData to update
              }}
            >
              <Ionicons name="refresh" size={18} color={colors.text} style={{marginRight: 6}} />
              <Text style={[styles.refreshButtonText, { color: colors.text }]}>Refresh Data</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <SectionList
          sections={moviesByGenre}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => null} // We don't render items directly in the section list
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={({ section }) => (
            <View style={styles.sectionContent}>
              {renderSectionItem({ section })}
            </View>
          )}
          stickySectionHeadersEnabled={true}
          contentContainerStyle={[styles.movieGrid, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              <LinearGradient
                colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)', 'transparent']}
                style={styles.headerGradient}
              >
                <Text style={styles.headerTitle}>My Watched Collection</Text>
                <Text style={styles.headerSubtitle}>{moviesByGenre.reduce((total, genre) => total + genre.data.length, 0)} unique movies watched</Text>
              </LinearGradient>
            </View>
          }
        />
      )}
    </View>
  );
});

export default WatchedScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  movieGrid: {
    paddingBottom: 8,
  },
  // Header styles
  headerContainer: {
    height: 180,
    width: '100%',
    marginBottom: 16,
  },
  headerGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Section styles
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#E50914', // Netflix-inspired accent
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '600',
  },
  movieCount: {
    fontSize: 14,
  },
  sectionContent: {
    marginBottom: 24,
  },
  horizontalMovieList: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  // Movie card styles - for horizontal scrolling
  movieCard: {
    width: 100,
    marginRight: 12,
  },
  moviePoster: {
    aspectRatio: 2/3,
    borderRadius: 6,
    marginBottom: 4,
  },
  movieTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  movieYear: {
    fontSize: 10,
  },
  // Empty state styles
  emptyStateGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  exploreButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  signInButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
