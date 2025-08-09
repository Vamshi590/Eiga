import React from 'react';
import { StyleSheet, View, Text, Image, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { tmdbService } from '../services/tmdbapi';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.95;
const CARD_HEIGHT = height * 0.85; // Make card taller to fill most of the screen

interface SwipeableMovieCardProps {
  movie: {
    id: number;
    title: string;
    poster_path: string | null;
    vote_average: number;
    release_date?: string;
    genre_ids?: number[];
    overview?: string;
  };
  isActive?: boolean;
  onDoublePress?: () => void;
  onBookmark?: () => void;
}

export const SwipeableMovieCard = ({ 
  movie, 
  isActive = true,
  onDoublePress,
  onBookmark
}: SwipeableMovieCardProps) => {
  // Format release year
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
  
  // Format rating to one decimal place
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
  
  // Get image URL
  const imageUrl = movie.poster_path 
    ? tmdbService.getImageUrl(movie.poster_path, 'w780')
    : 'https://via.placeholder.com/500x750?text=No+Image';

  // Handle double press/tap
  const lastTap = React.useRef(0);
  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
      onDoublePress && onDoublePress();
    }
    lastTap.current = now;
  };

  // Map genre IDs to genre names (simplified version)
  const getGenreName = (genreId: number): string => {
    const genreMap: { [key: number]: string } = {
      28: 'Action',
      12: 'Adventure',
      16: 'Animation',
      35: 'Comedy',
      80: 'Crime',
      99: 'Documentary',
      18: 'Drama',
      10751: 'Family',
      14: 'Fantasy',
      36: 'History',
      27: 'Horror',
      10402: 'Music',
      9648: 'Mystery',
      10749: 'Romance',
      878: 'Sci-Fi',
      10770: 'TV Movie',
      53: 'Thriller',
      10752: 'War',
      37: 'Western'
    };
    return genreMap[genreId] || '';
  };

  // Get primary genre
  const primaryGenre = movie.genre_ids && movie.genre_ids.length > 0 
    ? getGenreName(movie.genre_ids[0]) 
    : '';

  return (
    <View 
      style={[
        styles.container,
        !isActive && styles.inactiveCard
      ]}
    >
      {/* Fixed image container at the top */}
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: imageUrl }} 
          style={styles.image}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.2)', 'transparent']}
          style={styles.imageGradient}
        />
        
        {/* Bookmark button positioned on the image */}
        <TouchableOpacity 
          style={styles.bookmarkButton}
          onPress={onBookmark}
          activeOpacity={0.8}
        >
          <Ionicons name="bookmark-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {/* Scrollable info section */}
      <TouchableOpacity 
        activeOpacity={1}
        onPress={handlePress}
        style={styles.infoSectionWrapper}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled={true}
        >
          {/* Movie info section */}
          <View style={styles.infoSection}>
            {/* Title and year */}
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {movie.title}
                {releaseYear ? <Text style={styles.year}> ({releaseYear})</Text> : null}
              </Text>
            </View>
            
            {/* Genre and rating */}
            <View style={styles.detailsRow}>
              {primaryGenre ? (
                <View style={styles.genreContainer}>
                  <Text style={styles.genre}>{primaryGenre}</Text>
                </View>
              ) : null}
              
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.rating}>{rating}</Text>
              </View>
            </View>
            
            {/* Movie details section */}
            <View style={styles.detailsContainer}>
              {movie.overview ? (
                <View style={styles.overviewContainer}>
                  <Text style={styles.sectionTitle}>Overview</Text>
                  <Text style={styles.overview}>{movie.overview}</Text>
                </View>
              ) : null}
              
              {/* Additional content sections */}
              <View style={styles.castContainer}>
                <Text style={styles.sectionTitle}>Cast</Text>
                <Text style={styles.placeholderText}>Cast information would appear here</Text>
              </View>
              
              <View style={styles.trailerContainer}>
                <Text style={styles.sectionTitle}>Trailer</Text>
                <View style={styles.trailerPlaceholder}>
                  <Ionicons name="play-circle-outline" size={48} color="#fff" />
                  <Text style={styles.placeholderText}>Trailer would appear here</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15,
  },
  imageContainer: {
    width: '100%',
    height: CARD_HEIGHT * 0.6, // Increased to 60% of card height
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  imageGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    zIndex: 1,
  },
  infoSection: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  infoSectionWrapper: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  inactiveCard: {
    opacity: 0.8,
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrollView: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 20, // Match container border radius
  },
  scrollContent: {
    flexGrow: 1,
  },
  infoContainer: {
    width: '100%',
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  year: {
    color: '#cccccc',
    fontSize: 18,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  genreContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  genre: {
    color: 'white',
    fontSize: 14,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  rating: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  detailsContainer: {
    paddingTop: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  overviewContainer: {
    marginBottom: 20,
  },
  overview: {
    color: 'white',
    fontSize: 16,
    lineHeight: 24,
  },
  castContainer: {
    marginBottom: 20,
  },
  trailerContainer: {
    marginBottom: 20,
  },
  trailerPlaceholder: {
    height: 160,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 10,
  },
  bookmarkButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 10,
  },
});
