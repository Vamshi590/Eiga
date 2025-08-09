import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { SwipeableMovieCard } from '../../components/SwipeableMovieCard';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { tmdbService } from '../../services/tmdbapi';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;
const SWIPE_UP_THRESHOLD = height * 0.2;
const CARD_HEIGHT = height * 0.85; // Taller card to fill most of the screen

// Define types for our movie and action
type Movie = {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  release_date?: string;
  genre_ids?: number[];
};

type SwipeAction = 'watched' | 'notInterested' | 'bucketList' | null;

// Define styles at the top level to avoid reference errors
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noMoviesText: {
    fontSize: 18,
    marginVertical: 16,
    textAlign: 'center',
  },
  endDeckText: {
    fontSize: 18,
    marginVertical: 16,
    textAlign: 'center',
  },
  header: {
    padding: 15,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 10,
    marginTop: -20,
  },
  cardWrapper: {
    position: 'relative',
    width: '100%',
    height: height * 0.75, // Reduced height to make room for buttons below
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextCardContainer: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ scale: 0.9 }, { translateY: 20 }],
    opacity: 0.7,
  },
  footer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    paddingTop: 5,
    alignItems: 'center',
  },
  instructions: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingVertical: 15,
    marginTop: 10,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  watchedButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  notInterestedButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderWidth: 2,
    borderColor: '#F44336',
  },
  undoButton: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    borderWidth: 2,
    borderColor: '#FFC107',
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  indicator: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    opacity: 0, // Start hidden
  },
  rightIndicator: {
    right: 30,
  },
  leftIndicator: {
    left: 30,
  },
  indicatorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  roomsList: {
    width: '100%',
    marginBottom: 20,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#333',
    borderRadius: 10,
    marginBottom: 10,
  },
  roomName: {
    fontSize: 16,
    marginLeft: 10,
  },
  cancelButton: {
    marginTop: 10,
    width: '100%',
  },
});

function SwipePage() {
  const insets = useSafeAreaInsets();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [swipeHistory, setSwipeHistory] = useState<{movie: Movie, action: SwipeAction}[]>([]);
  const [lastAction, setLastAction] = useState<SwipeAction>(null);
  const [lastMovie, setLastMovie] = useState<Movie | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  
  // Animation values
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);

  // Reset deck function
  const resetDeck = () => {
    setCurrentIndex(0);
    setSwipeHistory([]);
    // Trigger haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Undo last swipe function
  const handleUndo = () => {
    if (swipeHistory.length > 0) {
      const lastSwipe = swipeHistory[swipeHistory.length - 1];
      setLastMovie(lastSwipe.movie);
      setLastAction(lastSwipe.action);
      
      // Remove the last action from history
      setSwipeHistory(prev => prev.slice(0, -1));
      
      // Go back to previous card
      setCurrentIndex(prev => prev - 1);
      
      // Trigger haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Load movies
  const fetchMovies = useCallback(async () => {
    try {
      const trendingMovies = await tmdbService.getTrendingMovies('week');
      setMovies(trendingMovies);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching movies:', error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  // Reset animation values when current index changes
  useEffect(() => {
    translateX.value = 0;
    rotate.value = 0;
  }, [currentIndex, translateX, rotate]);
  
  // Handle swipe actions
  const handleSwipeLeft = useCallback((movie: Movie) => {
    console.log('Not interested:', movie.title);
    // TODO: Add to 'Not Interested' list in database
    setSwipeHistory([...swipeHistory, { movie, action: 'notInterested' }]);
    setCurrentIndex(currentIndex + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [currentIndex, swipeHistory]);

  const handleSwipeRight = useCallback((movie: Movie) => {
    console.log('Watched:', movie.title);
    // TODO: Add to 'Watched' list in database
    setSwipeHistory([...swipeHistory, { movie, action: 'watched' }]);
    setCurrentIndex(currentIndex + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [currentIndex, swipeHistory]);

  const handleBookmark = useCallback((movie: Movie) => {
    console.log('Added to Bucket List:', movie.title);
    // TODO: Add to 'Bucket List' in database
    setSwipeHistory([...swipeHistory, { movie, action: 'bucketList' }]);
    setCurrentIndex(currentIndex + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [currentIndex, swipeHistory]);
  
  const undoLastSwipe = useCallback(() => {
    if (currentIndex > 0 && lastMovie) {
      setCurrentIndex(prevIndex => prevIndex - 1);
      setLastAction(null);
      setLastMovie(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [currentIndex, lastMovie]);
  
  const handleDoublePress = useCallback(() => {
    if (movies[currentIndex]) {
      setSelectedMovie(movies[currentIndex]);
      setShowModal(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentIndex, movies]);
  
  // Gesture handlers
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Update position based on gesture - only horizontal swipes
      translateX.value = event.translationX;
      
      // Calculate rotation based on horizontal movement
      rotate.value = interpolate(
        translateX.value,
        [-width / 2, 0, width / 2],
        [-10, 0, 10],
        Extrapolation.CLAMP
      );
    })
    .onEnd((event) => {
      // Determine action based on swipe direction - only left/right
      if (translateX.value < -SWIPE_THRESHOLD) {
        // Swipe left - Not interested
        // Use withSpring instead of withTiming to avoid the error
        translateX.value = withSpring(-width * 1.5, { damping: 15 });
        runOnJS(handleSwipeLeft)(movies[currentIndex]);
      } else if (translateX.value > SWIPE_THRESHOLD) {
        // Swipe right - Watched
        translateX.value = withSpring(width * 1.5, { damping: 15 });
        runOnJS(handleSwipeRight)(movies[currentIndex]);
      } else {
        // Return to center if not swiped far enough
        translateX.value = withSpring(0);
        rotate.value = withSpring(0);
      }
    });

  // Animated styles for the card
  const cardAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${rotate.value}deg` }
      ]
    };
  });

  // Animation styles for indicators - only left/right
  const rightIndicatorStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        translateX.value,
        [0, SWIPE_THRESHOLD],
        [0, 1],
        Extrapolation.CLAMP
      )
    };
  });

  const leftIndicatorStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        translateX.value,
        [-SWIPE_THRESHOLD, 0],
        [1, 0],
        Extrapolation.CLAMP
      )
    };
  });

  // Loading state
  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#fff" />
        <ThemedText style={styles.loadingText}>Loading movies...</ThemedText>
      </ThemedView>
    );
  }

  // No movies state
  if (movies.length === 0) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <Ionicons name="film-outline" size={64} color="#fff" />
        <ThemedText style={styles.noMoviesText}>No movies available</ThemedText>
        <Button 
          title="Refresh" 
          onPress={() => {
            setIsLoading(true);
            fetchMovies();
          }} 
        />
      </ThemedView>
    );
  }

  // End of deck state
  if (currentIndex >= movies.length) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <Ionicons name="checkmark-circle-outline" size={64} color="#fff" />
        <ThemedText style={styles.endDeckText}>You&apos;ve seen all movies!</ThemedText>
        <Button 
          title="Start Over" 
          onPress={() => setCurrentIndex(0)} 
        />
      </ThemedView>
    );
  }

  // Render the suggest to room modal
  const renderSuggestModal = () => {
    if (!selectedMovie) return null;
    
    return (
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Suggest &quot;{selectedMovie.title}&quot;</ThemedText>
            <ThemedText style={styles.modalText}>
              Choose a room to suggest this movie to:
            </ThemedText>
            
            {/* This would be replaced with actual rooms data */}
            <View style={styles.roomsList}>
              <TouchableOpacity style={styles.roomItem}>
                <Ionicons name="people" size={24} color="#fff" />
                <ThemedText style={styles.roomName}>Family Movie Night</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.roomItem}>
                <Ionicons name="people" size={24} color="#fff" />
                <ThemedText style={styles.roomName}>Friends Group</ThemedText>
              </TouchableOpacity>
            </View>
            
            <Button 
              title="Cancel" 
              onPress={() => setShowModal(false)}
              style={styles.cancelButton}
            />
          </View>
        </View>
      </Modal>
    );
  };


  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <StatusBar style="light" />
        {/* Empty header for spacing */}
        <View style={[styles.header, { marginTop: insets.top }]} />

        {/* Main content */}
        <View style={styles.cardContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <ThemedText style={styles.loadingText}>Loading movies...</ThemedText>
            </View>
          ) : movies.length === 0 ? (
            <View style={styles.centerContent}>
              <ThemedText style={styles.noMoviesText}>
                No movies available. Try again later.
              </ThemedText>
            </View>
          ) : currentIndex >= movies.length ? (
            <View style={styles.centerContent}>
              <ThemedText style={styles.endDeckText}>
                You&apos;ve reached the end of the deck!
              </ThemedText>
              <Button title="Start Over" onPress={resetDeck} />
            </View>
          ) : (
            <View style={styles.cardWrapper}>
              {/* Next card (partially visible) */}
              {currentIndex + 1 < movies.length && (
                <View style={styles.nextCardContainer}>
                  <SwipeableMovieCard
                    movie={movies[currentIndex + 1]}
                    onDoublePress={() => {}}
                  />
                </View>
              )}
              
              {/* Current card with gesture handler */}
              <GestureDetector gesture={panGesture}>
                <Animated.View style={[cardAnimatedStyle]}>
                  <SwipeableMovieCard
                    movie={movies[currentIndex]}
                    onDoublePress={handleDoublePress}
                    onBookmark={() => handleBookmark(movies[currentIndex])}
                  />
                </Animated.View>
              </GestureDetector>
              
              {/* Swipe indicators - now positioned outside the card */}
              <Animated.View 
                style={[styles.indicator, styles.rightIndicator, rightIndicatorStyle]}
              >
                <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                <Text style={styles.indicatorText}>WATCHED</Text>
              </Animated.View>
              
              <Animated.View 
                style={[styles.indicator, styles.leftIndicator, leftIndicatorStyle]}
              >
                <Ionicons name="close-circle" size={80} color="#F44336" />
                <Text style={styles.indicatorText}>NOT INTERESTED</Text>
              </Animated.View>
            </View>
          )}
        </View>
        
        {/* Footer with action buttons */}
        <View style={styles.footer}>
          {/* <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.notInterestedButton]}
              onPress={() => handleSwipeLeft(movies[currentIndex])}
            >
              <Ionicons name="close" size={30} color="#F44336" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.undoButton]}
              onPress={handleUndo}
              disabled={swipeHistory.length === 0}
            >
              <Ionicons name="arrow-undo" size={24} color="#FFC107" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.watchedButton]}
              onPress={() => handleSwipeRight(movies[currentIndex])}
            >
              <Ionicons name="checkmark" size={30} color="#4CAF50" />
            </TouchableOpacity>
          </View> */}
          
          {/* <ThemedText style={styles.instructions}>
            Swipe right to add to Watched, left for Not Interested, or tap the bookmark icon for Bucket List
          </ThemedText> */}
        </View>
        
        {/* Render modal */}
        {renderSuggestModal()}
      </ThemedView>
    </GestureHandlerRootView>
  );
};


export default SwipePage;
