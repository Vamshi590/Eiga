import React from 'react';
import { Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { tmdbService } from '../services/tmdbapi';

interface MovieCardProps {
  movie: {
    id: number;
    title: string;
    poster_path: string | null;
    vote_average: number;
    release_date?: string;
  };
  onPress: (movieId: number) => void;
  size?: 'small' | 'medium' | 'large';
}

export const MovieCard = ({ movie, onPress, size = 'medium' }: MovieCardProps) => {
  const { width } = Dimensions.get('window');
  
  const getCardWidth = () => {
    switch (size) {
      case 'small':
        return width < 600 ? width / 3.5 - 12 : 100;
      case 'medium':
        return width < 600 ? width / 2.5 - 16 : 150;
      case 'large':
        return width < 600 ? width / 1.5 - 32 : 200;
      default:
        return width / 2.5 - 16;
    }
  };

  const getCardHeight = () => {
    switch (size) {
      case 'small':
        return width < 600 ? (width / 3.5 - 12) * 1.5 : 150;
      case 'medium':
        return width < 600 ? (width / 2.5 - 16) * 1.5 : 225;
      case 'large':
        return width < 600 ? (width / 1.5 - 32) * 0.6 : 300;
      default:
        return (width / 2.5 - 16) * 1.5;
    }
  };

  const cardWidth = getCardWidth();
  const cardHeight = getCardHeight();

  const imageUrl = movie.poster_path 
    ? tmdbService.getImageUrl(movie.poster_path)
    : 'https://via.placeholder.com/300x450?text=No+Image';

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={() => onPress(movie.id)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: imageUrl }} 
        style={[styles.image, { width: cardWidth, height: cardHeight }]}
        resizeMode="cover"
      />
      <Text 
        style={[styles.title, { width: cardWidth }]} 
        numberOfLines={1} 
        ellipsizeMode="tail"
      >
        {movie.title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 6,
    alignItems: 'center',
  },
  image: {
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    // Width is now controlled in the component to match the image width
  },
});
