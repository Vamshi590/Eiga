import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Keyboard, Modal, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useColorScheme } from '../../hooks/useColorScheme';

// Helper function to generate consistent colors from room names
const getColorFromName = (name: string): string => {
  const colors = [
    '#E50914', '#0077B6', '#588157', '#6A4C93', '#F4A261', 
    '#E76F51', '#2A9D8F', '#E9C46A', '#264653', '#023E8A'
  ];
  
  // Simple hash function to get consistent color for the same name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use the hash to pick a color
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

import { MovieRow } from '../../components/MovieRow';
import { PricingModal } from '../../components/PricingModal';
import { isOverLimit, PlanType } from '../../constants/subscriptionLimits';
import { roomService } from '../../services/roomservice';
import { supabase } from '../../services/supabase';
import { GENRES, PROVIDERS, tmdbService } from '../../services/tmdbapi';
import { Room } from '../../types';

interface Movie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  overview?: string;
}

// Define streaming providers with their logos and names
interface StreamingProvider {
  id: number;
  name: string;
  logo: string;
  color: string;
}

const streamingProviders: StreamingProvider[] = [
  { id: PROVIDERS.NETFLIX, name: 'Netflix', logo: 'https://cdn4.iconfinder.com/data/icons/logos-and-brands/512/227_Netflix_logo-512.png', color: '#E50914' },
  { id: PROVIDERS.AMAZON_PRIME, name: 'Prime Video', logo: 'https://exchange4media.gumlet.io/news-photo/119975-big2.jpg', color: '#00A8E1' },
  { id: PROVIDERS.DISNEY_PLUS, name: 'Disney+', logo: 'https://platform.theverge.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/25357066/Disney__Logo_March_2024.png?quality=90&strip=all&crop=7.8125,0,84.375,100', color: '#113CCF' },
  { id: PROVIDERS.JIOCINEMA, name: 'JioCinema', logo: 'https://my24hrshop.com/storage/2023/07/jio-cinema.png', color: '#D90E55' },
  { id: PROVIDERS.HOTSTAR, name: 'Hotstar', logo: 'https://secure-media.hotstar.com/web-assets/prod/images/Disney+Hotstar-logo.svg', color: '#1F80E0' },
  { id: PROVIDERS.APPLE_TV, name: 'Apple TV+', logo: 'https://cdn-icons-png.flaticon.com/512/5968/5968613.png', color: '#124D45' },
  { id: PROVIDERS.ZEE5, name: 'ZEE5', logo: 'https://cdn6.aptoide.com/imgs/5/1/7/51713cb38f60e82562305d5639a26c2a_icon.png', color: '#8230C6' },
];

// Define movie genres to display
interface Genre {
  id: number;
  name: string;
}

const movieGenres: Genre[] = [
  { id: GENRES.ACTION, name: 'Action' },
  { id: GENRES.COMEDY, name: 'Comedy' },
  { id: GENRES.DRAMA, name: 'Drama' },
  { id: GENRES.THRILLER, name: 'Thriller' },
  { id: GENRES.HORROR, name: 'Horror' },
  { id: GENRES.ROMANCE, name: 'Romance' },
  { id: GENRES.SCIENCE_FICTION, name: 'Sci-Fi' },
];

export default function ExploreScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const colors = Colors[colorScheme ?? 'dark'];
  
  // State variables
  const [selectedProvider, setSelectedProvider] = useState<StreamingProvider>(streamingProviders[0]);
  const [genreMovies, setGenreMovies] = useState<{[key: number]: Movie[]}>({});
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [userPlan, setUserPlan] = useState<PlanType>('free'); // Default to free plan
  
  // Cache control
  const USER_ROOMS_CACHE_KEY = 'eiga_explore_rooms_cache';
  const USER_PLAN_CACHE_KEY = 'eiga_explore_plan_cache';
  const CACHE_EXPIRY = 1000 * 60 * 15; // 15 minutes cache expiry
  
  // Search functionality
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const searchAnimation = useRef(new Animated.Value(0)).current;
  
  // Join Room Modal
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  
  // Pricing Modal
  const [pricingModalVisible, setPricingModalVisible] = useState(false);

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
          console.log(`[EXPLORE] Using cached ${key} data`);
          return data;
        } else {
          console.log(`[EXPLORE] ${key} cache expired`);
        }
      }
    } catch (error) {
      console.error(`[EXPLORE] Error loading ${key} from cache:`, error);
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
      console.log(`[EXPLORE] ${key} data cached successfully`);
    } catch (error) {
      console.error(`[EXPLORE] Error caching ${key} data:`, error);
    }
  };
  
  // Fetch user rooms with caching
  const fetchUserRooms = async () => {
    if (!user) {
      setUserRooms([]);
      return;
    }
    
    setLoadingRooms(true);
    
    try {
      // Try to get rooms from cache first
      const cachedRooms = await loadFromCache(USER_ROOMS_CACHE_KEY);
      if (cachedRooms) {
        setUserRooms(cachedRooms);
      } else {
        // Fetch user rooms from API if not in cache
        console.log('[EXPLORE] Fetching user rooms from API');
        const rooms = await roomService.getUserRooms(user.id);
        setUserRooms(rooms);
        // Cache the rooms data
        saveToCache(USER_ROOMS_CACHE_KEY, rooms);
      }
      
      // Try to get plan from cache first
      const cachedPlan = await loadFromCache(USER_PLAN_CACHE_KEY);
      if (cachedPlan) {
        setUserPlan(cachedPlan as PlanType);
      } else {
        // Fetch user profile to get subscription plan if not in cache
        console.log('[EXPLORE] Fetching user plan from database');
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error('[EXPLORE] Error fetching user plan:', profileError);
        } else if (profileData && profileData.plan) {
          // Set the user's plan from the database
          const plan = profileData.plan as PlanType;
          setUserPlan(plan);
          // Cache the plan data
          saveToCache(USER_PLAN_CACHE_KEY, plan);
          console.log('[EXPLORE] User plan fetched:', plan);
        } else {
          // Default to free plan if no plan is specified
          setUserPlan('free');
          // Cache the default plan
          saveToCache(USER_PLAN_CACHE_KEY, 'free');
          console.log('[EXPLORE] No plan found, defaulting to free plan');
        }
      }
    } catch (error) {
      console.error('[EXPLORE] Error fetching user data:', error);
    } finally {
      setLoadingRooms(false);
    }
  };
  
  const fetchMovies = async () => {
    try {
      setLoading(true);
      
      // Fetch trending movies
      const trending = await tmdbService.getTrendingMovies();
      setTrendingMovies(trending);
      
      // Fetch movies by selected provider and genres
      await fetchMoviesByProviderAndGenres(selectedProvider.id);
      
      // Fetch user rooms
      await fetchUserRooms();
    } catch (error) {
      console.error('Error fetching movies:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Fetch movies by provider and genres
  const fetchMoviesByProviderAndGenres = async (providerId: number) => {
    try {
      const genreMoviesData: {[key: number]: Movie[]} = {};
      
      // Fetch movies for each genre from the selected provider
      await Promise.all(movieGenres.map(async (genre) => {
        const movies = await tmdbService.getMoviesByProviderAndGenre(providerId, genre.id);
        genreMoviesData[genre.id] = movies;
      }));
      
      setGenreMovies(genreMoviesData);
    } catch (error) {
      console.error('Error fetching movies by provider and genres:', error);
    }
  };
  
  // This is now handled by the cached fetchUserRooms function above

  useEffect(() => {
    fetchMovies();
  }, []);

  // Handle provider selection
  const handleProviderSelect = (provider: StreamingProvider) => {
    setSelectedProvider(provider);
    fetchMoviesByProviderAndGenres(provider.id);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    
    // Clear cache on refresh to get fresh data
    if (user) {
      try {
        await AsyncStorage.removeItem(`${USER_ROOMS_CACHE_KEY}_${user.id}`);
        await AsyncStorage.removeItem(`${USER_PLAN_CACHE_KEY}_${user.id}`);
        console.log('[EXPLORE] Cache cleared for refresh');
      } catch (error) {
        console.error('[EXPLORE] Error clearing cache:', error);
      }
    }
    
    fetchMovies();
  };

  const handleMoviePress = (movieId: number) => {
    // Navigate to movie details page
    router.push(`/movies/${movieId}`);
  };

  const handleSearchPress = () => {
    setIsSearchActive(true);
    Animated.timing(searchAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false
    }).start(() => {
      searchInputRef.current?.focus();
    });
  };
  
  const handleCloseSearch = () => {
    Keyboard.dismiss();
    Animated.timing(searchAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false
    }).start(() => {
      setIsSearchActive(false);
      setSearchQuery('');
      setSearchResults([]);
    });
  };
  
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    
    if (text.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    
    try {
      setIsSearching(true);
      const response = await tmdbService.searchMovies(text);
      setSearchResults(response.results.slice(0, 15)); // Limit to 15 results for better performance
    } catch (error) {
      console.error('Error searching movies:', error);
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleJoinRoom = () => {
    setJoinModalVisible(true);
  };

  const handleJoinRoomSubmit = async () => {
    if (!roomCode.trim()) {
      Alert.alert('Error', 'Please enter a room code');
      return;
    }
    
    try {
      setLoadingRooms(true);
      if (!user) {
        Alert.alert('Error', 'You must be logged in to join a room');
        return;
      }

      const joinedRoom = await roomService.joinRoom(user.id, roomCode.trim());
      if (joinedRoom) {
        setJoinModalVisible(false);
        setRoomCode('');
        // Add the joined room to the list if not already there
        if (!userRooms.some(room => room.id === joinedRoom.id)) {
          setUserRooms([...userRooms, joinedRoom]);
        }
        // Navigate to the room
        router.push(`/rooms/${joinedRoom.id}`);
      }
    } catch (error) {
      console.error('Error joining room:', error);
      Alert.alert('Error', 'Failed to join room. Please check the room code and try again.');
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleCreateRoom = async () => {
    try {
      if (!user) {
        // Redirect to login page instead of showing an alert
        router.push('/login');
        return;
      }
      
      // Check if user has reached room limit based on their subscription plan
      if (isOverLimit(userPlan, 'rooms', userRooms.length)) {
        // Show pricing modal instead of creating a new room
        setPricingModalVisible(true);
        return;
      }

      // Navigate to the create room screen instead of creating a room directly
      router.push('/room/create');
    } catch (error) {
      console.error('Error navigating to create room:', error);
    }
  };
  
  // Handle plan upgrade
  const handleUpgrade = (planName: string) => {
    // Here you would implement the actual upgrade logic
    console.log(`Upgrading to ${planName} plan`);
    setPricingModalVisible(false);
    Alert.alert('Upgrade Initiated', `You've selected the ${planName} plan. This feature will be available soon.`);
  };

  const handleRoomPress = (roomId: string) => {
    // Navigate to room details page
    router.push(`/rooms/${roomId}`);
  };

  // Render provider item
  const renderProviderItem = ({ item }: { item: StreamingProvider }) => {
    const isSelected = selectedProvider.id === item.id;
    
    return (
      <TouchableOpacity
        style={[styles.providerItem, isSelected && { borderColor: item.color, borderWidth: 2 }]}
        onPress={() => handleProviderSelect(item)}
      >
        <View style={[styles.providerNameContainer, { backgroundColor: item.color }]}>
          <Text style={styles.providerName}>{item.name}</Text>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Render movie item
  const renderMovieItem = ({ item }: { item: Movie }) => (
    <TouchableOpacity
      style={styles.movieItem}
      onPress={() => handleMoviePress(item.id)}
    >
      <Image
        source={{ uri: item.poster_path ? tmdbService.getImageUrl(item.poster_path) : 'https://via.placeholder.com/150x225?text=No+Image' }}
        style={styles.moviePoster}
        contentFit="cover"
      />
      <Text style={styles.movieTitle} numberOfLines={1}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
  
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E50914" />
        <Text style={styles.loadingText}>Loading movies...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#E50914"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Feather name="film" size={24} color="#E50914" style={styles.logoIcon} />
            <Text style={styles.logo}>EIGA</Text>
          </View>
          
          {!isSearchActive ? (
            <TouchableOpacity onPress={handleSearchPress} style={styles.searchButton}>
              <Feather name="search" size={24} color="white" />
            </TouchableOpacity>
          ) : (
            <Animated.View style={[styles.searchInputContainer, {
              width: searchAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '85%']
              })
            }]}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search movies..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={handleSearch}
              />
              <TouchableOpacity onPress={handleCloseSearch} style={styles.closeSearchButton}>
                <Feather name="x" size={20} color="white" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
        
        {/* Search Results */}
        {isSearchActive && searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <Text style={styles.searchResultsTitle}>Search Results</Text>
            {isSearching ? (
              <ActivityIndicator color="#E50914" size="large" style={styles.searchingIndicator} />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.searchResultItem}
                    onPress={() => handleMoviePress(item.id)}
                  >
                    <Image
                      source={{ uri: item.poster_path ? tmdbService.getImageUrl(item.poster_path) : 'https://via.placeholder.com/92x138?text=No+Image' }}
                      style={styles.searchResultImage}
                      contentFit="cover"
                    />
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultTitle} numberOfLines={1}>{item.title}</Text>
                      <View style={styles.searchResultMetadata}>
                        {item.release_date && (
                          <Text style={styles.searchResultYear}>
                            {new Date(item.release_date).getFullYear()}
                          </Text>
                        )}
                        <View style={styles.searchResultRating}>
                          <Ionicons name="star" size={14} color="#FFD700" />
                          <Text style={styles.searchResultRatingText}>
                            {item.vote_average?.toFixed(1)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                style={styles.searchResultsList}
              />
            )}
          </View>
        )}

      

        <View style={styles.contentContainer}>
          {/* User Rooms Section */}
          <View style={styles.roomsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Rooms</Text>
              <TouchableOpacity onPress={handleJoinRoom} style={styles.createRoomButton}>
                <Feather name="log-in" size={16} color="#E50914" />
                <Text style={styles.createRoomText}>Join Room</Text>
              </TouchableOpacity>
            </View>
            
            {loadingRooms ? (
              <ActivityIndicator color="#E50914" size="small" />
            ) : userRooms.length > 0 ? (
              <FlatList
                horizontal
                data={[{ id: 'create-room', name: 'Create Room', isCreateCard: true, members: [] } as any, ...userRooms]}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  // TypeScript cast to handle the create room card
                  const roomItem = item as any;
                  if (roomItem.isCreateCard) {
                    // Create Room Card
                    return (
                      <TouchableOpacity 
                        style={styles.createRoomCard}
                        onPress={handleCreateRoom}
                      >
                        <View style={styles.createRoomAvatar}>
                          <Feather name="plus" size={32} color="#E50914" />
                        </View>
                        <Text style={styles.roomName}>Create Room</Text>
                      </TouchableOpacity>
                    );
                  }
                  
                  // Regular Room Card
                  return (
                    <TouchableOpacity 
                      style={styles.roomCard}
                      onPress={() => handleRoomPress(item.id)}
                    >
                      <View style={styles.roomAvatar}>
                        {item.avatar ? (
                          <Image 
                            source={{ uri: item.avatar }}
                            style={{ width: '100%', height: '100%', borderRadius: 12 }}
                            contentFit="cover"
                          />
                        ) : (
                          // Fallback avatar with room initial and random background color
                          <View style={[styles.fallbackAvatar, { backgroundColor: getColorFromName(item.name) }]}>
                            <Text style={styles.roomAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.roomMembers}>{item.members ? item.members.length : 0} members</Text>
                    </TouchableOpacity>
                  );
                }}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.roomsContainer}
              />
            ) : (
              <View style={styles.noRoomsContainer}>
                <Text style={styles.noRoomsText}>You haven't joined any rooms yet</Text>
                <TouchableOpacity 
                  style={styles.createFirstRoomButton}
                  onPress={handleCreateRoom}
                >
                  <Text style={styles.createFirstRoomText}>Create your first room</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {/* Trending Movies */}
          <MovieRow 
            title="Trending Now"
            movies={trendingMovies}
            onMoviePress={handleMoviePress}
            size="medium"
          />

            {/* Streaming Providers Horizontal List */}
        <View style={styles.providersSection}>
          <Text style={styles.sectionTitle}>Streaming Services</Text>
          <FlatList
            data={streamingProviders}
            renderItem={renderProviderItem}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.providersContainer}
          />
        </View>
          
          {/* Genre-based Movies for Selected Provider */}
          {movieGenres.map((genre) => (
            genreMovies[genre.id] && genreMovies[genre.id].length > 0 && (
              <MovieRow 
                key={genre.id}
                title={`${genre.name} Movies in ${selectedProvider?.name || 'All Platforms'}`}
                movies={genreMovies[genre.id]}
                onMoviePress={handleMoviePress}
                size="medium"
              />
            )
          ))}
        </View>
      </ScrollView>
      
      {/* Join Room Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={joinModalVisible}
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join a Room</Text>
            <Text style={styles.modalSubtitle}>Enter the room code to join</Text>
            
            <TextInput
              style={styles.roomCodeInput}
              placeholder="Enter room code"
              placeholderTextColor="#999"
              value={roomCode}
              onChangeText={setRoomCode}
              autoCapitalize="none"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => {
                  setJoinModalVisible(false);
                  setRoomCode('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalJoinButton}
                onPress={handleJoinRoomSubmit}
              >
                <Text style={styles.modalJoinButtonText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Pricing Modal */}
      <PricingModal
        visible={pricingModalVisible}
        onClose={() => setPricingModalVisible(false)}
        plans={[
          {
            name: 'Free',
            price: '$0',
            description: 'Basic features for casual users',
            features: [
              'Create up to 2 rooms',
              'Up to 5 members per room',
              'Up to 10 movies per room'
            ],
            icon: 'film-outline',
            highlight: false,
            analogy: 'Like watching a trailer',
            cta: 'Current Plan'
          },
          {
            name: 'Pro',
            price: '$4.99/month',
            description: 'Enhanced features for movie enthusiasts',
            features: [
              'Create up to 7 rooms',
              'Up to 20 members per room',
              'Up to 50 movies per room',
              'Priority support'
            ],
            icon: 'star',
            highlight: true,
            analogy: 'Like having a VIP theater pass',
            cta: 'Upgrade Now'
          },
          {
            name: 'Cinephile',
            price: '$9.99/month',
            description: 'Ultimate experience for true movie lovers',
            features: [
              'Create unlimited rooms',
              'Up to 100 members per room',
              'Unlimited movies per room',
              'Advanced analytics',
              'Early access to new features'
            ],
            icon: 'videocam',
            highlight: false,
            analogy: 'Like having your own private cinema',
            cta: 'Choose Plan'
          }
        ]}
        onUpgrade={handleUpgrade}
      />
    </View>
  );
};

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    marginRight: 6,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E50914',
  },
  searchButton: {
    padding: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    paddingVertical: 8,
    paddingRight: 8,
  },
  closeSearchButton: {
    padding: 4,
  },
  searchResultsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 12,
    maxHeight: 500,
  },
  searchResultsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  searchResultsList: {
    maxHeight: 450,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchResultImage: {
    width: 46,
    height: 69,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  searchResultMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultYear: {
    color: '#bbb',
    fontSize: 14,
    marginRight: 12,
  },
  searchResultRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultRatingText: {
    color: '#bbb',
    fontSize: 14,
    marginLeft: 4,
  },
  searchingIndicator: {
    marginTop: 20,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  providersSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  providersContainer: {
    paddingVertical: 8,
  },
  providerItem: {
    marginRight: 12,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 12,
  },
  providerNameContainer: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#fff',
  },
  movieItem: {
    width: 120,
    marginRight: 10,
  },
  moviePoster: {
    width: 120,
    height: 180,
    borderRadius: 8,
  },
  movieTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  
  featuredContainer: {
    height: 550,
    width: '100%',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    justifyContent: 'flex-end',
    padding: 16,
  },
  featuredTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  featuredOverview: {
    color: '#CCCCCC',
    fontSize: 14,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  playButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginRight: 12,
  },
  playButtonText: {
    color: '#000000',
    fontWeight: '600',
    marginLeft: 4,
  },
  infoButton: {
    backgroundColor: 'rgba(109, 109, 110, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  infoButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  rowsContainer: {
    marginTop: 20,
  },
  roomsSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  createRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  createRoomText: {
    color: '#E50914',
    marginLeft: 4,
    fontWeight: '600',
    fontSize: 14,
  },
  roomsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  roomCard: {
    width: 120,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    padding: 8,
  },
  createRoomCard: {
    width: 120,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E50914',
    borderRadius: 12,
    padding: 8,
    borderStyle: 'dashed',
  },
  roomAvatar: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  createRoomAvatar: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
 
  },
  fallbackAvatar: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  roomAvatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  roomName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  roomMembers: {
    color: '#9BA1A6',
    fontSize: 12,
    textAlign: 'center',
  },
  roomsLoadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomsLoadingText: {
    color: '#9BA1A6',
    marginTop: 8,
  },
  noRoomsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  noRoomsText: {
    color: '#9BA1A6',
    fontSize: 14,
    marginBottom: 12,
  },
  createFirstRoomButton: {
    backgroundColor: '#E50914',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  createFirstRoomText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#ddd',
    fontSize: 15,
    marginBottom: 20,
    textAlign: 'center',
  },
  roomCodeInput: {
    backgroundColor: '#333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    padding: 12,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#555',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#444',
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  modalJoinButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E50914',
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  modalJoinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
