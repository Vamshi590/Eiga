/**
 * Avatar Service
 * 
 * This service provides functions to generate and manage avatars for users and rooms.
 * It uses DiceBear API to generate consistent avatars based on a seed value.
 */

// DiceBear API for avatar generation
const DICEBEAR_BASE_URL = 'https://api.dicebear.com/7.x';

// Available avatar styles
const AVATAR_STYLES = {
  USER: 'avataaars', // For user avatars
  ROOM: 'identicon',  // For room avatars
};

/**
 * Generate a random color from a predefined palette
 * @returns Hex color code
 */
const getRandomColor = (): string => {
  const colors = [
    '1abc9c', '2ecc71', '3498db', '9b59b6', '34495e',
    'f1c40f', 'e67e22', 'd35400', 'e74c3c', 'ecf0f1',
    '95a5a6', '7f8c8d', 'bdc3c7', 'c0392b', '16a085'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Generate an avatar URL for a user
 * @param seed Seed value to generate consistent avatar (usually user ID or name)
 * @returns URL to the generated avatar
 */
export const generateUserAvatar = (seed: string): string => {
  const style = AVATAR_STYLES.USER;
  const backgroundColor = getRandomColor();
  
  return `${DICEBEAR_BASE_URL}/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${backgroundColor}`;
};

/**
 * Generate an avatar URL for a room
 * @param seed Seed value to generate consistent avatar (usually room name or ID)
 * @returns URL to the generated avatar
 */
export const generateRoomAvatar = (seed: string): string => {
  const style = AVATAR_STYLES.ROOM;
  const backgroundColor = getRandomColor();
  
  return `${DICEBEAR_BASE_URL}/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${backgroundColor}`;
};

/**
 * Generate avatar based on input (wrapper function)
 * @param seed Seed value for the avatar
 * @param type Type of avatar to generate (defaults to room)
 * @returns URL to the generated avatar
 */
export const generateAvatar = (seed: string, type: 'user' | 'room' = 'room'): string => {
  return type === 'user' 
    ? generateUserAvatar(seed)
    : generateRoomAvatar(seed);
};

/**
 * Get initials from a name (for fallback avatars)
 * @param name Full name
 * @returns Initials (up to 2 characters)
 */
export const getInitials = (name: string): string => {
  if (!name) return '?';
  
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};
