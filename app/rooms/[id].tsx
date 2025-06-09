import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useColorScheme } from '../../hooks/useColorScheme';
import { authService } from '../../services/authService';
import { roomService } from '../../services/roomservice';
import { tmdbService } from '../../services/tmdbapi';
import { MovieSuggestion, Room, User, WatchedMovie } from '../../types';

// Vote types
const VOTE_TYPES = {
  UP: 'up',
  DOWN: 'down',
};

export default function RoomDetailsScreen() {
  const { id } = useLocalSearchParams();
  const roomId = typeof id === 'string' ? id : '';
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();
  const { user } = useAuth();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [suggestions, setSuggestions] = useState<MovieSuggestion[]>([]);
  const [suggestionsByUser, setSuggestionsByUser] = useState<{[key: string]: MovieSuggestion[]}>({});
  const [watchedMovies, setWatchedMovies] = useState<WatchedMovie[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('suggestions');
  
  // Load room details
  useEffect(() => {
    if (!roomId) return;
    loadRoomData();
  }, [roomId]);
  
  // Generate a short 6-letter invite code from the room ID
  const generateShortCode = (roomId: string): string => {
    // Use the first 6 characters of the room ID, or generate a random code if needed
    if (roomId && roomId.length >= 6) {
      return roomId.substring(0, 6).toUpperCase();
    }
    
    // Fallback to generate a random 6-letter code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  
  // Store the short code
  const [shortInviteCode, setShortInviteCode] = useState('');
  
  const loadRoomData = async () => {
    try {
      setLoading(true);
      
      // Load room details
      const roomData = await roomService.getRoomById(roomId);
      setRoom(roomData as Room);
      
      // Generate short invite code
      const code = roomData?.invite_code || generateShortCode(roomId);
      setShortInviteCode(code);
      
      // Load suggestions
      const suggestionData = await roomService.getMovieSuggestions(roomId);
      setSuggestions(suggestionData as MovieSuggestion[]);
      
      // Group suggestions by user
      groupSuggestionsByUser(suggestionData as MovieSuggestion[]);
      
      // Load watched movies
      const watchedData = await roomService.getWatchedMovies(roomId);
      setWatchedMovies(watchedData as WatchedMovie[]);
      
      // Load members
      const memberData = await roomService.getRoomMembers(roomId);
      // Cast to User[] with type assertion to handle the mismatch between Supabase user data and our User interface
      setMembers(memberData as unknown as User[]);
    } catch (error) {
      console.error('Error loading room data:', error);
      Alert.alert('Error', 'Failed to load room data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleVote = async (suggestion: MovieSuggestion, voteType: string) => {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to vote');
        return;
      }
      
      await roomService.voteOnMovie(roomId, currentUser.id, suggestion.id, voteType === VOTE_TYPES.UP ? 'good' : 'bad');
      
      // Refresh suggestions
      const updatedSuggestions = await roomService.getMovieSuggestions(roomId);
      setSuggestions(updatedSuggestions as MovieSuggestion[]);
      
      // Update grouped suggestions
      groupSuggestionsByUser(updatedSuggestions as MovieSuggestion[]);
    } catch (error) {
      console.error('Error voting on movie:', error);
      Alert.alert('Error', 'Failed to vote on movie');
    }
  };
  
  const handleMarkAsWatched = async (suggestion: MovieSuggestion) => {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to mark a movie as watched');
        return;
      }
      
      await roomService.markMovieAsWatched(roomId, currentUser.id, suggestion.movie);
      
      // Refresh data
      const updatedSuggestions = await roomService.getMovieSuggestions(roomId);
      setSuggestions(updatedSuggestions as MovieSuggestion[]);
      
      // Update grouped suggestions
      groupSuggestionsByUser(updatedSuggestions as MovieSuggestion[]);
      
      const updatedWatched = await roomService.getWatchedMovies(roomId);
      setWatchedMovies(updatedWatched as WatchedMovie[]);
      
      Alert.alert('Success', `${suggestion.movie.title} marked as watched!`);
    } catch (error) {
      console.error('Error marking movie as watched:', error);
      Alert.alert('Error', 'Failed to mark movie as watched');
    }
  };
  
  const handleShareRoom = async () => {
    if (!room) return;
    
    try {
      // Array of creative messages
      const messages = [
        `*"Why so serious? Come rate some movies."* 🎬

I just joined *${room.name}*,
a room where cinema lives, hot takes thrive, and only the bold survive 🍿🔥

Think your opinions belong on the big screen?
🎟️ Use the secret code: ${shortInviteCode}

Join the Room — and may the ratings be ever in your favor. 🎞️`,
        
        `*"I'm gonna make you an offer you can't refuse…"* 🍿
        
Join me in *${room.name}* — the one room where movies aren't just watched, they're worshipped.

Come rate, roast, and recommend with the real ones.

🎟️ Invite Code: ${shortInviteCode}

Join the Room before the credits roll. 🎬✨`,
        
        `*"This is the beginning of a beautiful friendship…"* 🎥

Just joined *${room.name}* — it's wild, it's loud, and it's made for true movie lovers.

Bring your takes, drop your favs, and battle it out over bad sequels.

🎟️ Code to enter: ${shortInviteCode}

Join now — the screen is waiting. 🍿🎞️`
      ];
      
      // Select a random message
      const randomIndex = Math.floor(Math.random() * messages.length);
      const message = messages[randomIndex];
      
      // Create a deep link to the room if possible
      const roomLink = `eiga.co.in/rooms/${room.id}`;
      
      await Share.share({
        message: message + `\n\nOpen directly: ${roomLink}`,
      });
    } catch (error) {
      console.error('Error sharing room:', error);
    }
  };
  
  // Handle room deletion (only available to room creator)
  const handleDeleteRoom = async () => {
    if (!room || !user) return;
    
    // Check if current user is the room creator
    if (room.createdBy !== user.id) {
      Alert.alert('Error', 'Only the room creator can delete this room');
      return;
    }
    
    // Confirm deletion
    Alert.alert(
      'Delete Room',
      `Are you sure you want to delete "${room.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              // Use type assertion to access the deleteRoom method
              await (roomService as any).deleteRoom(roomId);
              
              Alert.alert(
                'Success', 
                'Room deleted successfully',
                [{ text: 'OK', onPress: () => router.replace('/(tabs)' as any) }]
              );
            } catch (error) {
              console.error('Error deleting room:', error);
              Alert.alert('Error', 'Failed to delete room');
              setLoading(false);
            }
          }
        },
      ]
    );
  };
  
  // Check if user has voted
  const hasVoted = (suggestion: MovieSuggestion, voteType: string): boolean => {
    // Get user ID from the context instead of async call to avoid Promise issues
    const userId = user?.id;
    if (!userId) return false;
    
    const userVote = suggestion.votes.find(vote => vote.userId === userId);
    if (!userVote) return false;
    
    return voteType === VOTE_TYPES.UP ? userVote.vote === 'good' : userVote.vote === 'bad';
  };
  
  // Count votes of a specific type
  const countVotes = (suggestion: MovieSuggestion, voteType: string): number => {
    return suggestion.votes.filter(vote => 
      voteType === VOTE_TYPES.UP ? vote.vote === 'good' : vote.vote === 'bad'
    ).length;
  };
  
  // Group suggestions by user who suggested them
  const groupSuggestionsByUser = (suggestions: MovieSuggestion[]) => {
    const groupedSuggestions: {[key: string]: MovieSuggestion[]} = {};
    
    suggestions.forEach(suggestion => {
      const suggestedBy = suggestion.suggestedBy?.username || 'Anonymous';
      const userId = suggestion.suggestedBy?.id || 'anonymous';
      const key = `${userId}:${suggestedBy}`;
      
      if (!groupedSuggestions[key]) {
        groupedSuggestions[key] = [];
      }
      
      groupedSuggestions[key].push(suggestion);
    });
    
    // Sort each user's suggestions by vote count
    Object.keys(groupedSuggestions).forEach(key => {
      groupedSuggestions[key].sort((a, b) => {
        const aVotes = countVotes(a, VOTE_TYPES.UP) - countVotes(a, VOTE_TYPES.DOWN);
        const bVotes = countVotes(b, VOTE_TYPES.UP) - countVotes(b, VOTE_TYPES.DOWN);
        return bVotes - aVotes; // Sort by net votes (descending)
      });
    });
    
    setSuggestionsByUser(groupedSuggestions);
  };
  
  // Render compact suggestion item for horizontal list
  const renderCompactSuggestionItem = ({ item }: { item: MovieSuggestion }) => (
    <TouchableOpacity 
      style={styles.compactSuggestionCard}
      onPress={() => router.push(`/movies/${item.movie.id}`)}
    >
      <Image
        source={{ uri: tmdbService.getImageUrl(item.movie.poster_path) }}
        style={styles.compactMoviePoster}
        contentFit="cover"
      />
      
      <View style={styles.voteOverlay}>
        <View style={styles.compactVoteContainer}>
          <Text style={styles.compactVoteCount}>{countVotes(item, VOTE_TYPES.UP)}</Text>
          <Ionicons name="thumbs-up" size={12} color="#FFFFFF" />
        </View>
      </View>
      
      <Text style={styles.compactMovieTitle} numberOfLines={1}>
        {item.movie.title}
      </Text>
    </TouchableOpacity>
  );
  
  // Render user section with their suggestions
  const renderUserSuggestionsSection = ({ userKey, suggestions }: { userKey: string, suggestions: MovieSuggestion[] }) => {
    const username = userKey.split(':')[1];
    
    return (
      <View style={styles.userSuggestionsSection}>
        <View style={styles.userSectionHeader}>
          <Text style={[styles.userSectionTitle, { color: colors.text }]}>
            Suggested by {username}
          </Text>
          <Text style={[styles.suggestionCount, { color: colors.textSecondary }]}>
            {suggestions.length} {suggestions.length === 1 ? 'movie' : 'movies'}
          </Text>
        </View>
        
        <FlatList
          horizontal
          data={suggestions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCompactSuggestionItem}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalSuggestionsList}
        />
      </View>
    );
  };
  
  // Render suggestion item for the old vertical list (keeping for reference)
  const renderSuggestionItem = ({ item }: { item: MovieSuggestion }) => (
    <View style={[styles.suggestionCard, { backgroundColor: colors.card }]}>
      <Image
        source={{ uri: tmdbService.getImageUrl(item.movie.poster_path) }}
        style={styles.moviePoster}
        contentFit="cover"
      />
      
      <View style={styles.suggestionContent}>
        <TouchableOpacity 
          style={styles.movieTitleContainer}
          onPress={() => router.push(`/movies/${item.movie.id}`)}
        >
          <Text style={[styles.movieTitle, { color: colors.text }]} numberOfLines={2}>
            {item.movie.title}
          </Text>
          
          {item.movie.release_date && (
            <Text style={[styles.releaseYear, { color: colors.textSecondary }]}>
              ({new Date(item.movie.release_date).getFullYear()})
            </Text>
          )}
        </TouchableOpacity>
        
        <Text style={[styles.suggestedBy, { color: colors.textSecondary }]}>
          Suggested by {item.suggestedBy?.username || 'Anonymous'}
        </Text>
        
        <View style={styles.voteContainer}>
          <TouchableOpacity 
            style={[
              styles.voteButton,
              hasVoted(item, VOTE_TYPES.UP) && { backgroundColor: colors.upvote }
            ]}
            onPress={() => handleVote(item, VOTE_TYPES.UP)}
          >
            <Ionicons 
              name="thumbs-up" 
              size={16} 
              color={hasVoted(item, VOTE_TYPES.UP) ? '#FFFFFF' : colors.text} 
            />
            <Text 
              style={[
                styles.voteCount, 
                { color: hasVoted(item, VOTE_TYPES.UP) ? '#FFFFFF' : colors.text }
              ]}
            >
              {countVotes(item, VOTE_TYPES.UP)}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.voteButton,
              hasVoted(item, VOTE_TYPES.DOWN) && { backgroundColor: colors.downvote }
            ]}
            onPress={() => handleVote(item, VOTE_TYPES.DOWN)}
          >
            <Ionicons 
              name="thumbs-down" 
              size={16} 
              color={hasVoted(item, VOTE_TYPES.DOWN) ? '#FFFFFF' : colors.text} 
            />
            <Text 
              style={[
                styles.voteCount, 
                { color: hasVoted(item, VOTE_TYPES.DOWN) ? '#FFFFFF' : colors.text }
              ]}
            >
              {countVotes(item, VOTE_TYPES.DOWN)}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.watchedButton, { backgroundColor: colors.primary }]}
            onPress={() => handleMarkAsWatched(item)}
          >
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            <Text style={styles.watchedButtonText}>Watched</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
  
  // Render watched movie item
  const renderWatchedMovieItem = ({ item }: { item: WatchedMovie }) => (
    <TouchableOpacity 
      style={[styles.watchedCard, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/movies/${item.movie.id}`)}
    >
      <Image
        source={{ uri: tmdbService.getImageUrl(item.movie.poster_path) }}
        style={styles.watchedPoster}
        contentFit="cover"
      />
      
      <View style={styles.watchedContent}>
        <Text style={[styles.movieTitle, { color: colors.text }]} numberOfLines={2}>
          {item.movie.title}
        </Text>
        
        {item.movie.release_date && (
          <Text style={[styles.releaseYear, { color: colors.textSecondary }]}>
            ({new Date(item.movie.release_date).getFullYear()})
          </Text>
        )}
        
        <Text style={[styles.watchedDate, { color: colors.textSecondary }]}>
          Watched on {new Date(item.watchedAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
  
  // Render member item
  const renderMemberItem = ({ item }: { item: User }) => (
    <View style={[styles.memberCard, { backgroundColor: colors.card }]}>
      <Image
        source={{ uri: item.avatar || 'https://via.placeholder.com/150' }}
        style={styles.memberAvatar}
        contentFit="cover"
      />
      <Text style={[styles.memberName, { color: colors.text }]}>{item.username}</Text>
    </View>
  );
  
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  
  if (!room) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Room not found</Text>
      </View>
    );
  }

  {console.log('Room members:', members)}
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Room Banner */}
        <View style={styles.bannerContainer}>
          <Image
            source={{ uri: room.avatar }}
            style={styles.bannerBackground}
            contentFit="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
            style={styles.bannerGradient}
          >
            <View style={styles.bannerContent}>
              <View style={styles.bannerHeader}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => router.push('/explore')}
                >
                  <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.shareButton}
                  onPress={handleShareRoom}
                >
                  <Ionicons name="share-social" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.roomDetailsContainer}>
                {/* Left side: Avatar, name and member count */}
                <View style={styles.roomInfoContainer}>
                  <Image
                    source={{ uri: room.avatar }}
                    style={styles.roomAvatar}
                    contentFit="cover"
                  />
                  <View style={styles.roomInfoText}>
                    <Text style={styles.roomName}>{room.name}</Text>
                    <View style={styles.roomMetaRow}>
                      <Ionicons name="people" size={16} color="#FFFFFF" style={styles.metaIcon} />
                      <Text style={styles.roomMemberCount}>
                        {members.length} {members.length === 1 ? 'Member' : 'Members'}
                      </Text>
                    </View>
                  </View>
                </View>
                
                {/* Right side: Invite code and delete button in a row */}
                <View style={styles.roomActionsContainer}>
                  <View style={styles.inviteCodeCompact}>
                    <Text style={styles.inviteCodeLabel}>Code: </Text>
                    <Text style={styles.inviteCode}>{shortInviteCode}</Text>
                    <TouchableOpacity 
                      style={styles.copyButton}
                      onPress={() => {
                        if (shortInviteCode) {
                          Share.share({
                            message: `Join my room in EIGA! Use code: ${shortInviteCode}`,
                          });
                        }
                      }}
                    >
                      <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Only show delete button to room creator */}
                  {user && room.createdBy === user.id && (
                    <TouchableOpacity 
                      style={[styles.deleteRoomButton, { backgroundColor: '#d32f2f' }]}
                      onPress={handleDeleteRoom}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FFFFFF" style={{marginRight: 4}} />
                      <Text style={styles.deleteRoomButtonText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
        
        {/* Tab Selector */}
        <View style={[styles.tabSelector, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'suggestions' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
            ]}
            onPress={() => setActiveTab('suggestions')}
          >
            <Text 
              style={[
                styles.tabText, 
                { color: activeTab === 'suggestions' ? colors.primary : colors.textSecondary }
              ]}
            >
              Suggestions
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'watched' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
            ]}
            onPress={() => setActiveTab('watched')}
          >
            <Text 
              style={[
                styles.tabText, 
                { color: activeTab === 'watched' ? colors.primary : colors.textSecondary }
              ]}
            >
              Watched
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'members' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
            ]}
            onPress={() => setActiveTab('members')}
          >
            <Text 
              style={[
                styles.tabText, 
                { color: activeTab === 'members' ? colors.primary : colors.textSecondary }
              ]}
            >
              Members
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Tab Content */}
        {activeTab === 'suggestions' && (
          Object.keys(suggestionsByUser).length > 0 ? (
            <View>
              {Object.keys(suggestionsByUser).map((item) => {
                const username = item.split(':')[1];
                return (
                  <View key={item}>
                    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
                      <Text style={[styles.sectionHeaderText, { color: colors.text }]}>
                        Suggested by {username}
                      </Text>
                      <Text style={[styles.movieCount, { color: colors.textSecondary }]}>
                        {suggestionsByUser[item].length} {suggestionsByUser[item].length === 1 ? 'movie' : 'movies'}
                      </Text>
                    </View>
                    <FlatList
                      horizontal
                      data={suggestionsByUser[item]}
                      keyExtractor={(suggestion) => suggestion.id.toString()}
                      renderItem={renderCompactSuggestionItem}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.horizontalSuggestionsList}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="film-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No movie suggestions yet
              </Text>
              <TouchableOpacity 
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/explore')}
              >
                <Text style={styles.addButtonText}>Find Movies to Suggest</Text>
              </TouchableOpacity>
            </View>
          )
        )}
        
        {activeTab === 'watched' && (
          <View style={{paddingBottom: 40}}>
            <FlatList
              data={watchedMovies}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderWatchedMovieItem}
              contentContainerStyle={styles.listContent}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="checkmark-circle-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No movies watched yet
                  </Text>
                </View>
              }
            />
          </View>
        )}
        
        {activeTab === 'members' && (
          <View style={{paddingBottom: 40}}>
            <FlatList
              data={members}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMemberItem}
              contentContainerStyle={styles.listContent}
              numColumns={3}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No members found
                  </Text>
                </View>
              }
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContainer: {
    flex: 1,
  },
  roomActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  roomMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaIcon: {
    marginRight: 6,
    opacity: 0.9,
  },
  inviteCodeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginLeft: 8,
  },
  deleteRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 0,
    alignSelf: 'flex-start',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  deleteRoomButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  movieCount: {
    fontSize: 14,
  },
  // New styles for horizontal suggestion rows
  compactSuggestionCard: {
    width: 120,
    marginRight: 12,
  },
  compactMoviePoster: {
    width: 120,
    height: 180,
    borderRadius: 8,
  },
  voteOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 4,
  },
  compactVoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactVoteCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 4,
  },
  compactMovieTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    color: '#FFFFFF',
  },
  userSuggestionsSection: {
    marginBottom: 24,
  },
  userSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  userSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionCount: {
    fontSize: 14,
  },
  horizontalSuggestionsList: {
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  suggestionsHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  addSuggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  addSuggestionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    marginRight: 16,
  },
  roomDetailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  roomInfo: {
    padding: 16,
    borderBottomWidth: 1,
  },
  roomDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  roomCode: {
    fontSize: 12,
  },
  tabSelector: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  suggestionCard: {
    flexDirection: 'row',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  moviePoster: {
    width: 80,
    height: 120,
  },
  suggestionContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  movieTitleContainer: {
    marginBottom: 4,
  },
  movieTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  releaseYear: {
    fontSize: 14,
    marginTop: 2,
  },
  suggestedBy: {
    fontSize: 12,
    marginBottom: 8,
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  voteCount: {
    marginLeft: 4,
    fontSize: 12,
  },
  watchedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  watchedButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 4,
  },
  watchedCard: {
    flexDirection: 'row',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  watchedPoster: {
    width: 60,
    height: 90,
  },
  watchedContent: {
    flex: 1,
    padding: 12,
  },
  watchedDate: {
    fontSize: 12,
    marginTop: 4,
  },
  memberCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    margin: 4,
    borderRadius: 8,
  },
  memberAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  memberName: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 3.84px rgba(0,0,0,0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
    }),
  },
  // Banner styles
  bannerContainer: {
    width: '100%',
    height: 220,
    position: 'relative',
  },
  bannerBackground: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  bannerGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  bannerContent: {
    padding: 16,
    flex: 1,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomDetails: {
    marginTop: 'auto',
  },
  roomInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  roomInfoText: {
    flex: 1,
  },
  roomAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'white',
  },
  roomName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  roomMemberCount: {
    fontSize: 14,
    color: 'white',
    marginBottom: 8,
  },
  inviteCodeContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  inviteCodeLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  inviteCode: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});

