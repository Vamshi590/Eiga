import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { MovieCard } from './MovieCard';
import { Ionicons } from '@expo/vector-icons';

interface MovieRowProps {
  title: string;
  movies: any[];
  onMoviePress: (movieId: number) => void;
  onSeeAllPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export const MovieRow = ({ 
  title, 
  movies, 
  onMoviePress, 
  onSeeAllPress,
  size = 'medium'
}: MovieRowProps) => {
  if (!movies || movies.length === 0) {
    return null;
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAllPress && (
          <TouchableOpacity onPress={onSeeAllPress} style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>See All</Text>
            <Ionicons name="chevron-forward" size={16} color="#E50914" />
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={movies}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <MovieCard 
            movie={item} 
            onPress={onMoviePress}
            size={size}
          />
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: '#E50914',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 10,
  },
});
