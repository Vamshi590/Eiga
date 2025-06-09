import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

// Initialize Supabase client
// For production: Replace these values with your actual Supabase URL and anon key
// 1. Go to https://supabase.com and create a new project
// 2. Get the URL and anon key from the project settings > API
// 3. Replace the values below
// 4. Set up Google OAuth in Supabase Auth settings
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://supabase-demo.co';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'demo-key';

// Note: For production, set these environment variables in your deployment environment
// or use a .env file with the expo-constants package

// Create a custom storage object for React Native
const customStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // Use SecureStore for native platforms
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error in customStorage.getItem:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Use SecureStore for native platforms
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Error in customStorage.setItem:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      // Use SecureStore for native platforms
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error in customStorage.removeItem:', error);
    }
  }
};

// Get the redirect URI for authentication
export const getRedirectUri = () => {
  if (Platform.OS === 'web') {
    // For web, use a default callback path since we can't access window in SSR
    return '/auth/web-callback';
  } else {
    // For mobile, use the deep link scheme with login path
    return Linking.createURL('/login');
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    storage: Platform.OS === 'web'
      ? {
          getItem: async (key: string) => {
            try {
              return await AsyncStorage.getItem(key);
            } catch (error) {
              console.error('Error getting item from storage:', error);
              return null;
            }
          },
          setItem: async (key: string, value: string) => {
            try {
              await AsyncStorage.setItem(key, value);
            } catch (error) {
              console.error('Error setting item in storage:', error);
            }
          },
          removeItem: async (key: string) => {
            try {
              await AsyncStorage.removeItem(key);
            } catch (error) {
              console.error('Error removing item from storage:', error);
            }
          }
        }
      : customStorage,
  }
});
