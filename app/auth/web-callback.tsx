import { useEffect, useState } from 'react';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function WebAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    // Add a small delay to ensure any browser state is settled
    const timer = setTimeout(() => {
      console.log('Web auth callback handler running');
      console.log('URL params:', JSON.stringify(params));
      
      // If there was an error in the OAuth process, pass it along
      if (params.error) {
        console.error('OAuth error:', params.error);
        router.replace({
          pathname: '/login',
          params: { error: params.error_description || 'Authentication failed' }
        });
        return;
      }
      
      // Otherwise redirect to login page which will now handle profile creation and session
      console.log('Redirecting to login page to handle authentication and profile creation');
      router.replace('/login');
      setIsProcessing(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [params, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#E50914" />
      <Text style={styles.text}>Redirecting to login page...</Text>
      <Text style={styles.subText}>You'll be redirected to complete your profile if needed</Text>
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
});
