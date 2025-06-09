import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import { authService } from '../services/authService';
import { movieAvatarService } from '../services/movieavatarservice';

export default function UsernameScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [avatars, setAvatars] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Check if user is authenticated and redirect if they already have a profile
  useEffect(() => {
    checkUserStatus();
  }, []);
  
  // Generate avatars when component mounts
  useEffect(() => {
    generateAvatars();
  }, []);
  
  // Check if user is authenticated and has a profile
  const checkUserStatus = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user && user.username) {
        // User already has a profile, redirect to main app
        router.replace('/(tabs)/explore');
      }
    } catch (error) {
      console.error('Error checking user status:', error);
    }
  };
  
  // Generate movie-themed avatars for selection
  const generateAvatars = () => {
    // Get 6 random movie avatars
    const avatarUrls = movieAvatarService.getMovieAvatarSelection(6);
    setAvatars(avatarUrls);
    setSelectedAvatar(avatarUrls[0]);
  };
  
  // Handle username and avatar creation
  const handleCreateProfile = async () => {
    if (!username || username.trim().length < 3) {
      Alert.alert('Invalid Username', 'Username must be at least 3 characters long');
      return;
    }
    
    if (!selectedAvatar) {
      Alert.alert('Avatar Required', 'Please select an avatar');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get current user
      const user = await authService.getCurrentUser();
      
      if (!user) {
        Alert.alert('Error', 'User not found. Please log in again.');
        router.replace('/login');
        return;
      }
      
      // Create user profile with username and selected avatar
      await authService.createUserProfile(user.id, username, selectedAvatar);
      
      // Navigate to main app
      router.replace('/(tabs)/explore');
    } catch (error) {
      console.error('Create Profile Error:', error);
      Alert.alert('Profile Creation Failed', 'Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Create Profile',
          headerShown: false,
        }}
      />
      
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Welcome to EIGA</Text>
          <Text style={[styles.subtitle, { color: colors.icon }]}>
            Create your profile to start sharing movie recommendations
          </Text>
        </View>
        
        {/* Username Input */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.text }]}>Username</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder="Enter a unique username"
            placeholderTextColor={colors.icon}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
        </View>
        
        {/* Avatar Selection */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarHeader}>
            <Text style={[styles.label, { color: colors.text }]}>Choose Your Avatar</Text>
            <TouchableOpacity onPress={generateAvatars}>
              <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh Options</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.avatarGridContainer}>
            {avatars.map((item, index) => (
              <TouchableOpacity
                key={`avatar-${index}`}
                style={[
                  styles.avatarItem,
                  selectedAvatar === item && { 
                    borderColor: colors.primary,
                    borderWidth: 2,
                  }
                ]}
                onPress={() => setSelectedAvatar(item)}
              >
                <Image
                  source={{ uri: item }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Create Profile Button */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleCreateProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Continue to EIGA</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: '80%',
  },
  inputContainer: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  avatarSection: {
    marginBottom: 32,
  },
  avatarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
  },
  avatarGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarItem: {
    width: '16%', // Smaller avatars (was 20%)
    aspectRatio: 1,
    margin: '2%',
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});


