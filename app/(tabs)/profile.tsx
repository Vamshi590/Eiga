import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useColorScheme } from '../../hooks/useColorScheme';
import { supabase } from '../../services/supabase';
import { tmdbService } from '../../services/tmdbapi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { user, userData, loading: isLoading, signOut, refreshUserData } = useAuth();
  
  const [refreshing, setRefreshing] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [userStats, setUserStats] = useState({
    totalWatched: 0,
    totalGenres: 0,
    favoriteGenre: '',
    watchTime: 0, // in hours
  });
  
  // For favorite genre display
  const [favoriteGenre, setFavoriteGenre] = useState<string | null>(null);
  const [genreLoading, setGenreLoading] = useState(false);
  const [watchedMovies, setWatchedMovies] = useState<any[]>([]);
  const [dataFetched, setDataFetched] = useState(false); // Flag to prevent multiple fetches
  
  // Cache control
  const cacheTimeoutRef = useRef<number | null>(null);
  const CACHE_EXPIRY = 1000 * 60 * 30; // 30 minutes cache expiry
  
  // Track if we've already attempted to refresh user data
  const hasAttemptedRefreshRef = useRef(false);
  
  // Load cached data from AsyncStorage
  const loadCachedData = useCallback(async () => {
    if (!user) return false; // Early return if no user
    
    try {
      const cachedDataString = await AsyncStorage.getItem(`user_watched_${user.id}`);
      if (cachedDataString) {
        const cachedData = JSON.parse(cachedDataString);
        const { data, timestamp, stats, backgroundUrl } = cachedData;
        
        // Check if cache is still valid (within 30 minutes)
        const now = Date.now();
        if (now - timestamp < CACHE_EXPIRY) {
          console.log('[PROFILE] Using cached watched movies data');
          setWatchedMovies(data);
          setUserStats(stats);
          if (backgroundUrl) setBackgroundImage(backgroundUrl);
          if (stats.favoriteGenre) setFavoriteGenre(stats.favoriteGenre);
          setDataFetched(true);
          return true; // Cache was valid and used
        } else {
          console.log('[PROFILE] Cache expired, fetching fresh data');
        }
      } else {
        console.log('[PROFILE] No cache found, fetching fresh data');
      }
    } catch (error) {
      console.error('[PROFILE] Error loading cached data:', error);
    }
    return false; // Cache was not used
  }, [user]);
  
  // Cache the current data
  const cacheCurrentData = useCallback(async () => {
    if (!user || watchedMovies.length === 0) return;
    
    try {
      const cacheData = {
        data: watchedMovies,
        timestamp: Date.now(),
        stats: userStats,
        backgroundUrl: backgroundImage
      };
      
      await AsyncStorage.setItem(`user_watched_${user.id}`, JSON.stringify(cacheData));
      console.log('[PROFILE] Data cached successfully');
      
      // Set up cache expiry timeout
      if (cacheTimeoutRef.current) {
        clearTimeout(cacheTimeoutRef.current);
      }
      
      cacheTimeoutRef.current = setTimeout(() => {
        setDataFetched(false); // Reset fetch flag when cache expires
        console.log('[PROFILE] Cache expired, will fetch fresh data on next view');
      }, CACHE_EXPIRY);
      
    } catch (error) {
      console.error('[PROFILE] Error caching data:', error);
    }
  }, [user, watchedMovies, userStats, backgroundImage]);
  
  // Fetch watched movies directly from the watched_movies table
  const fetchWatchedMovies = useCallback(async () => {
    // Early return if no user or data already fetched or currently loading
    if (!user || dataFetched || isLoading) return;
    
    // Try to use cached data first
    try {
      const usedCache = await loadCachedData();
      if (usedCache) {
        setGenreLoading(false);
        return;
      }
      
      console.log('[PROFILE] Fetching watched movies from watched_movies table');
      setGenreLoading(true);
      
      const { data, error } = await supabase
        .from('watched_movies')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('[PROFILE] Error fetching watched movies:', error);
        setGenreLoading(false);
        return;
      }
      
      console.log(`[PROFILE] Found ${data?.length || 0} watched movies in the table`);
      setWatchedMovies(data || []);
      
      // Set a random movie as background if available and we don't already have one
      if (data && data.length > 0 && !backgroundImage) {
        const randomIndex = Math.floor(Math.random() * Math.min(5, data.length));
        const randomMovie = data[randomIndex];
        
        // Try to get backdrop from movie_data or movie
        let backdropPath = null;
        if (randomMovie.movie_data) {
          const movieData = typeof randomMovie.movie_data === 'string' 
            ? JSON.parse(randomMovie.movie_data) 
            : randomMovie.movie_data;
          backdropPath = movieData.backdrop_path;
        } else if (randomMovie.movie) {
          const movieObj = typeof randomMovie.movie === 'string'
            ? JSON.parse(randomMovie.movie)
            : randomMovie.movie;
          backdropPath = movieObj.backdrop_path;
        }
        
        if (backdropPath) {
          setBackgroundImage(tmdbService.getImageUrl(backdropPath, 'w1280'));
        }
      }
      
      // Calculate stats based on the fetched data
      calculateStats(data || []);
      setDataFetched(true); // Mark data as fetched to prevent multiple calls
      
      // Cache the fetched data
      setTimeout(() => cacheCurrentData(), 500); // Slight delay to ensure all state is updated
      
    } catch (error) {
      console.error('[PROFILE] Error in fetchWatchedMovies:', error);
      setGenreLoading(false);
    }
  }, [user, backgroundImage, dataFetched, loadCachedData, cacheCurrentData, isLoading]);
  
  // Load user data when the component mounts
  useEffect(() => {
    // Only perform data fetching if user is logged in
    if (user) {
      // Only call refreshUserData once if userData is missing
      if (!userData && !hasAttemptedRefreshRef.current) {
        console.log('[PROFILE] User exists but no userData, refreshing user data (first attempt)');
        hasAttemptedRefreshRef.current = true;
        refreshUserData();
      }
      
      // Only fetch watched movies if we haven't already or if it's a deliberate refresh
      if (!dataFetched) {
        fetchWatchedMovies();
      }
    }
    
    // Clean up cache timeout on unmount
    return () => {
      if (cacheTimeoutRef.current) {
        clearTimeout(cacheTimeoutRef.current);
      }
      // Reset the refresh attempt flag when component unmounts
      hasAttemptedRefreshRef.current = false;
    };
  }, [user, userData, refreshUserData, fetchWatchedMovies]);



  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    setDataFetched(false); // Reset the fetch flag to allow new data to be fetched
    
    // Clear the cache for this user to force fresh data
    try {
      await AsyncStorage.removeItem(`user_watched_${user?.id}`);
      console.log('[PROFILE] Cache cleared for refresh');
    } catch (error) {
      console.error('[PROFILE] Error clearing cache:', error);
    }
    
    // Reset the refresh attempt flag to allow refreshUserData to be called again
    hasAttemptedRefreshRef.current = false;
    
    // Explicitly refresh user data for pull-to-refresh
    await refreshUserData();
    await fetchWatchedMovies();
    setRefreshing(false);
  };

  // Set background image from user's watched movies - only run once when userData changes
  useEffect(() => {
    // Skip if we already have a background image or if we don't have watched movies
    if (backgroundImage || !userData?.watchedMovies || userData.watchedMovies.length === 0) {
      return;
    }
    
    const movies = userData.watchedMovies;
    const randomIndex = Math.floor(Math.random() * Math.min(5, movies.length));
    const randomMovie = movies[randomIndex];
    if (randomMovie.movie?.backdrop_path) {
      setBackgroundImage(tmdbService.getImageUrl(randomMovie.movie.backdrop_path, 'w1280'));
    }
  }, [userData, backgroundImage]);

  // Calculate stats from watched movies data
  const calculateStats = useCallback((watchedMoviesArray: any[]) => {
    setGenreLoading(true);
    
    if (!watchedMoviesArray || watchedMoviesArray.length === 0) {
      console.log('[PROFILE] No watched movies to calculate stats from');
      // Set default stats
      setUserStats({
        totalWatched: 0,
        totalGenres: 0,
        favoriteGenre: '',
        watchTime: 0
      });
      setFavoriteGenre(null);
      setGenreLoading(false);
      return;
    }

    try {
      console.log('[PROFILE] Processing watched movies for stats:', watchedMoviesArray.length);
      // Get actual watched movies count
      const watchedCount = watchedMoviesArray.length;
      
      // Extract unique genres from watched movies
      const genres = new Set<string>();
      const genreCounts: Record<string, number> = {};
      
      // Process watched movies to extract genres and calculate watch time
      let totalRuntime = 0;
      
      // Track unique movies by ID to avoid counting duplicates
      const processedMovieIds = new Set<number | string>();
      
      watchedMoviesArray.forEach((watchedMovie: any) => {
        // Handle different possible data structures
        let movie;
        let movieId: number | string | undefined;
        
        if (watchedMovie.movie_data) {
          movie = typeof watchedMovie.movie_data === 'string' 
            ? JSON.parse(watchedMovie.movie_data) 
            : watchedMovie.movie_data;
          movieId = movie?.id;
        } else if (watchedMovie.movie) {
          movie = typeof watchedMovie.movie === 'string'
            ? JSON.parse(watchedMovie.movie)
            : watchedMovie.movie;
          movieId = movie?.id;
        } else if (watchedMovie.movie_id) {
          // If we have a movie_id directly on the watched_movie record
          movieId = watchedMovie.movie_id;
          movie = watchedMovie;
        } else if (watchedMovie.id && watchedMovie.title) {
          // The watchedMovie itself is the movie object
          movie = watchedMovie;
          movieId = watchedMovie.id;
        }
        
        // Skip if we've already processed this movie
        if (movieId && processedMovieIds.has(movieId)) {
          return;
        }
        
        // Mark this movie as processed
        if (movieId) {
          processedMovieIds.add(movieId);
        }
        
        if (movie) {
          // Extract genres if available
          if (movie.genres && Array.isArray(movie.genres)) {
            movie.genres.forEach((genre: any) => {
              const genreName = typeof genre === 'string' ? genre : (genre.name || '');
              if (genreName) {
                genres.add(genreName);
                genreCounts[genreName] = (genreCounts[genreName] || 0) + 1;
              }
            });
          } else if (movie.genre_ids && Array.isArray(movie.genre_ids)) {
            // Handle genre_ids format which is common in TMDB API responses
            // Map common genre IDs to names
            const genreMap: Record<number, string> = {
              28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 
              80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
              14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
              9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
              10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western'
            };
            
            movie.genre_ids.forEach((genreId: number) => {
              const genreName = genreMap[genreId];
              if (genreName) {
                genres.add(genreName);
                genreCounts[genreName] = (genreCounts[genreName] || 0) + 1;
              }
            });
          }
          
          // Calculate runtime (default to 2 hours if not available)
          // Check different possible runtime properties
          let runtime = 0;
          if (movie.runtime && typeof movie.runtime === 'number') {
            runtime = movie.runtime;
          } else if (movie.duration && typeof movie.duration === 'number') {
            runtime = movie.duration;
          } else {
            // Default runtime if not available
            runtime = 120; // 2 hours per movie in minutes
          }
          
          console.log(`[PROFILE] Movie: ${movie.title || 'Unknown'}, Runtime: ${runtime} minutes, ID: ${movieId || 'unknown'}`);
          totalRuntime += runtime;
        }
      });
      
      // Find favorite genre
      let maxGenre = '';
      let maxCount = 0;
      
      Object.entries(genreCounts).forEach(([genre, count]) => {
        console.log(`[PROFILE] Genre: ${genre}, Count: ${count}`);
        if (count > maxCount) {
          maxCount = count;
          maxGenre = genre;
        }
      });
      
      // If we don't have a favorite genre, assign a random popular genre
      if (!maxGenre) {
        const popularGenres = ['Action', 'Comedy', 'Drama', 'Thriller', 'Romance', 'Horror', 'Science Fiction', 'Adventure'];
        maxGenre = popularGenres[Math.floor(Math.random() * popularGenres.length)];
        console.log(`[PROFILE] No favorite genre found, randomly assigned: ${maxGenre}`);
      }
      
      // Calculate watch time in hours
      // Use Math.round to get the nearest whole number
      const watchTimeHours = Math.round(totalRuntime / 60);
      
      // Log detailed stats for debugging
      console.log('[PROFILE] Stats calculated:', { 
        watchedCount, 
        uniqueMovies: processedMovieIds.size,
        genresCount: genres.size, 
        favoriteGenre: maxGenre, 
        watchTime: watchTimeHours,
        totalRuntimeMinutes: totalRuntime
      });
      
      setFavoriteGenre(maxGenre);
      setUserStats({
        totalWatched: processedMovieIds.size, // Use unique movie count instead of raw watched count
        totalGenres: genres.size > 0 ? genres.size : 0,
        favoriteGenre: maxGenre,
        watchTime: watchTimeHours // Convert minutes to hours
      });
    } catch (error) {
        console.error('Error calculating user stats:', error);
      } finally {
        setGenreLoading(false);
      }
  }, [userData?.watchedMovies]);

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      router.navigate('/login' as any);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  // Navigate to edit profile
  const handleEditProfile = () => {
    if (!user) return;
    router.navigate('/profile/edit' as any);
  };

  const handleWatchedMovies = () => {
    if (!user) return;
    router.navigate('/profile/watched' as any);
  };
  
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }, ]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <BlurView intensity={30} tint="dark" style={styles.loadingBlur}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>Loading your cinematic journey...</Text>
          </BlurView>
        </View>
      </View>
    );
  }
  
  if (!userData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.contentContainer}>
          <BlurView intensity={30} tint="dark" style={styles.signInContainer}>
            <Text style={[styles.signInTitle, { color: colors.text }]}>Sign in to access your profile</Text>
            <Text style={[styles.signInText, { color: colors.textSecondary }]}>Track your watched movies, join rooms, and more</Text>
            <TouchableOpacity
              style={[styles.signInButton, { backgroundColor: colors.primary }]}
              onPress={() => router.navigate('/login' as any)}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: false
        }}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        
      </View>
   
      
  
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Profile Header - Cinematic Style */}
        <View style={styles.profileHeaderContainer}>
          <View style={styles.avatarContainer}>
            <LinearGradient colors={['#FF5F6D', '#FFC371']} style={styles.avatarGradient}>
              {userData.avatar_url ? (
                <Image source={{ uri: userData.avatar_url }} style={styles.profileAvatar} />
              ) : (
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{userData.username?.charAt(0).toUpperCase() || '?'}</Text>
                </View>
              )}
            </LinearGradient>
            <View style={styles.avatarGloss} />
          </View>
          
          <BlurView intensity={20} tint="dark" style={styles.profileInfoBlur}>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]}>{userData.username}</Text>
              {userData.email && (
                <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{userData.email}</Text>
              )}
              <View style={styles.profileBadge}>
                <Text style={styles.profileBadgeText}>{userData.plan || 'Free User'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.editButton, { borderColor: colors.border }]}
              onPress={handleEditProfile}
            >
              <MaterialIcons name="edit" size={16} color={colors.text} />
              <Text style={[styles.editButtonText, { color: colors.text }]}>Edit</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
        
        {/* Stats Container - Centered and Smaller */}
        <View style={styles.statsContainer}>
          {/* Stats Row - Cinematic Style */}
          <View style={styles.statsRow}>
            <BlurView intensity={20} tint="dark" style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="film-outline" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{userStats.totalWatched}</Text>
              <Text style={styles.statLabel}>Movies Watched</Text>
              <View style={styles.cardGloss} />
            </BlurView>
            
            <BlurView intensity={20} tint="dark" style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="grid-outline" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{userStats.totalGenres}</Text>
              <Text style={styles.statLabel}>Genres Explored</Text>
              <View style={styles.cardGloss} />
            </BlurView>
            
            <BlurView intensity={20} tint="dark" style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="time-outline" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{userStats.watchTime}</Text>
              <Text style={styles.statLabel}>Hours Watched</Text>
              <View style={styles.cardGloss} />
            </BlurView>
          </View>
          
          {/* Favorite Genre Card - Cinematic Style */}
          <BlurView intensity={20} tint="dark" style={styles.favoriteGenreCard}>
            <View style={styles.favoriteGenreHeader}>
              <MaterialIcons name="emoji-events" size={20} color="#FFFFFF" />
              <Text style={styles.favoriteGenreTitle}>Favorite Genre</Text>
            </View>
            <Text style={styles.favoriteGenreValue}>
              {userStats.favoriteGenre || 'None'}
            </Text>
            <View style={styles.cardGloss} />
          </BlurView>
        </View>
        
        {/* Sign Out Button - Cinematic Style */}
        <TouchableOpacity
          style={[styles.signOutButton, { borderColor: 'rgba(255,255,255,0.2)' }]}
          onPress={handleSignOut}
        >
          <BlurView intensity={20} tint="dark" style={styles.signOutBlur}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
          </BlurView>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundImage: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: 300,
    top: 0,
    opacity: 0.8,
    zIndex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: 300,
    top: 0,
    zIndex: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBlur: {
    width: 200,
    height: 120,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(20,20,20,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    zIndex: 3, // Ensure scrollview is above background elements
  },
  contentContainer: {
    paddingTop: 180, // Increased to account for header height and background
    paddingBottom: 40,
    alignItems: 'center',
  },
  profileHeaderContainer: {
    width: '90%',
    alignItems: 'center',
    marginBottom: 40, // Increased margin to prevent overlapping
    marginTop: 20,
    zIndex: 5, // Higher z-index to ensure it's above background
  },
  statsContainer: {
    width: '85%',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  profileInfoBlur: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    paddingTop: 60, // Increased space for the larger avatar to overlap
    marginTop: -20,
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileHeaderBlur: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(20,20,20,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    position: 'absolute',
    top: -50, // Position half outside the container
    alignSelf: 'center',
    zIndex: 10,
    gap : 8
  },
  avatarGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  avatarGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.15)',
    zIndex: 2,
  },
  profileAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  profileBadge: {
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  profileBadgeText: {
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginTop : 8,
    borderWidth: 1,
  },
  editButtonText: {
    marginLeft: 4,
    fontWeight: '600',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    height: 120,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,30,30,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    position: 'relative',
    overflow: 'hidden',
    // Enhanced floating effect with white glow
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    marginHorizontal: 4,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding : 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.8)',
  },
  favoriteGenreCard: {
    width: '100%',
    marginBottom: 24,
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(30,30,30,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    position: 'relative',
    overflow: 'hidden',
    // Enhanced floating effect with white glow
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  favoriteGenreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  favoriteGenreTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#FFFFFF',
  },
  favoriteGenreValue: {
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 4,
    color: '#FFFFFF',
  },
  favoriteGenreDecoration: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  signOutButton: {
    marginHorizontal: 24,
    marginTop: 24,
    marginBottom: 40,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    width: '85%',
    alignSelf: 'center',
  },
  signOutBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    width: '100%',
  },
  signOutText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  signInBlurContainer: {
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(20,20,20,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  signInContainer: {
    padding: 30,
    alignItems: 'center',
  },
  avatarGlow: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FF5F6D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  signInTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  signInText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  signInButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
