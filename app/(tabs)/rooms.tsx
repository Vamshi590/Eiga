import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Plan, PricingModal } from '../../components/PricingModal';
import { Colors } from '../../constants/Colors';
import { isOverLimit, PlanType } from '../../constants/subscriptionLimits';
import { useColorScheme } from '../../hooks/useColorScheme';
import { authService } from '../../services/authService';
import { roomService } from '../../services/roomservice';
import { supabase } from '../../services/supabase';
import { Room } from '../../types';

export default function RoomsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  // Using router directly
  
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [filteredUserRooms, setFilteredUserRooms] = useState<Room[]>([]);
  const [filteredPublicRooms, setFilteredPublicRooms] = useState<Room[]>([]);
  const [userPlan, setUserPlan] = useState<PlanType>('free'); // Default to free plan
  const [pricingModalVisible, setPricingModalVisible] = useState(false);
  
  // Cache keys and expiry time
  const USER_ROOMS_CACHE_KEY = 'eiga_rooms_screen_user_rooms';
  const PUBLIC_ROOMS_CACHE_KEY = 'eiga_rooms_screen_public_rooms';
  const USER_PLAN_CACHE_KEY = 'eiga_rooms_plan_cache';
  const CACHE_EXPIRY = 1000 * 60 * 15; // 15 minutes cache expiry
  
  // Load user and rooms data
  useEffect(() => {
    loadData();
  }, []);
  
  // Filter rooms based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUserRooms(userRooms);
      setFilteredPublicRooms(publicRooms);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUserRooms(userRooms.filter(room => 
        room.name.toLowerCase().includes(query)
      ));
      setFilteredPublicRooms(publicRooms.filter(room => 
        room.name.toLowerCase().includes(query)
      ));
    }
  }, [searchQuery, userRooms, publicRooms]);
  

  
 
  
  // Clear cache
  const clearCache = async () => {
    if (!currentUser) return;
    
    try {
      await AsyncStorage.removeItem(`${USER_ROOMS_CACHE_KEY}_${currentUser.id}`);
      await AsyncStorage.removeItem(`${PUBLIC_ROOMS_CACHE_KEY}_${currentUser.id}`);
      console.log('[ROOMS] Cache cleared');
    } catch (error) {
      console.error('[ROOMS] Error clearing cache:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
      
      if (!user) {
        // Not logged in, show public rooms only
        const publicRoomsData = await roomService.getPublicRooms('', 10);
        setPublicRooms(publicRoomsData);
        setUserRooms([]);
      } else {
        // Try to get user rooms from cache first
        const cachedUserRooms = await loadFromCache(USER_ROOMS_CACHE_KEY);
        if (cachedUserRooms) {
          setUserRooms(cachedUserRooms);
        } else {
          // Fetch user rooms from API if not in cache
          console.log('[ROOMS] Fetching user rooms from API');
          const userRoomsData = await roomService.getUserRooms(user.id);
          setUserRooms(userRoomsData);
          // Cache the user rooms data
          saveToCache(USER_ROOMS_CACHE_KEY, userRoomsData);
        }
        
        // Try to get public rooms from cache first
        const cachedPublicRooms = await loadFromCache(PUBLIC_ROOMS_CACHE_KEY);
        if (cachedPublicRooms) {
          setPublicRooms(cachedPublicRooms);
        } else {
          // Fetch public rooms from API if not in cache
          console.log('[ROOMS] Fetching public rooms from API');
          const publicRoomsData = await roomService.getPublicRooms(user.id, 10);
          setPublicRooms(publicRoomsData);
          // Cache the public rooms data
          saveToCache(PUBLIC_ROOMS_CACHE_KEY, publicRoomsData);
        }
      }
    } catch (error) {
      console.error('[ROOMS] Error loading rooms data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    
    // Clear cache on refresh to get fresh data
    await clearCache();
    
    loadData();
  };
  
  // Load data from cache
  const loadFromCache = async (key: string) => {
    if (!currentUser) return null;
    
    try {
      const cachedDataString = await AsyncStorage.getItem(`${key}_${currentUser.id}`);
      if (cachedDataString) {
        const { data, timestamp } = JSON.parse(cachedDataString);
        const now = Date.now();
        
        // Check if cache is still valid
        if (now - timestamp < CACHE_EXPIRY) {
          console.log(`[ROOMS] Using cached ${key} data`);
          return data;
        } else {
          console.log(`[ROOMS] ${key} cache expired`);
        }
      }
    } catch (error) {
      console.error(`[ROOMS] Error loading ${key} from cache:`, error);
    }
    return null;
  };
  
  // Save data to cache
  const saveToCache = async (key: string, data: any) => {
    if (!currentUser) return;
    
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(`${key}_${currentUser.id}`, JSON.stringify(cacheData));
      console.log(`[ROOMS] ${key} data cached successfully`);
    } catch (error) {
      console.error(`[ROOMS] Error caching ${key} data:`, error);
    }
  };
  
  // Fetch user plan with caching
  const fetchUserPlan = async () => {
    if (!currentUser) {
      setUserPlan('free');
      return;
    }
    
    try {
      // Try to get plan from cache first
      const cachedPlan = await loadFromCache(USER_PLAN_CACHE_KEY);
      if (cachedPlan) {
        setUserPlan(cachedPlan as PlanType);
      } else {
        // Fetch user profile to get subscription plan if not in cache
        console.log('[ROOMS] Fetching user plan from database');
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', currentUser.id)
          .single();
        
        if (profileError) {
          console.error('[ROOMS] Error fetching user plan:', profileError);
        } else if (profileData && profileData.plan) {
          // Set the user's plan from the database
          const plan = profileData.plan as PlanType;
          setUserPlan(plan);
          // Cache the plan data
          saveToCache(USER_PLAN_CACHE_KEY, plan);
          console.log('[ROOMS] User plan fetched:', plan);
        } else {
          // Default to free plan if no plan is specified
          setUserPlan('free');
          // Cache the default plan
          saveToCache(USER_PLAN_CACHE_KEY, 'free');
          console.log('[ROOMS] No plan found, defaulting to free plan');
        }
      }
    } catch (error) {
      console.error('[ROOMS] Error fetching user plan:', error);
      setUserPlan('free');
    }
  };

  // Navigate to create room screen
  const handleCreateRoom = async () => {
    try {
      if (!currentUser) {
        Alert.alert('Sign In Required', 'You need to sign in to create a room');
        router.push('/login');
        return;
      }
      
      // Check if user has reached room limit based on their subscription plan
      if (isOverLimit(userPlan, 'rooms', userRooms.length)) {
        // Show pricing modal instead of alert
        setPricingModalVisible(true);
        return;
      }
      
      // Navigate to create room screen
      router.push('/room/create');
    } catch (error) {
      console.error('Error handling create room:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };
  
  // Handle plan upgrade
  const handleUpgrade = (planName: string) => {
    // Here you would implement the actual upgrade logic
    console.log(`Upgrading to ${planName} plan`);
    setPricingModalVisible(false);
    Alert.alert('Upgrade Initiated', `You've selected the ${planName} plan. This feature will be available soon.`);
  };
  
  // Navigate to room details
  const handleOpenRoom = (roomId: string) => {
    router.push(`/rooms/${roomId}`);
  };
  
  // Join a room with code
  const handleJoinRoom = () => {
    // Open join room modal
    setJoinModalVisible(true);
  };
  
  const handleJoinRoomSubmit = async () => {
    if (!roomCode.trim()) {
      Alert.alert('Error', 'Please enter a room code');
      return;
    }
    
    try {
      // Attempt to join the room with the provided code
      const joined = await roomService.joinRoomByCode(roomCode.trim());
      if (joined) {
        setJoinModalVisible(false);
        setRoomCode('');
        // Refresh rooms list
        loadData();
        Alert.alert('Success', 'You have joined the room successfully');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join room');
    }
  };
  
  // Get color from room name for consistent avatar background
  const getColorFromName = (name: string) => {
    const colors = ['#E50914', '#0077B5', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1', '#955251', '#B565A7', '#009B77', '#DD4124'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    return colors[hash % colors.length];
  };

  // Render user room item
  const renderUserRoomItem = ({ item }: { item: Room }) => (
    <TouchableOpacity
      style={styles.userRoomCard}
      onPress={() => handleOpenRoom(item.id)}
    >
      <View style={styles.userRoomContent}>
        {item.avatar ? (
          <Image
            source={{ uri: item.avatar }}
            style={styles.userRoomAvatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.userRoomAvatar, { backgroundColor: getColorFromName(item.name) }]}>
            <Text style={styles.roomAvatarText}>{item.name.substring(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.userRoomDetails}>
          <Text style={styles.userRoomName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.userRoomInfo}>
            <Text style={styles.userRoomMembers}>
              {Array.isArray(item.members) ? item.members.length : 0} {Array.isArray(item.members) && item.members.length === 1 ? 'member' : 'members'}
            </Text>
            <View style={styles.userRoomBadge}>
              <Text style={styles.userRoomBadgeText}>
                {item.movies?.length || 0} movies
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
  
  // Render public room item
  const renderPublicRoomItem = ({ item }: { item: Room }) => (
    <TouchableOpacity
      style={styles.publicRoomCard}
      onPress={() => handleOpenRoom(item.id)}
    >
      {item.avatar ? (
        <Image
          source={{ uri: item.avatar }}
          style={styles.publicRoomAvatar}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.publicRoomAvatar, { backgroundColor: getColorFromName(item.name) }]}>
          <Text style={styles.publicRoomAvatarText}>{item.name.substring(0, 2).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.publicRoomInfo}>
        <Text style={[styles.publicRoomName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.publicRoomMembers]}>
          {Array.isArray(item.members) ? item.members.length : 0} {Array.isArray(item.members) && item.members.length === 1 ? 'member' : 'members'}
        </Text>
        <View style={styles.publicRoomBadge}>
          <Text style={styles.publicRoomBadgeText}>
            {item.movies?.length || 0} movies
          </Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.joinButton}
        onPress={() => {
          // Set the room code to join and open the modal
          setRoomCode(item.invite_code || '');
          setJoinModalVisible(true);
        }}
      >
        <Text style={styles.joinButtonText}>Join</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
  
  // Empty state component
  const EmptyRooms = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="movie" size={64} color={colors.primary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Movie Rooms</Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        Create a room to start suggesting movies with friends
      </Text>
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: colors.primary }]}
        onPress={handleCreateRoom}
      >
        <Text style={styles.buttonText}>Create Room</Text>
      </TouchableOpacity>
    </View>
  );
  
  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Movie Rooms</Text>
          <TouchableOpacity style={styles.headerButton} onPress={handleJoinRoom}>
            <MaterialIcons name="qr-code-scanner" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading rooms...</Text>
        </View>
      </View>
    );
  }
  
  // Show sign-in screen if user is not logged in
  if (!currentUser) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Movie Rooms</Text>
        </View>
        <View style={styles.signInContainer}>
          <MaterialIcons name="movie" size={80} color={colors.primary} />
          <Text style={[styles.signInTitle, { color: colors.text }]}>Sign in to Eiga</Text>
          <Text style={[styles.signInText, { color: colors.textSecondary }]}>
            Sign in to create rooms, join existing rooms, and watch movies with friends
          </Text>
          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  // Define plans for pricing modal
  const plans: Plan[] = [
    {
      name: 'Free',
      price: '$0',
      description: 'Basic features for casual users',
      features: ['2 Movie Rooms', '5 Members per Room', '10 Movies per Room'],
      icon: 'film-outline',
      highlight: false,
      analogy: 'Like watching movies at home',
      cta: 'Current Plan'
    },
    {
      name: 'Pro',
      price: '$4.99/month',
      description: 'Enhanced features for movie enthusiasts',
      features: ['7 Movie Rooms', '20 Members per Room', '50 Movies per Room', 'Priority Support'],
      icon: 'star',
      highlight: true,
      analogy: 'Like having a private theater',
      cta: 'Upgrade Now'
    },
    {
      name: 'Cinephile',
      price: '$9.99/month',
      description: 'Ultimate experience for true film lovers',
      features: ['Unlimited Rooms', '100 Members per Room', 'Unlimited Movies', '24/7 Support', 'Early Access Features'],
      icon: 'trophy',
      highlight: false,
      analogy: 'Like owning a movie studio',
      cta: 'Go Ultimate'
    }
  ];
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PricingModal 
        visible={pricingModalVisible}
        onClose={() => setPricingModalVisible(false)}
        plans={plans}
        onUpgrade={handleUpgrade}
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Movie Rooms</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => {
            // Toggle search input visibility
            if (searchVisible && searchQuery) {
              setSearchQuery('');
            } else {
              setSearchVisible(!searchVisible);
            }
          }}>
            <Feather name={(searchVisible && searchQuery) ? "x" : "search"} size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleJoinRoom}>
            <MaterialIcons name="qr-code-scanner" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Search Input - Only visible when search is active */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search rooms..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
      )}
      
      {/* Join Room Modal */}
      <Modal
        visible={joinModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join Room</Text>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>Enter 6-character room code</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Room Code"
              placeholderTextColor="#999"
              value={roomCode}
              onChangeText={setRoomCode}
              maxLength={6}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleJoinRoomSubmit}
            >
              <Text style={styles.modalButtonText}>Join Room</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      <FlatList
        data={[] as any[]}
        keyExtractor={(item: any) => item.id}
        renderItem={() => null}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: searchVisible ? 60 : Platform.OS === 'ios' ? 100 : 80 }
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <>
            {/* User's Rooms Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Rooms</Text>
              <TouchableOpacity 
                style={styles.createRoomButton}
                onPress={handleCreateRoom}
              >
                <MaterialIcons name="add-circle" size={20} color={colors.primary} />
                <Text style={styles.createRoomText}>Create Room</Text>
              </TouchableOpacity>
            </View>
            
            {userRooms.length > 0 ? (
              <FlatList
                horizontal
                data={filteredUserRooms}
                keyExtractor={(item) => item.id}
                renderItem={renderUserRoomItem}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.userRoomsContainer}
                style={styles.userRoomsList}
              />
            ) : currentUser ? (
              <View style={styles.noRoomsContainer}>
                <Text style={[styles.noRoomsText, { color: colors.textSecondary }]}>
                  You haven't joined any rooms yet
                </Text>
                <TouchableOpacity 
                  style={[styles.createFirstRoomButton, { backgroundColor: colors.primary }]}
                  onPress={handleCreateRoom}
                >
                  <Text style={styles.createFirstRoomText}>Create Your First Room</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.noRoomsContainer}>
                <Text style={[styles.noRoomsText, { color: colors.textSecondary }]}>
                  Sign in to create and join rooms
                </Text>
                <TouchableOpacity 
                  style={[styles.createFirstRoomButton, { backgroundColor: colors.primary }]}
                  onPress={() => router.push('/login')}
                >
                  <Text style={styles.createFirstRoomText}>Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Discover Rooms Section - Only show if public rooms exist */}
            {publicRooms.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Discover Rooms</Text>
                </View>
                
                {filteredPublicRooms.length > 0 ? (
                  filteredPublicRooms.map((room) => renderPublicRoomItem({ item: room }))
                ) : (
                  <View style={styles.noPublicRoomsContainer}>
                    <Text style={[styles.noRoomsText, { color: colors.textSecondary }]}>
                      No matching public rooms found
                    </Text>
                  </View>
                )}
              </>
            )}
            
            {/* If no public rooms exist at all, don't show anything */}
          </>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }

      />
   
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: Platform.OS === 'ios' ? 90 : 70,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  searchInput: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 16,
  },
  contentContainer: {
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
    paddingBottom: 100,
    minHeight: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
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
  userRoomsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  userRoomsList: {
    marginBottom: 16,
  },
  userRoomCard: {
    width: 180,
    height: 220,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: '#000000',
    overflow: 'hidden',
    // Simple white shadow
    elevation: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  userRoomContent: {
    flex: 1,
    padding: 12,
    position: 'relative',
    zIndex: 1,
  },
  userRoomAvatar: {
    width: 90,
    height: 90,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'center',
  },
  roomAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userRoomDetails: {
    flex: 1,
    justifyContent: 'flex-start',
  },

  userRoomName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  userRoomInfo: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  userRoomMembers: {
    color: '#CCCCCC',
    fontSize: 12,
  },
  userRoomBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'center',
    backgroundColor: '#333333',
  },
  userRoomBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  publicRoomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#000000',
    // Simple white shadow
    elevation: 5,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    marginHorizontal: 16,
  },
  publicRoomAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
  },
  publicRoomAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  publicRoomInfo: {
    flex: 1,
    marginLeft: 12,
  },
  publicRoomName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  publicRoomMembers: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  publicRoomBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#333333',
  },
  publicRoomBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  joinButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 2,
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  noRoomsContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: 150,
  },
  noRoomsText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  createFirstRoomButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  createFirstRoomText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  noPublicRoomsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: Platform.OS === 'web' ? 350 : '100%',
    maxWidth: '90%',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalLabel: {
    color: '#CCCCCC',
    fontSize: 16,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 20,
  },
  modalButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Sign in UI styles
  signInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 90 : 70,
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
    lineHeight: 22,
  },
  signInButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
