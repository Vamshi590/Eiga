import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { generateAvatar } from '../services/avatarService';
import { getRedirectUri, supabase, supabaseUrl } from '../services/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  userData?: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<any>;
  checkGoogleSignIn: () => Promise<boolean>;
  signInWithPhone: (phone: string) => Promise<any>;
  verifyOtp: (phone: string, otp: string) => Promise<any>;
  refreshUserData: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [session, setSession] = useState<Session | null>(null);
  
  // Cache control
  const PROFILE_CACHE_KEY = 'eiga_user_profile_cache';
  const CACHE_EXPIRY = 1000 * 60 * 30; // 30 minutes cache expiry
  
  // Debounce control for refreshUserData
  const isRefreshingRef = useRef(false);
  const lastRefreshTimeRef = useRef(0);
  const REFRESH_COOLDOWN = 2000; // 2 seconds cooldown between refreshes

  useEffect(() => {
    // Check for active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      // Clear cache before signing out
      if (user?.id) {
        await clearProfileCache(user.id);
      }
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setUserData(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      // Check if we're in development mode with placeholder Supabase URL
      // Default to development mode if supabaseUrl is not defined or is the demo URL
      const isDevelopment = !supabaseUrl || supabaseUrl === 'https://supabase-demo.co';

      if (isDevelopment) {
        console.log('Using mock Google authentication for development');

        // Create a mock user for development purposes
        const mockUser = {
          id: 'google-user-' + Math.floor(Math.random() * 1000),
          email: 'user@example.com',
          user_metadata: {
            full_name: 'Demo User',
            avatar_url: 'https://i.pravatar.cc/150?u=' + Math.random(),
            username: 'demouser' + Math.floor(Math.random() * 100)
          }
        };

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Store the mock user in AsyncStorage to simulate persistence
        await AsyncStorage.setItem('supabase.auth.token', JSON.stringify({
          currentSession: {
            access_token: 'mock-token-' + Date.now(),
            user: mockUser
          }
        }));

        return {
          user: mockUser,
          isNewUser: false,
          userData: {
            id: mockUser.id,
            username: mockUser.user_metadata.username,
            avatar_url: mockUser.user_metadata.avatar_url,
            email: mockUser.email,
            watched_movies: [],
            rooms: []
          }
        };
      } else {
        // PRODUCTION MODE: Use actual Supabase OAuth
        console.log('Using Supabase Google OAuth for production');

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
          console.log('Opening auth session in WebBrowser');
          
          // Get the redirect URI from our helper function
          const redirectUri = getRedirectUri();
          console.log('Using redirect URI:', redirectUri);
          
          // Open the OAuth flow in the in-app browser
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: redirectUri, // getRedirectUri now returns /login path directly
              skipBrowserRedirect: true,
              queryParams: {
                access_type: 'offline',
                prompt: 'consent'
              }
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
              toolbarColor: '#ffffff',
              createTask: true,
              controlsColor: '#000000'
            }
          );

          console.log('Auth session result:', result.type);

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

          // Check if user exists in profiles
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          // If profile doesn't exist, create one using Google OAuth name
          if (profileError && profileError.code === 'PGRST116') {
            // DEBUG: Log all user metadata from Google OAuth
            console.log('DEBUG - OAuth User Data:', JSON.stringify(session.user, null, 2));
            console.log('DEBUG - OAuth User Metadata:', JSON.stringify(session.user.user_metadata, null, 2));
            console.log('DEBUG - OAuth App Metadata:', JSON.stringify(session.user.app_metadata, null, 2));
            console.log('DEBUG - OAuth Identity Data:', JSON.stringify(session.user.identities, null, 2));
            
            // Get name from user metadata
            const fullName = session.user.user_metadata?.name || session.user.user_metadata?.full_name;
            console.log('DEBUG - Extracted fullName:', fullName);
            
            // Only use the name from Google OAuth, with a clean fallback if not available
            let username;
            if (fullName) {
              // Use the full name directly from Google
              username = fullName;
              console.log('DEBUG - Using fullName as username:', username);
            } else if (session.user.email) {
              // If no name is available, use the email prefix but make it nicer
              const emailPrefix = session.user.email.split('@')[0];
              // Capitalize first letter and replace dots/underscores with spaces
              username = emailPrefix.charAt(0).toUpperCase() + 
                         emailPrefix.slice(1).replace(/[._]/g, ' ');
              console.log('DEBUG - Using formatted email prefix as username:', username);
            } else {
              // Last resort fallback (should rarely happen)
              username = 'New User';
              console.log('DEBUG - Using fallback username:', username);
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
            }
            
            // Then create the profile with the same username
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                username: username,
                avatar_url: avatarUrl,
                email: session.user.email
              })
              .select()
              .single();
            
            if (createError) {
              console.error('Error creating profile:', createError);
              throw createError;
            }
            
            // Return with the newly created profile
            return {
              user: session.user,
              isNewUser: false, // Set to false since we created the profile
              userData: newProfile
            };
          } else if (profileError) {
            throw profileError;
          }

          // Check if the profile has a random username (starts with 'user_' followed by random characters)
          if (profile.username && profile.username.startsWith('user_') && profile.username.length > 6) {
            console.log('Profile has a random username:', profile.username);
            
            // Get name from user metadata
            const fullName = session.user.user_metadata?.name || session.user.user_metadata?.full_name;
            console.log('OAuth metadata name:', fullName);
            
            // Only use the name from Google OAuth, with a clean fallback if not available
            let username;
            if (fullName) {
              // Use the full name directly from Google
              username = fullName;
              console.log('Using fullName as username:', username);
            } else if (session.user.email) {
              // If no name is available, use the email prefix but make it nicer
              const emailPrefix = session.user.email.split('@')[0];
              // Capitalize first letter and replace dots/underscores with spaces
              username = emailPrefix.charAt(0).toUpperCase() + 
                         emailPrefix.slice(1).replace(/[._]/g, ' ');
              console.log('Using formatted email prefix as username:', username);
            } else {
              // Last resort fallback (should rarely happen)
              username = 'New User';
              console.log('Using fallback username:', username);
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
              console.error('Error updating user metadata:', updateError);
            } else {
              console.log('User metadata updated with username:', username);
            }
            
            // Update the profile with the proper username
            const { data: updatedProfile, error: updateProfileError } = await supabase
              .from('profiles')
              .update({ username: username })
              .eq('id', session.user.id)
              .select()
              .single();
            
            if (updateProfileError) {
              console.error('Error updating profile username:', updateProfileError);
              // Return the original profile if update fails
              return {
                user: session.user,
                isNewUser: false,
                userData: profile
              };
            } else {
              console.log('Profile username updated successfully to:', username);
              // Return the updated profile
              return {
                user: session.user,
                isNewUser: false,
                userData: updatedProfile
              };
            }
          }
          
          // Return success with existing user data (if username was not random)
          return {
            user: session.user,
            isNewUser: false,
            userData: profile
          };
        }
      }
    } catch (error) {
      console.error('Error in Google sign-in:', error);
      throw error;
    }
  };

  // Check for Google sign-in completion
  const checkGoogleSignIn = async () => {
    try {
      console.log('Checking for Google sign-in completion');

      // Refresh the session
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (data.session) {
        console.log('Valid session found');
        setSession(data.session);
        setUser(data.session.user);
        
  
     
        
        return true;
      } else {
        console.log('No session found');
        return false;
      }
    } catch (error) {
      console.error('Error checking Google sign-in:', error);
      return false;
    }
  };

  // Sign in with phone
  const signInWithPhone = async (phone: string) => {
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
  };

  // Verify OTP
  const verifyOtp = async (phone: string, otp: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
  };

  // Try to load profile from cache
  const loadProfileFromCache = async (userId: string) => {
    try {
      const cachedProfileString = await AsyncStorage.getItem(`${PROFILE_CACHE_KEY}_${userId}`);
      if (cachedProfileString) {
        const { profile, timestamp } = JSON.parse(cachedProfileString);
        const now = Date.now();
        
        // Check if cache is still valid (within expiry time)
        if (now - timestamp < CACHE_EXPIRY) {
          console.log('Using cached profile data');
          return profile;
        } else {
          console.log('Profile cache expired');
        }
      }
    } catch (error) {
      console.error('Error loading profile from cache:', error);
    }
    return null;
  };

  // Save profile to cache
  const saveProfileToCache = async (userId: string, profile: any) => {
    try {
      const cacheData = {
        profile,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(`${PROFILE_CACHE_KEY}_${userId}`, JSON.stringify(cacheData));
      console.log('Profile data cached successfully');
    } catch (error) {
      console.error('Error caching profile data:', error);
    }
  };

  // Clear profile cache
  const clearProfileCache = async (userId: string) => {
    try {
      await AsyncStorage.removeItem(`${PROFILE_CACHE_KEY}_${userId}`);
      console.log('Profile cache cleared');
    } catch (error) {
      console.error('Error clearing profile cache:', error);
    }
  };

  // Refresh user data from auth and profile
  const refreshUserData = async () => {
    // Implement debouncing to prevent excessive calls
    const now = Date.now();
    if (isRefreshingRef.current || (now - lastRefreshTimeRef.current < REFRESH_COOLDOWN)) {
      console.log('Skipping refreshUserData - already refreshing or too soon');
      return;
    }
    
    // Set refreshing state
    isRefreshingRef.current = true;
    lastRefreshTimeRef.current = now;
    
    try {
      // Get current session
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        
        // IMPORTANT: Check if we're on the login or username page
        // If so, don't try to create or fetch profiles - let those pages handle it
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        if (currentPath.includes('/login') || currentPath.includes('/username')) {
          console.log('On login/username page - skipping profile operations');
          isRefreshingRef.current = false;
          return;
        }
        
        // Try to get profile from cache first
        const cachedProfile = await loadProfileFromCache(data.session.user.id);
        if (cachedProfile) {
          setUserData(cachedProfile);
          isRefreshingRef.current = false;
          return; // Use cached data and exit early
        }
        
        // If no cache or expired, fetch from database
        console.log('Fetching profile from database');
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();
        
        if (profileError) {
          if (profileError.code === 'PGRST116') {
            // No profile found - DO NOT CREATE ONE
            console.log('No profile exists for user - will need username setup');
            // Set minimal user data without a profile
            setUserData({
              id: data.session.user.id,
              email: data.session.user.email,
              avatar_url: data.session.user.user_metadata?.avatar_url || null,
              // Set a flag to indicate this is not a complete profile
              isPartialProfile: true
            });
          } else {
            console.error('Error fetching user profile:', profileError);
          }
        } else if (profileData) {
          console.log('User profile data fetched successfully');
          
          // Check if this is a complete profile with a username
          if (!profileData.username) {
            console.log('Profile exists but has no username - user needs to complete setup');
            // Don't modify the profile - let the username page handle it
            setUserData({
              ...profileData,
              isPartialProfile: true
            });
          } else {
            // Process complete profile data
            console.log('Profile data keys:', Object.keys(profileData));
            
            // Check for both watched_movies (snake_case) and watchedMovies (camelCase)
            // This ensures we're handling the correct field name based on database schema
            if (profileData.watched_movies !== undefined && !profileData.watchedMovies) {
              console.log('Found watched_movies (snake_case) in profile data');
              // Ensure it's an array
              if (!Array.isArray(profileData.watched_movies)) {
                try {
                  if (typeof profileData.watched_movies === 'string') {
                    profileData.watched_movies = JSON.parse(profileData.watched_movies);
                  }
                  if (!Array.isArray(profileData.watched_movies)) {
                    profileData.watched_movies = [];
                  }
                } catch (e) {
                  console.error('Error parsing watched_movies:', e);
                  profileData.watched_movies = [];
                }
              }
              
              // Add camelCase version for consistency in the app
              profileData.watchedMovies = profileData.watched_movies;
            } else if (profileData.watchedMovies !== undefined) {
              console.log('Found watchedMovies (camelCase) in profile data');
              // Ensure it's an array
              if (!Array.isArray(profileData.watchedMovies)) {
                try {
                  if (typeof profileData.watchedMovies === 'string') {
                    profileData.watchedMovies = JSON.parse(profileData.watchedMovies);
                  }
                  if (!Array.isArray(profileData.watchedMovies)) {
                    profileData.watchedMovies = [];
                  }
                } catch (e) {
                  console.error('Error parsing watchedMovies:', e);
                  profileData.watchedMovies = [];
                }
              }
              
              // Add snake_case version for consistency in the app
              profileData.watched_movies = profileData.watchedMovies;
            } else {
              // Neither field exists, initialize both
              console.log('No watched movies field found, initializing empty arrays');
              profileData.watchedMovies = [];
              profileData.watched_movies = [];
            }
            
            setUserData(profileData);
            // Cache the profile data
            saveProfileToCache(data.session.user.id, profileData);
            console.log('User data set with watched movies:', 
              Array.isArray(profileData.watchedMovies) ? profileData.watchedMovies.length : 'not an array');
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    } finally {
      // Reset refreshing state
      isRefreshingRef.current = false;
    }
  };

  const value = {
    session,
    user,
    userData,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    checkGoogleSignIn,
    signInWithPhone,
    verifyOtp,
    refreshUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
