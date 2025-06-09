/**
 * Eiga App Color Scheme
 * Colors for the movie social platform app
 */

// Primary colors
const primaryColor = '#E50914'; // Netflix-inspired red
const secondaryColor = '#0063e5'; // Disney+ blue
const accentColor = '#00A8E1'; // Prime Video blue

export const Colors = {
  light: {
    text: '#11181C',
    background: '#FFFFFF',
    tint: primaryColor,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: primaryColor,
    primary: primaryColor,
    secondary: secondaryColor,
    accent: accentColor,
    card: '#F5F5F5',
    border: '#E0E0E0',
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',
    goodVote: '#4CAF50', // Green for good votes
    badVote: '#F44336', // Red for bad votes
    upvote: '#4CAF50', // Green for upvotes
    downvote: '#F44336', // Red for downvotes
    textSecondary: '#687076', // Secondary text color
  },
  dark: {
    text: '#ECEDEE',
    background: '#000000',
    tint: primaryColor,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: primaryColor,
    primary: primaryColor,
    secondary: secondaryColor,
    accent: accentColor,
    card: '#1E1E1E',
    border: '#333333',
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',
    goodVote: '#4CAF50', // Green for good votes
    badVote: '#F44336', // Red for bad votes
    upvote: '#4CAF50', // Green for upvotes
    downvote: '#F44336', // Red for downvotes
    textSecondary: '#9BA1A6', // Secondary text color
  },
};
