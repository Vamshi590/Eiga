// User types
export interface User {
    id: string;
    email?: string | null;
    phone?: string | null;
    username: string;
    avatar_url: string;
    avatar: string;
    created_at: Date;
    watchedMovies?: WatchedMovie[];
    rooms?: string[];
    plan?: string;
    plan_period_end?: string | null;
  }
  
  // Movie types
  export interface Movie {
    /**
     * Optional: List of major awards (e.g. Oscars, Cannes) for display purposes.
     */
    awards?: string[];
    id: number;
    title: string;
    poster_path: string;
    backdrop_path?: string;
    overview: string;
    release_date: string;
    vote_average: number;
    genre_ids?: number[];
    genres?: { id: number; name: string }[];
    runtime?: number;
    /**
     * Languages the movie is available in
     */
    spoken_languages?: Array<{
      english_name?: string;
      name: string;
      iso_639_1?: string;
    }>;
    credits?: {
      cast: Array<{
        id: number;
        name: string;
        character: string;
        profile_path: string | null;
      }>;
      crew: Array<{
        id: number;
        name: string;
        job: string;
        department: string;
      }>;
    };
  }
  
  export interface WatchedMovie {
    id: string;
    movie: {
      id: number;
      title: string;
      poster_path: string;
      release_date?: string;
    };
    suggestedIn?: string;
    suggestedAt?: Date;
    watchedAt: Date;
  }
  
  export interface MovieSuggestion {
    id: string;
    suggestedBy: {
      id: string;
      username: string;
    };
    suggestedAt: Date;
    movie: Movie;
    votes: Array<{
      userId: string;
      vote: string;
      votedAt: string;
    }>;
  }
  
  // Room types
  export interface Room {
    id: string;
    name: string;
    description?: string;
    avatar: string;
    createdBy: string;
    createdAt: Date;
    members: string[];
    movies: MovieSuggestion[];
    invite_code: string;
  }
  
  // Provider types
  export interface Provider {
    id: number;
    name: string;
    logo_path: string;
  }
  
  // Genre types
  export interface Genre {
    id: number;
    name: string;
  }
  