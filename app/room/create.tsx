import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Clipboard, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Plan, PricingModal } from '../../components/PricingModal';
import { isOverLimit, PlanType } from '../../constants/subscriptionLimits';

import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useColorScheme } from '../../hooks/useColorScheme';
import { movieAvatarService } from '../../services/movieavatarservice';
import { roomService } from '../../services/roomservice';
import { supabase } from '../../services/supabase';

export default function CreateRoomScreen() {
  // ...existing hooks
  const [avatarLoadError, setAvatarLoadError] = useState<boolean[]>([]);

  // Handle avatar image load error
  const handleAvatarLoadError = (index: number) => {
    setAvatarLoadError(prev => {
      const updated = [...prev];
      updated[index] = true;
      return updated;
    });
  }
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();
  const { user, refreshUserData } = useAuth();
  
  const [roomName, setRoomName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatars, setAvatars] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [userPlan, setUserPlan] = useState<PlanType>('free');
  const [userRooms, setUserRooms] = useState<any[]>([]);
  const [pricingModalVisible, setPricingModalVisible] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  
  // Cache keys and expiry time
  const USER_ROOMS_CACHE_KEY = 'eiga_user_rooms_cache';
  const USER_PLAN_CACHE_KEY = 'eiga_user_plan_cache';
  const CACHE_EXPIRY = 1000 * 60 * 15; // 15 minutes cache expiry
  
  // Load movie avatars and fetch user data when component mounts
  useEffect(() => {
    // Get a selection of movie avatars
    const avatarSelection = movieAvatarService.getMovieAvatarSelection(12);
    setAvatars(avatarSelection);
    setAvatarLoadError(new Array(avatarSelection.length).fill(false));
    // Set a default selected avatar
    if (avatarSelection.length > 0) {
      setSelectedAvatar(avatarSelection[0]);
    }
    
    // Fetch user rooms and plan
    fetchUserRoomsAndPlan();
  }, []);
  
  // Load data from cache
  const loadFromCache = async (key: string) => {
    try {
      const cachedDataString = await AsyncStorage.getItem(`${key}_${user?.id}`);
      if (cachedDataString) {
        const { data, timestamp } = JSON.parse(cachedDataString);
        const now = Date.now();
        
        // Check if cache is still valid
        if (now - timestamp < CACHE_EXPIRY) {
          console.log(`Using cached ${key} data`);
          return data;
        } else {
          console.log(`${key} cache expired`);
        }
      }
    } catch (error) {
      console.error(`Error loading ${key} from cache:`, error);
    }
    return null;
  };
  
  // Save data to cache
  const saveToCache = async (key: string, data: any) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(`${key}_${user?.id}`, JSON.stringify(cacheData));
      console.log(`${key} data cached successfully`);
    } catch (error) {
      console.error(`Error caching ${key} data:`, error);
    }
  };
  
  // Fetch user rooms and subscription plan
  const fetchUserRoomsAndPlan = async () => {
    if (!user) return;
    setIsLoadingUserData(true);
    
    try {
      // Try to get rooms from cache first
      const cachedRooms = await loadFromCache(USER_ROOMS_CACHE_KEY);
      if (cachedRooms) {
        setUserRooms(cachedRooms);
      } else {
        // Fetch user rooms from API if not in cache
        console.log('Fetching user rooms from API');
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
        console.log('Fetching user plan from database');
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error('Error fetching user plan:', profileError);
        } else if (profileData && profileData.plan) {
          // Set the user's plan from the database
          const plan = profileData.plan as PlanType;
          setUserPlan(plan);
          // Cache the plan data
          saveToCache(USER_PLAN_CACHE_KEY, plan);
          console.log('User plan fetched:', plan);
        } else {
          // Default to free plan if no plan is specified
          setUserPlan('free');
          // Cache the default plan
          saveToCache(USER_PLAN_CACHE_KEY, 'free');
          console.log('No plan found, defaulting to free plan');
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoadingUserData(false);
    }
  };
  
  // Handle plan upgrade
  const handleUpgrade = (planName: string) => {
    // Here you would implement the actual upgrade logic
    console.log(`Upgrading to ${planName} plan`);
    setPricingModalVisible(false);
    Alert.alert('Upgrade Initiated', `You've selected the ${planName} plan. This feature will be available soon.`);
  };
  
  // Refresh avatars function
  const handleRefreshAvatars = () => {
    const newAvatars = movieAvatarService.getMovieAvatarSelection(12);
    setAvatars(newAvatars);
    setAvatarLoadError(new Array(newAvatars.length).fill(false));
    if (newAvatars.length > 0) {
      setSelectedAvatar(newAvatars[0]);
    }
  };
  
  // Share invite code function
  const shareInviteCode = async () => {
    try {
      await Share.share({
        message: `Join my movie room "${roomName}" on EIGA! Use invite code: ${inviteCode}`,
        title: 'Join my EIGA movie room!'
      });
    } catch (error) {
      console.error('Error sharing invite code:', error);
    }
  };

  // Copy invite code to clipboard
  const copyInviteCode = () => {
    Clipboard.setString(inviteCode);
    Alert.alert('Copied!', 'Invite code copied to clipboard');
  };

  const handleCreateRoom = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a room');
      return;
    }
    
    if (!roomName.trim()) {
      Alert.alert('Error', 'Please enter a room name');
      return;
    }
    
    // If we haven't loaded user data yet, fetch it now
    if (userRooms.length === 0 && !isLoadingUserData) {
      await fetchUserRoomsAndPlan();
    }
    
    // Check if user is over their room limit based on their plan
    if (isOverLimit(userPlan, 'rooms', userRooms.length)) {
      console.log(`User is over their room limit. Plan: ${userPlan}, Current rooms: ${userRooms.length}`);
      setPricingModalVisible(true);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Call createRoom with the required parameters including the selected avatar
      const roomData = await roomService.createRoom(user.id, roomName.trim(), selectedAvatar);
      
      if (roomData && roomData.id) {
        // Refresh user data to get updated rooms list
        await refreshUserData();
        
        // Save room id and invite code for the success modal
        setCreatedRoomId(roomData.id);
        setInviteCode(roomData.invite_code || '');
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      Alert.alert('Error', 'Failed to create room. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Create Room',
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.push('/explore')} style={{ paddingHorizontal: 16 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      
      {/* Success Modal */}
      {showSuccessModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }, Platform.OS === 'web' && styles.modalContainerWeb]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Room Created!</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.push('/explore' as any);
                }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalAvatarContainer}>
              <Image 
                source={{ uri: selectedAvatar }}
                style={styles.modalAvatar}
                contentFit="cover"
              />
            </View>
            
            <Text style={[styles.roomNameText, { color: colors.text }]}>{roomName}</Text>
            
            <View style={styles.inviteCodeContainer}>
              <Text style={[styles.inviteCodeLabel, { color: colors.icon }]}>Share this invite code with friends:</Text>
              <View style={[styles.inviteCodeBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.inviteCode, { color: colors.primary }]}>{inviteCode}</Text>
              </View>
              
              <View style={styles.shareButtonsRow}>
                <TouchableOpacity 
                  style={[styles.shareButton, { backgroundColor: colors.primary }]} 
                  onPress={copyInviteCode}
                >
                  <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.shareButtonText}>Copy Code</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.shareButton, { backgroundColor: colors.primary }]} 
                  onPress={shareInviteCode}
                >
                  <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.background }]} 
                onPress={() => {
                  setShowSuccessModal(false);
                  router.push('/rooms/' + createdRoomId as any);
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Go to Room</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.formSection}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Room Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
            value={roomName}
            onChangeText={setRoomName}
            placeholder="Enter room name"
            placeholderTextColor={colors.icon}
            maxLength={50}
          />
          
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Description</Text>
          <TextInput
            style={[styles.descriptionInput, { backgroundColor: colors.card, color: colors.text }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your room (optional)"
            placeholderTextColor={colors.icon}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={200}
          />
          
          <TouchableOpacity 
            style={styles.privacyToggle}
            onPress={() => setIsPrivate(!isPrivate)}
          >
            <View style={[
              styles.checkbox, 
              isPrivate ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.icon }
            ]}>
              {isPrivate && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </View>
            <Text style={[styles.privacyText, { color: colors.text }]}>Make this room private</Text>
          </TouchableOpacity>
          
          <Text style={[styles.privacyHint, { color: colors.icon }]}>
            {isPrivate 
              ? 'Private rooms are only visible to members you invite'
              : 'Public rooms can be discovered by other users'}
          </Text>
          
          {/* Avatar Selection Section */}
          <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 16 }]}>Room Avatar *</Text>
          <View style={styles.avatarHeader}>
            <Text style={[styles.avatarSubtitle, { color: colors.icon }]}>Choose a movie-themed avatar</Text>
            <TouchableOpacity onPress={handleRefreshAvatars}>
              <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.avatarGridContainer}>
            {avatars.length === 0 ? (
              <View style={{ alignItems: 'center', width: '100%' }}>
                <Image
                  source={{ uri: 'https://cdn.jsdelivr.net/gh/akabab/movie-icons/icons/film-reel.png' }}
                  style={[styles.avatar, { width: 60, height: 60 }]}
                  contentFit="cover"
                />
                <Text style={{ color: colors.icon, marginTop: 8 }}>No avatars available</Text>
              </View>
            ) : (
              avatars.map((avatar, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.avatarItem,
                    selectedAvatar === avatar && { borderColor: colors.primary, borderWidth: 3 }
                  ]}
                  onPress={() => setSelectedAvatar(avatar)}
                >
                  <Image
                    source={{ uri: avatarLoadError[index] ? 'https://cdn.jsdelivr.net/gh/akabab/movie-icons/icons/film-reel.png' : avatar }}
                    style={styles.avatar}
                    contentFit="cover"
                    onError={() => handleAvatarLoadError(index)}
                  />
                </TouchableOpacity>
              ))
            )}
          </View>
          
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={handleCreateRoom}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Create Room</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  descriptionInput: {
    height: 120,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  privacyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  privacyHint: {
    fontSize: 14,
    marginBottom: 24,
  },
  // Avatar selection styles
  avatarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarSubtitle: {
    fontSize: 14,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
  },
  avatarGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  avatarItem: {
    width: '6%',
    aspectRatio: 1,
    margin: '1%',
    borderRadius: 100, // Make container fully round
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 100, // Make image fully round
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 8,
    marginBottom: 32,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Success modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalContainerWeb: {
    maxWidth: 400,
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  modalAvatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  roomNameText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  inviteCodeContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  inviteCodeLabel: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  inviteCodeBox: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteCode: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
  },
  shareButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 120,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalFooter: {
    width: '100%',
    marginTop: 8,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
