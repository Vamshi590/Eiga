import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { User } from '../types';
import { generateAvatar } from './avatarService';
import { supabase } from './supabase';

// Constants for development mode
const MOCK_AUTH_KEY = 'eiga_mock_auth_user';
const DEV_MODE = process.env.NODE_ENV === 'development' || __DEV__;

// Type for Supabase session
type Session = {
  access_token: string;
  refresh_token: string;
  user: any;
  expires_at: number;
};

// Type for weak password response
type WeakPassword = {
  message: string;
  suggestions: string[];
};

// Auth service for handling user authentication and profile operations
export const authService = {
  // Get current user with complete profile data
  getCurrentUser: async (): Promise<User | null> => {
    try {
      // Check if we're in development mode and have a mock user
      if (DEV_MODE && Platform.OS !== 'web') {
        const mockUserJson = await AsyncStorage.getItem(MOCK_AUTH_KEY);
        if (mockUserJson) {
          const mockUser = JSON.parse(mockUserJson);
          console.log('Using mock user in getCurrentUser:', mockUser.email);
          
          // Get user profile data from profiles table
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', mockUser.id)
            .single();
            
          // Return user with profile data
          return {
            id: mockUser.id,
            email: mockUser.email || '',
            username: profile?.username || null, // Only use actual username, don't generate one
            avatar_url: profile?.avatar_url || null,
            avatar: profile?.avatar || profile?.avatar_url || '',
            phone: mockUser.phone || null,
            created_at: new Date(),
            watchedMovies: profile?.watched_movies || [],
            rooms: profile?.rooms || [],
            plan: profile?.plan || 'free',
            plan_period_end: profile?.plan_period_end || null
          };
        }
      }
      
      // Normal flow for production or web
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;
      
      // Get user profile data from profiles table
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      }
      
      // Return user with profile data
      return {
        id: user.id,
        email: user.email || '',
        username: profile?.username || null, // Only use actual username, don't generate one
        avatar_url: profile?.avatar_url || null,
        avatar: profile?.avatar || profile?.avatar_url || '',  // Ensure avatar field is populated
        phone: user.phone || null,
        created_at: user.created_at ? new Date(user.created_at) : new Date(),
        watchedMovies: profile?.watched_movies || [],
        rooms: profile?.rooms || [],
        plan: profile?.plan || 'free',
        plan_period_end: profile?.plan_period_end || null
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },
  
  // Sign in with email and password
  signInWithEmail: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error signing in with email:', error);
      throw error;
    }
  },
  
  // Sign up with email and password
  signUpWithEmail: async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });
      
      if (error) throw error;
      
      // Create profile entry
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username: name, // Use username instead of name to match User type
          avatar_url: null,
          plan: 'free',
          created_at: new Date().toISOString(),
        });
      }
      
      return data;
    } catch (error) {
      console.error('Error signing up with email:', error);
      throw error;
    }
  },
  
  // Check if user is logged in
  isLoggedIn: async (): Promise<boolean> => {
    try {
      // Check for mock user in development mode
      if (DEV_MODE && Platform.OS !== 'web') {
        const mockUserJson = await AsyncStorage.getItem(MOCK_AUTH_KEY);
        if (mockUserJson) {
          return true;
        }
      }
      
      // Normal flow
      const { data: { session } } = await supabase.auth.getSession();
      return !!session;
    } catch (error) {
      console.error('Error checking login status:', error);
      return false;
    }
  },

  // Sign in with Google OAuth
  signInWithGoogle: async () => {
    try {
      // For development mode, we can use a simulated Google sign-in
      if (DEV_MODE && Platform.OS !== 'web') {
        console.log('Using simulated Google authentication for development');
        
        // Check if we have a mock user already
        const mockUserJson = await AsyncStorage.getItem(MOCK_AUTH_KEY);
        
        if (mockUserJson) {
          // Return the existing mock user
          const mockUser = JSON.parse(mockUserJson);
          console.log('Using existing mock user:', mockUser.email);
          return { user: mockUser };
        } else {
          // Create a new mock user with a proper name
          const mockUserId = `mock-${Date.now()}`;
          const mockEmail = `dev-user-${Math.floor(Math.random() * 1000)}@example.com`;
          
          // Use realistic names for development testing
          const mockNames = [
            'John Smith',
            'Emma Johnson',
            'Michael Williams',
            'Sophia Brown',
            'Robert Jones',
            'Olivia Davis',
            'William Miller',
            'Ava Wilson',
            'James Taylor',
            'Isabella Anderson'
          ];
          const username = mockNames[Math.floor(Math.random() * mockNames.length)];
          const avatarUrl = generateAvatar(username);
          
          const mockUser = {
            id: mockUserId,
            email: mockEmail,
            user_metadata: {
              email: mockEmail,
              name: username,
              full_name: username,
              avatar_url: avatarUrl
            }
          };
          
          // Store the mock user
          await AsyncStorage.setItem(MOCK_AUTH_KEY, JSON.stringify(mockUser));
          
          // Create a profile for the mock user
          await authService.createUserProfile(mockUserId, username, avatarUrl);
          
          console.log('Created new mock user:', mockEmail);
          return { 
            user: mockUser,
            isNewUser: false // Set to false since we already created the profile
          };
        }
      }
      
      if (Platform.OS === 'web') {
        // For web, use Supabase's built-in OAuth flow
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: typeof window !== 'undefined' ? window.location.origin + '/login' : undefined,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent'
            }
          }
        });
        
        if (error) throw error;
        return data;
      } else {
        // For mobile, use in-app browser for OAuth
        const redirectUri = makeRedirectUri({
          scheme: 'eiga',
          path: 'auth/callback',
        });

        console.log('Using redirect URI:', redirectUri);

        // Clear any existing session
        await supabase.auth.signOut();

        // Start the OAuth flow
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUri,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent'
            },
            skipBrowserRedirect: true
          }
        });

        if (error) throw error;

        if (!data?.url) {
          throw new Error('No OAuth URL returned from Supabase');
        }

        console.log('Opening auth session with URL:', data.url);

        // Use WebBrowser.openAuthSessionAsync with proper configuration for in-app browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri,
          {
            showInRecents: true,
            dismissButtonStyle: 'cancel',
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
            enableDefaultShareMenuItem: false,
            enableBarCollapsing: true,
            showTitle: true,
            createTask: true
          }
        );

        console.log('Auth session result:', result.type);

        if (result.type === 'success') {
          // Extract the code from the redirect URL
          const url = result.url;
          // Handle the OAuth callback
          await supabase.auth.exchangeCodeForSession(url);
        }

        // Wait a moment for the session to be set
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Error getting session after auth:', sessionError);
          throw new Error('Authentication failed');
        }

        if (!session?.user) {
          throw new Error('No user found after authentication');
        }

        // Check if user profile exists
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        const isNewUser = profileError && profileError.code === 'PGRST116';
        const hasRandomUsername = profile && profile.username && profile.username.startsWith('user_') && profile.username.length > 6;
        
        // Get name from user metadata
        const fullName = session.user.user_metadata?.name || session.user.user_metadata?.full_name;
        console.log('DEBUG - authService - OAuth metadata name:', fullName);
        
        // Only use the name from Google OAuth, with a clean fallback if not available
        let username;
        if (fullName) {
          // Use the full name directly from Google
          username = fullName;
          console.log('DEBUG - authService - Using fullName as username:', username);
        } else if (session.user.email) {
          // If no name is available, use the email prefix but make it nicer
          const emailPrefix = session.user.email.split('@')[0];
          // Capitalize first letter and replace dots/underscores with spaces
          username = emailPrefix.charAt(0).toUpperCase() + 
                     emailPrefix.slice(1).replace(/[._]/g, ' ');
          console.log('DEBUG - authService - Using formatted email prefix as username:', username);
        } else {
          // Last resort fallback (should rarely happen)
          username = 'New User';
          console.log('DEBUG - authService - Using fallback username:', username);
        }
        
        // First, update the user metadata to ensure username is set correctly
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            username: username,
            preferred_username: username,
            name: username,
            full_name: username
          }
        });
        
        if (updateError) {
          console.error('DEBUG - authService - Error updating user metadata:', updateError);
        } else {
          console.log('DEBUG - authService - User metadata updated with username:', username);
        }

        if (isNewUser) {
          console.log('profileError', data);
          console.log('isNewUser', isNewUser);
          console.log('DEBUG - authService - OAuth User Data:', JSON.stringify(session.user, null, 2));
          console.log('DEBUG - authService - OAuth User Metadata:', JSON.stringify(session.user.user_metadata, null, 2));
          console.log('DEBUG - authService - OAuth App Metadata:', JSON.stringify(session.user.app_metadata, null, 2));
          console.log('DEBUG - authService - OAuth Identity Data:', JSON.stringify(session.user.identities, null, 2));
          
          // Get name from user metadata
          const fullName = session.user.user_metadata?.name || session.user.user_metadata?.full_name;
          console.log('DEBUG - authService - Extracted fullName:', fullName);
          
          // Only use the name from Google OAuth, with a clean fallback if not available
          let username;
          if (fullName) {
            // Use the full name directly from Google
            username = fullName;
            console.log('DEBUG - authService - Using fullName as username:', username);
          } else if (session.user.email) {
            // If no name is available, use the email prefix but make it nicer
            const emailPrefix = session.user.email.split('@')[0];
            // Capitalize first letter and replace dots/underscores with spaces
            username = emailPrefix.charAt(0).toUpperCase() + 
                       emailPrefix.slice(1).replace(/[._]/g, ' ');
            console.log('DEBUG - authService - Using formatted email prefix as username:', username);
          } else {
            // Last resort fallback (should rarely happen)
            username = 'New User';
            console.log('DEBUG - authService - Using fallback username:', username);
          }
          const avatarUrl = session.user.user_metadata?.avatar_url || generateAvatar(username);
          
          // First, update the user metadata to ensure username is set correctly
          const { error: updateError } = await supabase.auth.updateUser({
            data: {
              username: username,
              preferred_username: username,
              name: username,
              full_name: username
            }
          });
          
          if (updateError) {
            console.error('Error updating user metadata:', updateError);
          } else {
            console.log('DEBUG - User metadata updated successfully with username:', username);
          }

          console.log(username);
          
          // Then create the profile with the same username
          await authService.createUserProfile(session.user.id, username, avatarUrl);
        } else if (hasRandomUsername) {
          // If profile exists but has a random username, update it
          console.log('DEBUG - authService - Profile has random username:', profile.username);
          console.log('DEBUG - authService - Updating to proper username:', username);
          
          const avatarUrl = session.user.user_metadata?.avatar_url || generateAvatar(username);
          
          // Update the profile with the proper username
          const { error: updateProfileError } = await supabase
            .from('profiles')
            .update({
              username: username,
              avatar_url: avatarUrl
            })
            .eq('id', session.user.id);
          
          if (updateProfileError) {
            console.error('DEBUG - authService - Error updating profile username:', updateProfileError);
          } else {
            console.log('DEBUG - authService - Profile username updated successfully to:', username);
          }
        }

        return {
          user: session.user,
          isNewUser: isNewUser,
          userData: profile || null
        };
      }
    } catch (error) {
      console.error('Error in Google sign-in:', error);
      throw error;
    }
  },
  
  // Sign in with phone number (OTP)
  signInWithPhone: async (phone: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        phone,
      });
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error signing in with phone:', error);
      throw error;
    }
  },
  
  // Verify phone OTP
  verifyPhoneOtp: async (phone: string, otp: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });
      
      if (error) throw error;
      
      // Create profile if it doesn't exist
      if (data.user) {
        const username = `User-${data.user.id.substring(0, 6)}`;
        await authService.createUserProfile(data.user.id, username);
      }
      
      return data;
    } catch (error) {
      console.error('Error verifying phone OTP:', error);
      throw error;
    }
  },
  
  // Sign out
  signOut: async () => {
    try {
      // Check if we're in development mode
      if (DEV_MODE && Platform.OS !== 'web') {
        const mockUserJson = await AsyncStorage.getItem(MOCK_AUTH_KEY);
        if (mockUserJson) {
          console.log('Clearing mock user from AsyncStorage');
          await AsyncStorage.removeItem(MOCK_AUTH_KEY);
        }
      }
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },
  
  // Create user profile
  createUserProfile: async (userId: string, username: string, avatarUrl?: string) => {
    try {
      console.log('DEBUG - createUserProfile - Input parameters:');
      console.log('DEBUG - createUserProfile - userId:', userId);
      console.log('DEBUG - createUserProfile - username:', username);
      console.log('DEBUG - createUserProfile - avatarUrl:', avatarUrl);
      
      // Use provided avatar URL or generate one if not provided
      const finalAvatarUrl = avatarUrl || generateAvatar(username);
      
      // Create user profile in Supabase
      const userData = {
        id: userId,
        username: username,
        avatar_url: finalAvatarUrl,
        avatar: finalAvatarUrl,
        created_at: new Date().toISOString(),
        watched_movies: [],
        rooms: [],
        plan: 'free',
        plan_period_end: null
      };
      
      console.log('DEBUG - createUserProfile - userData being inserted:', userData);
      
      const { error } = await supabase
        .from('profiles')
        .insert(userData);
      
      if (error) throw error;
      
      // Update user metadata with comprehensive username fields
      // This ensures Supabase doesn't use its default generated username
      await supabase.auth.updateUser({
        data: {
          username: username,
          preferred_username: username,
          name: username,
          full_name: username,
          avatar_url: finalAvatarUrl,
        }
      });
      
      console.log('DEBUG - createUserProfile - Updated user metadata with username:', username);
      
      return userData;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  },

  // Update user profile
  updateUserProfile: async (userId: string, updates: Partial<User>) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: updates.username, // Using username instead of name to match the User type
          avatar_url: updates.avatar_url,
          avatar: updates.avatar || updates.avatar_url, // Ensure avatar field is updated too
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      
      if (error) throw error;
      
      return await authService.getCurrentUser();
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  },
  
  // Reset password
  resetPassword: async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? window.location.origin + '/reset-password' : undefined,
      });
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  },
  
  // Update password
  updatePassword: async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  },
  
  // Delete account
  deleteAccount: async () => {
    try {
      // Check if we're in development mode
      if (DEV_MODE && Platform.OS !== 'web') {
        const mockUserJson = await AsyncStorage.getItem(MOCK_AUTH_KEY);
        if (mockUserJson) {
          console.log('Clearing mock user from AsyncStorage');
          await AsyncStorage.removeItem(MOCK_AUTH_KEY);
          return true;
        }
      }
      
      // Get current user
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('No user found');
      
      // Delete user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);
      
      if (profileError) throw profileError;
      
      // Delete user authentication
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      
      if (error) throw error;
      
      // Sign out
      await authService.signOut();
      
      return true;
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }
};
