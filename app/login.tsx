import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { generateAvatar } from '../services/avatarService';
import { supabase } from '../services/supabase';

export default function LoginScreen() {
  // We'll use Stack.Screen options to hide the header instead of router.setParams
  const { signInWithGoogle, checkGoogleSignIn, signInWithPhone, verifyOtp } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleSignInInProgress, setGoogleSignInInProgress] = useState(false);
  
  // Check for error params from OAuth callback
  useEffect(() => {
    if (params.error) {
      setError(params.error as string);
    }
  }, [params]);
  
  // Check if user is already authenticated and ensure profile exists before redirecting
  useEffect(() => {
    const checkUserAndRedirect = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log('User is authenticated, checking profile');
          
          // Check if profile exists
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
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
          
          // First update the user metadata to ensure username is set correctly
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
          
          // If no profile exists, create one with proper username from Google OAuth
          if (profileError && profileError.code === 'PGRST116') {
            console.log('No profile found, creating one with Google OAuth name');
            
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
            
            // First update the user metadata to ensure username is set correctly
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
            
            // Create the profile with the proper username
            const avatarUrl = session.user.user_metadata?.avatar_url || generateAvatar(username);
            await authService.createUserProfile(session.user.id, username, avatarUrl);
            console.log('Profile created with username:', username);
          } else if (profile) {
            console.log('User profile exists:', profile.username);
            
            // Check if the profile has a random username (starts with 'user_' followed by random characters)
            if (profile.username && profile.username.startsWith('user_') && profile.username.length > 6) {
              console.log('Profile has a random username, updating to:', username);
              
              // Update the profile with the proper username
              const { error: updateProfileError } = await supabase
                .from('profiles')
                .update({ username: username })
                .eq('id', session.user.id);
              
              if (updateProfileError) {
                console.error('Error updating profile username:', updateProfileError);
              } else {
                console.log('Profile username updated successfully to:', username);
              }
            }
          }
          
          // Now redirect to explore
          console.log('Redirecting to explore');
          router.replace('/explore');
          return;
        }
      } catch (error) {
        console.error('Error checking user status:', error);
      }
    };
    
    checkUserAndRedirect();
  }, [router]);

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      setGoogleSignInInProgress(false);
      
      console.log('Initiating Google sign-in');
      
      // Attempt to sign in with Google
      const result = await signInWithGoogle();
      console.log('Sign in result:', result ? 'Success' : 'No result');
      
      // For web, the page will redirect, so we won't reach this point
      // For mobile, we need to handle the result
      if (Platform.OS !== 'web') {
        if (result?.user) {
          console.log('Sign-in successful, user obtained:', result.user.id);
          // Always redirect to explore since profiles are created automatically
          console.log('Redirecting to explore');
          router.replace('/explore');
        } else {
          console.log('No user yet, checking status');
          setGoogleSignInInProgress(true);
          
          // Try to check if sign-in completed
          const signInCompleted = await checkGoogleSignIn();
          if (!signInCompleted) {
            setGoogleSignInInProgress(false);
          } else {
            // User is signed in, redirect to explore
            console.log('Sign-in completed, redirecting to explore');
            router.replace('/explore');
          }
        }
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      setError(error.message || 'Failed to sign in with Google');
      setGoogleSignInInProgress(false);
      setLoading(false);
    }
  };
  
  // Check if Google sign-in is completed
  const handleCheckGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Checking if Google sign-in is completed');
      const success = await checkGoogleSignIn();
      
      if (success) {
        console.log('Google sign-in completed successfully');
        // Since we're automatically creating profiles, always redirect to explore
        router.replace('/explore');
      } else {
        console.log('Google sign-in not completed');
        setError('Google sign-in not completed. Please try again.');
        setGoogleSignInInProgress(false);
      }
    } catch (error: any) {
      console.error('Error checking Google sign-in:', error);
      setError(error.message || 'Failed to check Google sign-in status');
      setGoogleSignInInProgress(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignIn = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a valid phone number');
      return;
    }

    // Format the phone number to ensure it has the international format
    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      // Add India country code if not present
      formattedPhone = '+91' + formattedPhone;
    }

    try {
      setLoading(true);
      setError('');
      await signInWithPhone(formattedPhone);
      setPhoneNumber(formattedPhone); // Save the formatted number
      setOtpSent(true);
    } catch (error: any) {
      setError(error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setError('Please enter the verification code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Verify the OTP
      await verifyOtp(phoneNumber, otp);
      
      console.log('Phone verification successful, checking user status');
      
      // After verification, explicitly check the user's status
      const currentUser = await authService.getCurrentUser();
      
      if (!currentUser) {
        console.error('Failed to get user after verification');
        setError('Verification successful but failed to get user data');
        return;
      }
      
      console.log('User retrieved after verification:', currentUser?.id);
      
      // Check if this is a new user (no username means new user)
      if (!currentUser.username) {
        // New user without a username, redirect to username screen
        console.log('New user detected, redirecting to username screen');
        router.replace('/username');
      } else {
        // Existing user, redirect to explore
        console.log('Existing user detected, redirecting to explore');
        router.replace('/(tabs)/explore');
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      setError(error.message || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      {/* Hide the header */}
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.9)']}
        style={styles.container}
      >
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/images/logo.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>EIGA</Text>
          <Text style={styles.tagline}>Where every frame tells your story</Text>
          
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!otpSent ? (
            <>
              <Input
                label="Phone Number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Enter your phone number (e.g., +919876543210)"
                keyboardType="phone-pad"
              />
              <Text style={styles.helperText}>
                Please include country code (e.g., +91 for India)
              </Text>
              <Button 
                title="Continue" 
                onPress={handlePhoneSignIn} 
                loading={loading}
                disabled={!phoneNumber.trim()}
              />
            </>
          ) : (
            <>
              <Input
                label="Verification Code"
                value={otp}
                onChangeText={setOtp}
                placeholder="Enter the OTP sent to your phone"
                keyboardType="numeric"
              />
              <Button 
                title="Verify" 
                onPress={handleVerifyOtp} 
                loading={loading}
                disabled={!otp.trim()}
              />
              <TouchableOpacity 
                style={styles.resendLink}
                onPress={handlePhoneSignIn}
                disabled={loading}
              >
                <Text style={styles.resendText}>Resend Code</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          {!googleSignInInProgress ? (
            <Button 
              title="Sign in with Google" 
              onPress={handleGoogleSignIn}
              loading={loading}
              variant="outline"
              style={styles.googleButton}
              textStyle={styles.googleButtonText}
            />
          ) : (
            <>
              <Text style={styles.infoText}>
                Please complete sign-in in your browser and return to the app
              </Text>
              <Button 
                title="I've completed sign-in" 
                onPress={handleCheckGoogleSignIn}
                loading={loading}
                variant="primary"
                style={styles.completedButton}
              />
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By signing in, you agree to our Terms and Privacy Policy
            </Text>
          </View>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    marginBottom: 40,
  },
  logo: {
    width: 180,
    height: 80,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#E50914',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorText: {
    color: '#E50914',
    marginBottom: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#333333',
  },
  dividerText: {
    color: '#8c8c8c',
    paddingHorizontal: 10,
  },
  googleButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  googleButtonText: {
    color: '#FFFFFF',
  },
  resendLink: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 16,
  },
  resendText: {
    color: '#E50914',
    fontSize: 14,
  },
  helperText: {
    color: '#8c8c8c',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
  },
  footer: {
    marginTop: 24,
  },
  footerText: {
    color: '#8c8c8c',
    fontSize: 12,
    textAlign: 'center',
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  completedButton: {
    marginBottom: 16,
    backgroundColor: '#E50914',
  },
});
