import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useColorScheme } from '../../hooks/useColorScheme';
import { authService } from '../../services/authService';
import { roomService } from '../../services/roomservice';
import { supabase } from '../../services/supabase';
import { tmdbService } from '../../services/tmdbapi';
import { Movie, Room } from '../../types'; // Room type from types/index

export default function MovieDetailsScreen() {
  const { id } = useLocalSearchParams();
  const movieId = typeof id === 'string' ? parseInt(id, 10) : 0;

  const [movie, setMovie] = useState<Movie | null>(null);
  const [providers, setProviders] = useState<any>(null);
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [showRoomSelector, setShowRoomSelector] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [isWatched, setIsWatched] = useState(false);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        setLoading(true);
        const movieData = await tmdbService.getMovieDetails(movieId);
        setMovie(movieData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching movie details:', error);
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [movieId]);

  // Check if movie is already in user's watched list
  useEffect(() => {
    if (user && movie?.id) {
      // Check if movie is already in watched list
      const checkIfWatched = async () => {
        try {
          const movieIdNumber = typeof movie.id === 'string' ? parseInt(movie.id, 10) : movie.id;
          const { data } = await supabase
            .from('watched_movies')
            .select('id')
            .filter('user_id', 'eq', user.id)
            .filter('movie_id', 'eq', movieIdNumber)
            .limit(1);

          setIsWatched(data && data.length > 0 ? true : false);
        } catch (error) {
          console.error('Error checking watched status:', error);
        }
      };

      checkIfWatched();
    }
  }, [user, movie]);

  useEffect(() => {
    if (movie?.id) {
      setLoadingProviders(true);
      tmdbService.getMovieProviders(movie.id)
        .then(data => {
          // Check if we have actual provider data before setting it
          if (data && data.results && Object.keys(data.results).length > 0) {
            // Verify there's at least one region with streaming options
            const hasProviders = Object.values(data.results).some((region: any) => {
              return region.flatrate?.length > 0 || region.rent?.length > 0 || region.buy?.length > 0;
            });

            if (hasProviders) {
              setProviders(data);
            } else {
              setProviders(null); // No actual providers available
            }
          } else {
            setProviders(null); // No results available
          }
          setLoadingProviders(false);
        })
        .catch(err => {
          console.error('Error fetching providers:', err);
          setProviders(null);
          setLoadingProviders(false);
        });
    }
  }, [movie?.id]);

  useEffect(() => {
    loadUserRooms();
  }, [movieId]);

  const loadUserRooms = async () => {
    try {
      setLoadingRooms(true);
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return;
      }

      const rooms = await roomService.getUserRooms(currentUser.id);
      setUserRooms(rooms);
    } catch (error) {
      console.error('Error loading user rooms:', error);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleSuggestMovie = async () => {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to suggest a movie');
      router.push('/login');
      return;
    }

  

    setShowRoomSelector(true);
  };

  const handleSelectRoom = async (room: Room) => {
    if (!movie) return;
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to suggest a movie');
        router.push('/login');
        return;
      }
      setLoading(true);
      // Check movie suggestion limit for this room/user
      const check = await roomService.canSuggestMovie(room.id, currentUser.id);
      if (!check.allowed) {
        Alert.alert('Upgrade Required', check.reason || 'You have reached your movie suggestion limit for this room.');
        router.navigate('/pricing' as any);
        setLoading(false);
        return;
      }
      // Prepare movie data for suggestion
      const movieData = {
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        overview: movie.overview,
        release_date: movie.release_date,
        vote_average: movie.vote_average
      };
      await roomService.suggestMovie(room.id, currentUser.id, movieData);
      // Also add to user's watched movies (room context)
      await roomService.markMovieAsWatched(room.id, currentUser.id, movie);
      // Also add to user's watched movies (direct user context, no room)
      await roomService.markMovieAsWatched(null, currentUser.id, movie);
      Alert.alert('Success', `${movie.title} suggested to ${room.name} and added to Watched Movies!`);
      setShowRoomSelector(false);
    } catch (error) {
      console.error('Error suggesting movie:', error);
      Alert.alert('Error', 'Failed to suggest movie');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View  style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator  size="large" color={colors.primary} />
      </View>
    );
  }

  if (!movie) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Movie not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: movie?.title || 'Movie Details',
          headerShown: false,
          headerTransparent: true,
          headerTintColor: 'white',
          headerBackTitle: 'Back',
        }}
      />

      {/* Floating back button */}
      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: 'transparent' }]}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Movie Backdrop - Netflix Style */}
        <View style={styles.backdropContainer}>
          <Image
            source={{
              uri: movie.backdrop_path
                ? tmdbService.getImageUrl(movie.backdrop_path, 'original')
                : tmdbService.getImageUrl(movie.poster_path || '', 'original')
            }}
            style={styles.backdropImage}
            contentFit="cover"
            contentPosition="top"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)', colors.background]}
            locations={[0, 0.5, 0.85, 1]}
            style={styles.backdropGradient}
          />
        </View>

        {/* Movie Info - Enhanced Netflix Style */}
        <View style={[styles.infoContainer, Platform.OS !== 'web' && styles.infoContainerMobile]}>
          <View style={styles.posterContainer}>
            <Image
              source={{ uri: tmdbService.getImageUrl(movie.poster_path || '', 'w500') }}
              style={styles.posterImage}
              contentFit="cover"
            />

            {/* Quick Action Buttons - Mobile Only */}
            {Platform.OS !== 'web' && (
              <View style={styles.quickActionsMobile}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.primary, flex: 1, marginRight: 8 }]}
                  onPress={handleSuggestMovie}
                >
                  <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Add to Room</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, {
                    backgroundColor: isWatched ? colors.primary : 'rgba(255,255,255,0.2)',
                    flex: 1
                  }]}
                  onPress={() => {
                    if (user) {
                      if (isWatched) {
                        Alert.alert('Already Watched', `${movie.title} is already in your watched movies!`);
                      } else {
                        roomService.markMovieAsWatched(null, user.id, movie)
                          .then(() => {
                            setIsWatched(true);
                            Alert.alert('Success', `${movie.title} added to your watched movies!`);
                          })
                          .catch(err => console.error('Error marking as watched:', err));
                      }
                    } else {
                      Alert.alert('Error', 'You must be logged in');
                    }
                  }}
                >
                  <Ionicons
                    name={isWatched ? "checkmark-circle" : "checkmark-circle-outline"}
                    size={22}
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionButtonText}>
                    {isWatched ? 'Watched' : 'Mark as Watched'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.detailsContainer}>
            <Text style={[styles.title, { color: colors.text }]}>{movie.title}</Text>

            <View style={styles.metadataContainer}>
              <Text style={[styles.releaseYear, { color: colors.text }]}>
                {movie.release_date ? new Date(movie.release_date).getFullYear() : 'Unknown'}
              </Text>
              {movie.runtime && (
                <Text style={[styles.runtime, { color: colors.text }]}>
                  {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </Text>
              )}
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={[styles.rating, { color: colors.text }]}>{movie.vote_average?.toFixed(1)}/10</Text>
              </View>
            </View>


            {/* Quick Action Buttons - Web Only */}
            {Platform.OS === 'web' && (
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={handleSuggestMovie}
                >
                  <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Add to Room</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, {
                    backgroundColor: isWatched ? colors.primary : 'rgba(255,255,255,0.2)'
                  }]}
                  onPress={() => {
                    if (user) {
                      if (isWatched) {
                        Alert.alert('Already Watched', `${movie.title} is already in your watched movies!`);
                      } else {
                        roomService.markMovieAsWatched(null, user.id, movie)
                          .then(() => {
                            setIsWatched(true);
                            Alert.alert('Success', `${movie.title} added to your watched movies!`);
                          })
                          .catch(err => console.error('Error marking as watched:', err));
                      }
                    } else {
                      Alert.alert('Error', 'You must be logged in');
                    }
                  }}
                >
                  <Ionicons
                    name={isWatched ? "checkmark-circle" : "checkmark-circle-outline"}
                    size={22}
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionButtonText}>
                    {isWatched ? 'Watched' : 'Mark as Watched'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>



        {/* Overview with Enhanced Styling */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Overview</Text>
          <Text style={[styles.overview, { color: colors.text }]}>{movie.overview}</Text>
        </View>

        {/* Genres */}
        {movie.genres && movie.genres.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Genres</Text>
            <View style={styles.genreContainer}>
              {movie.genres.map((genre) => (
                <View key={genre.id} style={[styles.genreTag, { backgroundColor: colors.card }]}>
                  <Text style={[styles.genreText, { color: colors.text }]}>{genre.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}


        {/* Languages Section */}
        {movie.spoken_languages && movie.spoken_languages.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Available in</Text>
            <View style={styles.languageTagsContainer}>
              {movie.spoken_languages.map((lang: any, index: number) => (
                <View key={index} style={styles.languageTag}>
                  <Text style={styles.languageText}>{lang.english_name || lang.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Where to Watch (Unified) */}
        {providers && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Where to Watch</Text>
            {loadingProviders ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : providers && providers.results ? (
              <View style={styles.providersContainer}>
                {(() => {
                  // Find providers for the user's region (IN for India, or US as fallback)
                  const regions = Array.isArray(providers.results) ? providers.results : Object.keys(providers.results || {});
                  let regionProviders = null;
                  if (regions.includes('IN')) {
                    regionProviders = providers.results.IN;
                  } else if (regions.includes('US')) {
                    regionProviders = providers.results.US;
                  } else if (regions.length > 0) {
                    regionProviders = providers.results[regions[0]];
                  }
                  if (!regionProviders || (!regionProviders.flatrate && !regionProviders.rent && !regionProviders.buy)) {
                    return (
                      <View style={styles.noProvidersContainer}>
                        <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
                        <Text style={[styles.noProviders, { color: colors.text }]}>Not available for streaming in your region.</Text>
                        <Text style={[styles.noProvidersSubtext, { color: colors.textSecondary }]}>Try checking other regions or services.</Text>
                      </View>
                    );
                  }
                  // Unified: Collect all providers from flatrate, rent, buy
                  const allProviders = [
                    ...(regionProviders.flatrate || []),
                    ...(regionProviders.rent || []),
                    ...(regionProviders.buy || [])
                  ];
                  // Deduplicate by provider_id
                  const uniqueProvidersMap: { [key: number]: any } = {};
                  allProviders.forEach((p) => {
                    if (p && p.provider_id) uniqueProvidersMap[p.provider_id] = p;
                  });
                  const uniqueProviders = Object.values(uniqueProvidersMap);
                  if (uniqueProviders.length === 0) {
                    return (
                      <View style={styles.noProvidersContainer}>
                        <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
                        <Text style={[styles.noProviders, { color: colors.text }]}>Not available for streaming in your region.</Text>
                        <Text style={[styles.noProvidersSubtext, { color: colors.textSecondary }]}>Try checking other regions or services.</Text>
                      </View>
                    );
                  }
                  return (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.providerRow}>
                        {uniqueProviders.map((provider: any) => (
                          <View key={provider.provider_id} style={[styles.providerItem, { backgroundColor: colors.card }]}>
                            <Image
                              source={{ uri: `https://image.tmdb.org/t/p/original${provider.logo_path}` }}
                              style={styles.providerLogo}
                              contentFit="cover"
                            />
                            <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={1}>{provider.provider_name}</Text>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  );
                })()}
              </View>
            ) : null}
          </View>
        )}

        {/* Awards Section (if available) */}
        {movie.awards && movie.awards.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Awards</Text>
            <View style={styles.awardsContainer}>
              {movie.awards.map((award: string, idx: number) => (
                <View key={award + idx} style={styles.awardBadge}>
                  <Ionicons name="trophy" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                  <Text style={styles.awardText}>{award}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Cast Information (if available) */}
        {movie.credits && movie.credits.cast && movie.credits.cast.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Cast</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.castScrollView}>
              {movie.credits.cast.slice(0, 10).map((person) => (
                <View key={person.id} style={styles.castItem}>
                  <Image
                    source={{
                      uri: person.profile_path
                        ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
                        : 'https://via.placeholder.com/185x278/333333/FFFFFF?text=No+Image'
                    }}
                    style={styles.castImage}
                    contentFit="cover"
                  />
                  <Text style={[styles.castName, { color: colors.text }]} numberOfLines={1}>{person.name}</Text>
                  <Text style={[styles.castCharacter, { color: colors.textSecondary }]} numberOfLines={1}>{person.character}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Suggest to Room Button - Moved to bottom */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.suggestButton, { backgroundColor: colors.primary }]}
            onPress={handleSuggestMovie}
          >
            <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
            <Text style={styles.suggestButtonText}>Add to Room</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
      
      {/* Room Selector - Modal Style */}
      {showRoomSelector && (
        <View style={styles.modalOverlay}>
          <View style={[styles.roomSelector, { backgroundColor: colors.card }]}>
            <View style={styles.roomSelectorHeader}>
              <Text style={[styles.roomSelectorTitle, { color: colors.text }]}>Select a Room</Text>
              <TouchableOpacity
                onPress={() => setShowRoomSelector(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loadingRooms ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.text }]}>Loading your rooms...</Text>
              </View>
            ) : userRooms.length > 0 ? (
              <FlatList
                data={userRooms}
                keyExtractor={(item: Room) => item.id}
                renderItem={({ item }: { item: Room }) => (
                  <TouchableOpacity
                    style={[styles.roomItem, { backgroundColor: colors.background }]}
                    onPress={() => handleSelectRoom(item)}
                  >
                    <View style={styles.roomItemContent}>
                      <Ionicons name="people" size={20} color={colors.primary} style={styles.roomIcon} />
                      <View>
                        <Text style={[styles.roomName, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.roomMembers, { color: colors.textSecondary }]}>
                          {item.members?.length || 0} members
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
                contentContainerStyle={styles.roomListContent}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="sad-outline" size={40} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.text }]}>You don't have any rooms yet</Text>
                <TouchableOpacity
                  style={[styles.createRoomButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowRoomSelector(false);
                    router.push('/room/create');
                  }}
                >
                  <Text style={styles.createRoomButtonText}>Create a Room</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  awardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
    alignItems: 'center',
  },
  awardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5eaea',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#ffc10733',
  },
  awardText: {
    fontSize: 13,
    color: '#a97c1c',
    fontWeight: '600',
  },
  backdropImage: {
    width: '100%',
    height: 450, // Netflix-style taller banner
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    alignSelf: 'stretch',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropContainer: {
    height: 450,
    position: 'relative',
    overflow: 'hidden',
  },

  backdropGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%', // Full height gradient for better Netflix-like effect
  },
  infoContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    marginTop: -20,
    marginHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
      },
    }),
  },
  infoContainerMobile: {
    flexDirection: 'column',
    padding: 16,
  },
  posterContainer: {
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0,0,0,0.3)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
      },
    }),
  },
  posterImage: {
    width: 100,
    height: 150,
    borderRadius: 8,
  },
  detailsContainer: {
    flex: 1,
    paddingLeft: 16,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  releaseYear: {
    fontSize: 14,
    marginRight: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  runtime: {
    fontSize: 14,
    marginRight: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  rating: {
    marginLeft: 4,
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  quickActionsMobile: {
    flexDirection: 'row',
    marginTop: 12,
    width: '100%',
    gap: 10,
  },
  languagesContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  languageTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  languageTag: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.5)',
  },
  languageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  providersScrollView: {
    marginTop: 8,
  },
  noProvidersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginVertical: 10,
  },
  noProviders: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 10,
  },
  noProvidersSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    // No background color for a cleaner UI
    // Adding a subtle shadow to make it visible against any background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  castScrollView: {
    marginTop: 8,
  },
  castItem: {
    width: 100,
    marginRight: 12,
  },
  castImage: {
    width: 100,
    height: 150,
    borderRadius: 8,
    marginBottom: 4,
  },
  castName: {
    fontSize: 14,
    fontWeight: '500',
  },
  castCharacter: {
    fontSize: 12,
  },
  providerItem: {
    marginRight: 16,
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    width: 100,
  },
  providerLogo: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginBottom: 4,
  },
  providerName: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  overview: {
    fontSize: 16,
    lineHeight: 24,
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  genreTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  genreText: {
    fontSize: 14,
  },
  actionButtonsContainer: {
    marginHorizontal: 16,
    marginBottom: 32,
    gap: 12,
  },
  suggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  suggestButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  watchedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  watchedButtonText: {
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  providersContainer: {
    marginTop: 10,
  },
  providerSection: {
    marginBottom: 16,
  },
  providerSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.8,
  },
  providerRow: {
    flexDirection: 'row',
  },
  modalOverlay: {
    ...Platform.select({
      web: {
        position: 'fixed',
      },
      default: {
        position: 'absolute',
      },
    }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  roomSelector: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  roomSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  roomSelectorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  roomListContent: {
    paddingVertical: 8,
  },
  roomItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
  },
  roomItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomIcon: {
    marginRight: 12,
  },
  roomName: {
    fontSize: 16,
    fontWeight: '500',
  },
  roomMembers: {
    fontSize: 12,
    marginTop: 2,
  },
  separator: {
    height: 1,
    marginVertical: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  createRoomButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  createRoomButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },

});
