import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useColorScheme } from '../../hooks/useColorScheme';
import { roomService } from '../../services/roomservice';

export default function JoinRoomScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();
  const { user, refreshUserData } = useAuth();
  
  const [roomCode, setRoomCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      Alert.alert('Error', 'Room code is required');
      return;
    }
    
    if (!user) {
      Alert.alert('Error', 'You must be signed in to join a room');
      router.push('/login');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const roomData = await roomService.joinRoom(user.id, roomCode.trim().toUpperCase());
      
      if (roomData) {
        // Refresh user data to get updated rooms list
        await refreshUserData();
        
        Alert.alert(
          'Success',
          'Room joined successfully',
          [
            {
              text: 'OK',
              onPress: () => router.push(`/rooms/${roomCode.trim().toUpperCase()}`),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error joining room:', error);
      Alert.alert('Error', 'Failed to join room. Please check the room code and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Join Room',
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="people-outline" size={64} color={colors.primary} />
        </View>
        
        <Text style={[styles.title, { color: colors.text }]}>
          Join a Movie Room
        </Text>
        
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          Enter the 6-character room code to join
        </Text>
        
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
          value={roomCode}
          onChangeText={setRoomCode}
          placeholder="Enter room code"
          placeholderTextColor={colors.icon}
          autoCapitalize="characters"
          maxLength={6}
        />
        
        <TouchableOpacity
          style={[styles.joinButton, { backgroundColor: colors.primary }]}
          onPress={handleJoinRoom}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="enter-outline" size={20} color="#FFFFFF" />
              <Text style={styles.joinButtonText}>Join Room</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 56,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 24,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 32,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
