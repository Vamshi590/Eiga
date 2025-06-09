import { nanoid } from 'nanoid';
import { Movie, Room } from '../types';
import { generateAvatar } from './avatarService';
import { enforceRoomLimit, enforceRoomMemberLimit, enforceRoomMovieLimit, getUserPlan } from './subscriptionEnforcer';
import { supabase } from './supabase';
import { cacheService, CACHE_EXPIRY, CACHE_KEYS } from './cacheService';

// We'll use a different approach to handle the type for roomService

// Room service
export const roomService = {
  // Check if user can create a new room (for frontend UX limit checks)
  canCreateRoom: async (userId: string): Promise<{ allowed: boolean; reason?: string }> => {
    try {
      await enforceRoomLimit(userId);
      return { allowed: true };
    } catch (error: any) {
      if (error?.status === 403) {
        // Custom error thrown by enforceRoomLimit with a reason
        return { allowed: false, reason: error.message || 'Room creation limit reached' };
      }
      // Unexpected error
      return { allowed: false, reason: 'Unexpected error checking room limit' };
    }
  },

  // Check if user can suggest a movie in a room (for frontend UX limit checks)
  canSuggestMovie: async (roomId: string, userId: string): Promise<{ allowed: boolean; reason?: string }> => {
    try {
      const plan = await getUserPlan(userId);
      await enforceRoomMovieLimit(roomId, plan);
      return { allowed: true };
    } catch (error: any) {
      if (error?.status === 403) {
        // Custom error thrown by enforceRoomMovieLimit with a reason
        return { allowed: false, reason: error.message || 'Movie suggestion limit reached' };
      }
      // Unexpected error
      return { allowed: false, reason: 'Unexpected error checking movie limit' };
    }
  },
  // Create a new room
  createRoom: async (userId: string, roomName: string, roomAvatar?: string) => {
    try {
      // Enforce plan room limit
      await enforceRoomLimit(userId);
      // Generate room ID (for invite code) - using UUID format
      // We'll still keep a short code for display/invite purposes
      const shortCode = nanoid(6).toUpperCase();
      
      // Generate room avatar if not provided
      const avatar = roomAvatar || generateAvatar(roomName);
      
      // Create room in Supabase with UUID format
      const roomData = {
        // Let Supabase generate the UUID
        name: roomName,
        avatar,
        created_by: userId,
        created_at: new Date().toISOString(),
        members: [userId],
        // Store the short code as a property
        invite_code: shortCode
      };
      
      // Insert room into rooms table
      const { data: newRoom, error: roomError } = await supabase
        .from('rooms')
        .insert(roomData)
        .select('id')
        .single();
      
      if (roomError) throw roomError;
      
      // Add room to user's rooms in the room_members junction table
      const { error: roomMemberError } = await supabase
        .from('room_members')
        .insert({
          user_id: userId,
          room_id: newRoom.id,
          joined_at: new Date().toISOString()
        });
      
      if (roomMemberError) throw roomMemberError;
      
      // Return the complete room data with the generated ID as a proper Room object
      return {
        id: newRoom.id,
        name: roomName,
        avatar,
        createdBy: userId,
        createdAt: new Date(),
        members: [userId],
        invite_code: shortCode,
        movies: []
      };
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  },

  // Join a room
  joinRoom: async (userId: string, roomId: string) => {
    try {
      // Get user's plan
      const plan = await getUserPlan(userId);
      // Enforce member limit for this room
      await enforceRoomMemberLimit(roomId, plan);
      // Check if room exists
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      
      if (roomError) throw new Error('Room not found');
      if (!room) throw new Error('Room not found');
      
      // Check if user is already a member
      const { data: existingMembership, error: membershipError } = await supabase
        .from('room_members')
        .select('*')
        .eq('user_id', userId)
        .eq('room_id', roomId)
        .single();
      
      if (!membershipError && existingMembership) {
        // User is already a member
        return room;
      }
      
      // Add user to room members by updating the members array
      const { error: updateRoomError } = await supabase
        .from('rooms')
        .update({
          members: [...(room.members || []), userId]
        })
        .eq('id', roomId);
      
      if (updateRoomError) throw updateRoomError;
      
      // Add room to user's rooms in the room_members junction table
      const { error: roomMemberError } = await supabase
        .from('room_members')
        .insert({
          user_id: userId,
          room_id: roomId,
          joined_at: new Date().toISOString()
        });
      
      if (roomMemberError) throw roomMemberError;
      
      return room;
    } catch (error) {
      console.error('Error joining room:', error);
      throw error;
    }
  },

  // Get public rooms that users can join
  getPublicRooms: async (userId: string, limit = 10): Promise<Room[]> => {
    try {
      // First get the rooms the user is already a member of
      const { data: userRoomMembers, error: membershipError } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('user_id', userId);
      
      if (membershipError) throw membershipError;
      
      // Extract room IDs the user is already a member of
      const userRoomIds = userRoomMembers?.map(ur => ur.room_id) || [];
      
      // Get public rooms that the user is not a member of
      const query = supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      // If user is in some rooms, exclude those
      if (userRoomIds.length > 0) {
        query.not('id', 'in', `(${userRoomIds.join(',')})`);
      }
      
      const { data: publicRooms, error: roomsError } = await query;
      
      if (roomsError) throw roomsError;
      
      // Format the rooms
      return publicRooms.map(room => ({
        id: room.id,
        name: room.name,
        avatar: room.avatar,
        createdBy: room.created_by,
        createdAt: new Date(room.created_at),
        members: room.members || [],
        invite_code: room.invite_code,
        movies: []
      }));
    } catch (error) {
      console.error('Error getting public rooms:', error);
      throw error;
    }
  },

  // Get user's rooms with caching
  getUserRooms: async (userId: string): Promise<Room[]> => {
    return cacheService.withCache(
      CACHE_KEYS.USER_ROOMS,
      async () => {
        try {
          console.log('[ROOM SERVICE] Fetching user rooms from database');
          // Get rooms the user is a member of through the room_members junction table
          const { data: userRooms, error: userRoomsError } = await supabase
            .from('room_members')
            .select('room_id')
            .eq('user_id', userId);
          
          if (userRoomsError) throw userRoomsError;
          
          if (!userRooms || userRooms.length === 0) {
            return [];
          }
          
          // Extract room IDs
          const roomIds = userRooms.map(ur => ur.room_id);
          
          // Get room details
          const { data: rooms, error: roomsError } = await supabase
            .from('rooms')
            .select('*')
            .in('id', roomIds)
            .order('created_at', { ascending: false });
          
          if (roomsError) throw roomsError;
          
          if (!rooms) return [];
          
          // Get movie suggestions for each room
          const roomsWithMovies = await Promise.all(rooms.map(async (room) => {
            const { data: movieSuggestions, error: suggestionsError } = await supabase
              .from('movie_suggestions')
              .select('*, user:profiles!inner(*)')
              .eq('room_id', room.id);
            
            if (suggestionsError) {
              console.error('Error fetching movie suggestions:', suggestionsError);
              return {
                ...room,
                movies: [],
                createdBy: room.created_by,
                createdAt: new Date(room.created_at)
              };
            }
            
            // Format movie suggestions
            const formattedSuggestions = movieSuggestions.map(ms => ({
              id: ms.id,
              movie: {
                id: ms.movie_id,
                title: ms.movie_title,
                poster_path: ms.movie_poster_path,
                overview: ms.movie_overview,
                release_date: ms.movie_release_date,
                vote_average: ms.movie_vote_average
              },
              suggestedBy: {
                id: ms.user.id,
                username: ms.user.username
              },
              suggestedAt: new Date(ms.suggested_at),
              votes: ms.votes || []
            }));
            
            return {
              id: room.id,
              name: room.name,
              avatar: room.avatar,
              createdBy: room.created_by,
              createdAt: new Date(room.created_at),
              members: room.members || [],
              movies: formattedSuggestions,
              invite_code: room.invite_code
            };
          }));
          
          return roomsWithMovies;
        } catch (error) {
          console.error('Error getting user rooms:', error);
          throw error;
        }
      },
      userId,
      CACHE_EXPIRY.DEFAULT
    );
  },

  // Get room by ID with caching
  getRoomById: async (roomId: string): Promise<Room> => {
    return cacheService.withCache(
      CACHE_KEYS.ROOM_DETAILS,
      async () => {
        try {
          console.log('[ROOM SERVICE] Fetching room details from database for roomId:', roomId);
          // Get room details
          const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single();
          
          if (roomError) throw new Error('Room not found');
          if (!room) throw new Error('Room not found');
          
          // Get movie suggestions for the room
          const { data: movieSuggestions, error: suggestionsError } = await supabase
            .from('movie_suggestions')
            .select('*, user:profiles!inner(*)')
            .eq('room_id', roomId);
          
          if (suggestionsError) {
            console.error('Error fetching movie suggestions:', suggestionsError);
            return {
              ...room,
              movies: [],
              createdBy: room.created_by,
              createdAt: new Date(room.created_at)
            };
          }
          
          // Format movie suggestions
          const formattedSuggestions = movieSuggestions.map(ms => ({
            id: ms.id,
            movie: {
              id: ms.movie_id,
              title: ms.movie_title,
              poster_path: ms.movie_poster_path,
              overview: ms.movie_overview,
              release_date: ms.movie_release_date,
              vote_average: ms.movie_vote_average
            },
            suggestedBy: {
              id: ms.user.id,
              username: ms.user.username
            },
            suggestedAt: new Date(ms.suggested_at),
            votes: ms.votes || []
          }));
          
          return {
            id: room.id,
            name: room.name,
            avatar: room.avatar,
            createdBy: room.created_by,
            createdAt: new Date(room.created_at),
            members: room.members || [],
            movies: formattedSuggestions,
            invite_code: room.invite_code
          };
        } catch (error) {
          console.error('Error getting room by ID:', error);
          throw error;
        }
      },
      roomId,
      CACHE_EXPIRY.DEFAULT
    );
  },

  // Suggest movie in room
  suggestMovie: async (roomId: string, userId: string, movie: Movie) => {
    try {
      // Get user's plan
      const plan = await getUserPlan(userId);
      // Enforce movie suggestion limit for this room
      await enforceRoomMovieLimit(roomId, plan);
      // Check if movie already exists in room
      const { data: existingSuggestion, error: checkError } = await supabase
        .from('movie_suggestions')
        .select('id')
        .eq('room_id', roomId)
        .eq('movie_id', movie.id)
        .single();
      
      if (!checkError && existingSuggestion) {
        throw new Error('Movie already suggested in this room');
      }
      
      // Add movie to movie_suggestions table
      const movieSuggestion = {
        room_id: roomId,
        user_id: userId,
        movie_id: movie.id,
        movie_title: movie.title,
        movie_poster_path: movie.poster_path,
        movie_overview: movie.overview,
        movie_release_date: movie.release_date,
        movie_vote_average: movie.vote_average,
        suggested_at: new Date().toISOString(),
        votes: []
      };
      
      const { data: suggestion, error: suggestionError } = await supabase
        .from('movie_suggestions')
        .insert(movieSuggestion)
        .select('*, user:profiles!inner(*)')
        .single();
      
      if (suggestionError) throw suggestionError;
      
      // Add to user's watched movies
      const watchedMovie = {
        user_id: userId,
        movie_id: movie.id,
        movie_title: movie.title,
        movie_poster_path: movie.poster_path,
        movie_release_date: movie.release_date,
        suggested_in: roomId,
        watched_at: new Date().toISOString()
      };
      
      await supabase
        .from('watched_movies')
        .insert(watchedMovie)
        .then(({ error }) => {
          if (error) console.error('Error adding to watched movies:', error);
        });
      
      // Format the response
      return {
        id: suggestion.id,
        movie: {
          id: suggestion.movie_id,
          title: suggestion.movie_title,
          poster_path: suggestion.movie_poster_path,
          overview: suggestion.movie_overview,
          release_date: suggestion.movie_release_date,
          vote_average: suggestion.movie_vote_average
        },
        suggestedBy: {
          id: suggestion.user.id,
          username: suggestion.user.username
        },
        suggestedAt: new Date(suggestion.suggested_at),
        votes: suggestion.votes || []
      };
    } catch (error) {
      console.error('Error suggesting movie:', error);
      throw error;
    }
  },

  // Vote on movie
  voteOnMovie: async (roomId: string, userId: string, movieSuggestionId: string, vote: 'good' | 'bad') => {
    try {
      // First, get the current movie suggestion to get existing votes
      const { data: suggestion, error: suggestionError } = await supabase
        .from('movie_suggestions')
        .select('votes')
        .eq('id', movieSuggestionId)
        .eq('room_id', roomId)
        .single();
      
      if (suggestionError) throw new Error('Movie suggestion not found');
      
      // Initialize votes array if it doesn't exist
      const currentVotes = suggestion.votes || [];
      
      // Remove any existing votes by this user
      const filteredVotes = currentVotes.filter((v: any) => v.userId !== userId);
      
      // Add the new vote
      const newVotes = [
        ...filteredVotes,
        { userId, vote, votedAt: new Date().toISOString() }
      ];
      
      // Update the movie suggestion with the new votes
      const { data: updatedSuggestion, error: updateError } = await supabase
        .from('movie_suggestions')
        .update({ votes: newVotes })
        .eq('id', movieSuggestionId)
        .select('*, user:profiles!inner(*)')
        .single();
      
      if (updateError) throw updateError;
      
      // Format the response to match the expected format
      return {
        id: updatedSuggestion.id,
        movie: {
          id: updatedSuggestion.movie_id,
          title: updatedSuggestion.movie_title,
          poster_path: updatedSuggestion.movie_poster_path,
          overview: updatedSuggestion.movie_overview,
          release_date: updatedSuggestion.movie_release_date,
          vote_average: updatedSuggestion.movie_vote_average
        },
        suggestedBy: {
          id: updatedSuggestion.user_id,
          username: updatedSuggestion.user.username
        },
        suggestedAt: new Date(updatedSuggestion.suggested_at),
        votes: updatedSuggestion.votes
      };
    } catch (error) {
      console.error('Error voting on movie:', error);
      throw error;
    }
  },
  
  // Get movie suggestions for a room
  getMovieSuggestions: async (roomId: string) => {
    try {
      // Get movie suggestions for the room
      const { data: movieSuggestions, error: suggestionsError } = await supabase
        .from('movie_suggestions')
        .select('*, user:profiles!inner(*)')
        .eq('room_id', roomId);
      
      if (suggestionsError) throw suggestionsError;
      
      // Format movie suggestions
      return movieSuggestions.map(ms => ({
        id: ms.id,
        movie: {
          id: ms.movie_id,
          title: ms.movie_title,
          poster_path: ms.movie_poster_path,
          overview: ms.movie_overview,
          release_date: ms.movie_release_date,
          vote_average: ms.movie_vote_average
        },
        suggestedBy: {
          id: ms.user.id,
          username: ms.user.username
        },
        suggestedAt: new Date(ms.suggested_at),
        votes: ms.votes || []
      }));
    } catch (error) {
      console.error('Error getting movie suggestions:', error);
      throw error;
    }
  },
  
  // Get user's watched movies with caching
  getUserWatchedMovies: async (userId: string) => {
    return cacheService.withCache(
      CACHE_KEYS.USER_WATCHED_MOVIES,
      async () => {
        try {
          console.log('[ROOM SERVICE] Fetching watched movies from database for userId:', userId);
          const { data: watchedMovies, error } = await supabase
            .from('watched_movies')
            .select('*')
            .filter('user_id', 'eq', userId)
            .order('watched_at', { ascending: false });
          
          if (error) throw error;
          if (!watchedMovies || watchedMovies.length === 0) {
            return [];
          }
          // For each watched movie, try to construct a nested movie object with as much info as possible
          // If genres/runtime are missing, fetch from TMDB
          const enrichedMovies = await Promise.all(
            watchedMovies.map(async (wm: any) => {
              let movieDetails = {
                id: wm.movie_id,
                title: wm.movie_title,
                poster_path: wm.movie_poster_path,
                backdrop_path: wm.movie_backdrop_path,
                overview: wm.movie_overview,
                release_date: wm.movie_release_date,
                vote_average: wm.movie_vote_average,
                runtime: wm.movie_runtime,
                genres: wm.movie_genres, // May be null
                genre_ids: wm.movie_genre_ids, // May be null
              };
              // If genres or runtime missing, fetch from TMDB
              if (!movieDetails.genres || !movieDetails.runtime) {
                try {
                  const tmdbDetails = await require('../services/tmdbApi').tmdbService.getMovieDetails(wm.movie_id);
                  if (tmdbDetails) {
                    movieDetails = {
                      ...movieDetails,
                      genres: tmdbDetails.genres,
                      genre_ids: tmdbDetails.genre_ids,
                      runtime: tmdbDetails.runtime,
                      backdrop_path: tmdbDetails.backdrop_path || movieDetails.backdrop_path,
                      poster_path: tmdbDetails.poster_path || movieDetails.poster_path,
                      overview: tmdbDetails.overview || movieDetails.overview,
                      release_date: tmdbDetails.release_date || movieDetails.release_date,
                      vote_average: tmdbDetails.vote_average || movieDetails.vote_average,
                    };
                  }
                } catch (err) {
                  // If TMDB fails, keep what we have
                }
              }
              return {
                id: wm.id,
                movie: movieDetails,
                watchedAt: wm.watched_at ? new Date(wm.watched_at) : undefined,
                suggestedIn: wm.suggested_in,
                suggestedAt: wm.suggested_at ? new Date(wm.suggested_at) : undefined,
              };
            })
          );
          return enrichedMovies;
        } catch (error) {
          console.error('Error getting user watched movies:', error);
          throw error;
        }
      },
      userId,
      CACHE_EXPIRY.DEFAULT
    );
  },
  
  // Get watched movies for a room with caching
  getWatchedMovies: async (roomId: string) => {
    return cacheService.withCache(
      CACHE_KEYS.ROOM_WATCHED_MOVIES,
      async () => {
        try {
          console.log('[ROOM SERVICE] Fetching watched movies for room:', roomId);
          const { data: watchedMovies, error } = await supabase
            .from('watched_movies')
            .select('*')
            .eq('suggested_in', roomId)
            .order('watched_at', { ascending: false });
          
          if (error) throw error;
          
          if (!watchedMovies) return [];
          
          // Format the response to match the expected format
          return watchedMovies.map(movie => ({
            id: movie.id,
            movie: {
              id: movie.movie_id,
              title: movie.movie_title,
              poster_path: movie.movie_poster_path,
              release_date: movie.movie_release_date
            },
            watchedAt: new Date(movie.watched_at)
          }));
        } catch (error) {
          console.error('Error getting watched movies:', error);
          throw error;
        }
      },
      roomId,
      CACHE_EXPIRY.DEFAULT
    );
  },
  
  // Get room members with caching
  getRoomMembers: async (roomId: string) => {
    return cacheService.withCache(
      CACHE_KEYS.ROOM_MEMBERS,
      async () => {
        try {
          console.log('[ROOM SERVICE] Fetching room members for roomId:', roomId);
          // Get user_ids from room_members table for this room
          const { data: roomMembers, error: roomMembersError } = await supabase
            .from('room_members')
            .select('user_id')
            .eq('room_id', roomId);
          
          if (roomMembersError) throw roomMembersError;
          if (!roomMembers || roomMembers.length === 0) return [];
          
          const memberIds = roomMembers.map(m => m.user_id);
          // Get user profiles for all members
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', memberIds);
          
          if (profilesError) throw profilesError;
          if (!profiles) return [];
          
          // Format the response
          return profiles.map(profile => ({
            id: profile.id,
            username: profile.username || 'Anonymous',
            avatar: profile.avatar_url || 'https://via.placeholder.com/150'
          }));
        } catch (error) {
          console.error('Error getting room members:', error);
          throw error;
        }
      },
      roomId,
      CACHE_EXPIRY.DEFAULT
    );
  },
  
  // Mark movie as watched
  markMovieAsWatched: async (roomId: string | null, userId: string, movie: Movie) => {
    try {
      // Ensure movie ID is a number
      const movieIdNumber = typeof movie.id === 'string' ? parseInt(movie.id, 10) : movie.id;
      
      // Use raw SQL query to check if the movie is already watched
      // This avoids type conversion issues between UUID and INTEGER
      const { data: existingMovies, error: checkError } = await supabase
        .from('watched_movies')
        .select('id')
        .filter('user_id', 'eq', userId)
        .filter('movie_id', 'eq', movieIdNumber)
        .limit(1);
      
      if (checkError) {
        console.error('Error checking if movie is already watched:', checkError);
        // Continue anyway to try the insert
      }
      
      // If movie is already in the watched list, don't add it again
      if (existingMovies && existingMovies.length > 0) {
        console.log('Movie already in watched list');
        return true;
      }
      
      // Create the watched movie object
      const watchedMovie = {
        user_id: userId,
        movie_id: movieIdNumber, // This is an INTEGER in the database
        movie_title: movie.title || '',
        movie_poster_path: movie.poster_path || '',
        movie_overview: movie.overview || '',
        movie_release_date: movie.release_date || '',
        movie_vote_average: movie.vote_average || 0,
        suggested_in: roomId || null,
        watched_at: new Date().toISOString()
      };
      
      // Use raw SQL to insert the watched movie to avoid type conversion issues
      const { error: insertError } = await supabase
        .from('watched_movies')
        .insert([
          {
            ...watchedMovie,
            // Ensure types match what the database expects
            user_id: userId, // UUID
            movie_id: movieIdNumber // INTEGER
          }
        ]);
      
      if (insertError) {
        console.error('Error inserting watched movie:', insertError);
        
        // Try an alternative approach with explicit SQL if needed
        if (insertError.code === '22P02') { // Invalid input syntax error
          // Use a more direct approach with the REST API
          // Get the URL and key from the environment
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xrruuwevmrmllqsouvtv.supabase.co';
          const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
          
          const response = await fetch(`${supabaseUrl}/rest/v1/watched_movies`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              user_id: userId,
              movie_id: movieIdNumber,
              movie_title: movie.title || '',
              movie_poster_path: movie.poster_path || '',
              movie_overview: movie.overview || '',
              movie_release_date: movie.release_date || '',
              movie_vote_average: movie.vote_average || 0,
              suggested_in: roomId || null,
              watched_at: new Date().toISOString()
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('Error with direct API insert:', errorData);
            throw new Error(`Failed to mark movie as watched: ${errorData.message || response.statusText}`);
          }
        } else {
          throw insertError;
        }
      }
      
      // Remove from suggestions if present
      if (roomId) {
        try {
          const { error: deleteError } = await supabase
            .from('movie_suggestions')
            .delete()
            .eq('room_id', roomId)
            .eq('movie_id', movieIdNumber);
            
          if (deleteError) {
            console.error('Error removing movie suggestion:', deleteError);
            // Continue even if there's an error with deletion
          }
        } catch (deleteErr) {
          console.error('Exception removing movie suggestion:', deleteErr);
          // Continue even if there's an error
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error marking movie as watched:', error);
      throw error;
    }
  },

  // Get comprehensive user data including rooms and watched movies
  getUserData: async (userId: string) => {
    try {
      console.log('[ROOM SERVICE] getUserData called for userId:', userId);
      
      // Get user profile
      console.log('[ROOM SERVICE] Fetching user profile from supabase...');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.error('[ROOM SERVICE] Profile fetch error:', profileError);
        throw new Error('User not found');
      }
      
      console.log('[ROOM SERVICE] Profile fetched successfully:', profile ? 'profile exists' : 'no profile');
      
      // Get user's rooms
      console.log('[ROOM SERVICE] Fetching user rooms...');
      const rooms = await roomService.getUserRooms(userId);
      console.log('[ROOM SERVICE] Rooms fetched:', rooms ? `${rooms.length} rooms` : 'no rooms');
      
      // Get user's watched movies
      console.log('[ROOM SERVICE] Fetching user watched movies...');
      const watchedMovies = await roomService.getUserWatchedMovies(userId);
      console.log('[ROOM SERVICE] Watched movies fetched:', watchedMovies ? `${watchedMovies.length} movies` : 'no movies');
      
      const userData = {
        ...profile,
        rooms,
        watchedMovies
      };
      
      console.log('[ROOM SERVICE] getUserData complete, returning data with:', 
        userData.watchedMovies ? `${userData.watchedMovies.length} watched movies` : 'no watched movies',
        userData.rooms ? `${userData.rooms.length} rooms` : 'no rooms');
      
      return userData;
    } catch (error) {
      console.error('[ROOM SERVICE] Error getting user data:', error);
      throw error;
    }
  },

  // Check if a room exists by invite code
  checkRoomExists: async (inviteCode: string) => {
    try {
      // Check if room exists with this invite code
      const { data: room, error } = await supabase
        .from('rooms')
        .select('id, name, avatar, created_by, created_at, members, invite_code')
        .eq('invite_code', inviteCode)
        .single();
      
      if (error) {
        // Room not found or other error
        return { exists: false, room: null };
      }
      
      if (!room) {
        return { exists: false, room: null };
      }
      
      // Format the room data to match our Room type
      const formattedRoom = {
        id: room.id,
        name: room.name,
        avatar: room.avatar,
        createdBy: room.created_by,
        createdAt: new Date(room.created_at),
        members: room.members || [],
        invite_code: room.invite_code,
        movies: []
      };
      
      return { exists: true, room: formattedRoom };
    } catch (error) {
      console.error('Error checking if room exists:', error);
      return { exists: false, room: null };
    }
  },
  
  // Join room by code
  joinRoomByCode: async (code: string) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('You must be signed in to join a room');
      }
      
      // Check if room exists with this code
      const { exists, room } = await roomService.checkRoomExists(code);
      
      if (!exists || !room) {
        throw new Error('Invalid room code');
      }
      
      // Check if user is already a member
      if (room.members.includes(user.id)) {
        throw new Error('You are already a member of this room');
      }
      
      // Get user plan and enforce room member limit
      const plan = await getUserPlan(user.id);
      await enforceRoomMemberLimit(room.id, plan);
      
      // Add user to room
      const { error } = await supabase
        .from('rooms')
        .update({
          members: [...room.members, user.id]
        })
        .eq('id', room.id);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error: any) {
      console.error('Error joining room by code:', error);
      throw new Error(error.message || 'Failed to join room');
    }
  },

  // Remove user from room
  removeUserFromRoom: async (roomId: string, userId: string) => {
    try {
      // Remove user from room_members junction table
      const { error: roomMemberError } = await supabase
        .from('room_members')
        .delete()
        .eq('user_id', userId)
        .eq('room_id', roomId);
      
      if (roomMemberError) throw roomMemberError;
      
      // Get the current room data to update the members array
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      
      if (roomError) throw roomError;
      
      // Remove user from the members array
      const updatedMembers = (room.members || []).filter((memberId: string) => memberId !== userId);
      
      // Update the room with the new members array
      const { error: updateRoomError } = await supabase
        .from('rooms')
        .update({
          members: updatedMembers
        })
        .eq('id', roomId);
      
      if (updateRoomError) throw updateRoomError;
      
      
      return true;
    } catch (error) {
      console.error('Error removing user from room:', error);
      throw error;
    }
  }
};