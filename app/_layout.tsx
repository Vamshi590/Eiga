import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { supabase } from '../services/supabase';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Set up deep link handler for authentication
  useEffect(() => {
    // Handle deep links when the app is already open
    const handleDeepLink = async (event: { url: string }) => {
      console.log('Deep link received:', event.url);
      
      if (event.url.includes('auth/callback')) {
        console.log('Auth callback URL detected');
        
        // Get the session to see if we're authenticated
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session) {
          console.log('Valid session found after deep link');
          // Navigate to home screen on successful auth
          router.replace('/');
        } else if (error) {
          console.error('Error getting session:', error);
          router.replace('/login');
        }
      }
    };
    
    // Add event listener for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Check for initial URL (app opened via deep link)
    const getInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('App opened with URL:', initialUrl);
        handleDeepLink({ url: initialUrl });
      }
    };
    
    getInitialURL();
    
    // Clean up
    return () => {
      subscription.remove();
    };
  }, [router]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
