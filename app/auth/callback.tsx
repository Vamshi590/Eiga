import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Dismiss the WebBrowser auth session on mobile
    if (Platform.OS !== 'web') {
      WebBrowser.dismissAuthSession();
    }

    // Simple redirect to login page
    // The login page will handle session check and appropriate redirects
    const redirectToLogin = () => {
      console.log('Redirecting from callback to login page');
      
      // If there was an error in the OAuth process, pass it along
      if (params.error) {
        router.replace({
          pathname: '/login',
          params: { error: params.error_description || 'Authentication failed' }
        });
        return;
      }
      
      // Otherwise just redirect to login which will handle the session
      router.replace('/login');
    };

    // Add a small delay to ensure WebBrowser has time to dismiss
    setTimeout(redirectToLogin, 500);
  }, [params, router]);


  return (
    <View style={styles.container}>
      {isProcessing ? (
        <>
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={styles.text}>Redirecting to login page...</Text>
          <Text style={styles.subText}>You'll be redirected to complete your profile if needed</Text>
        </>
      ) : error ? (
        <>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.text}>Redirecting to login...</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={styles.text}>Sign in successful! Redirecting...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
  },
  subText: {
    color: '#AAAAAA',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  errorText: {
    color: '#E50914',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
