
// Movie-themed avatar URLs - Using reliable movie character themed avatars
const movieAvatars = [
    // Adventurer style
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Aria&backgroundColor=b6e3f4&radius=50',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Finn&backgroundColor=c0aede&radius=50',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Nova&backgroundColor=ffd5dc&radius=50',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Kai&backgroundColor=d1d4f9&radius=50',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Zane&backgroundColor=ffdfbf&radius=50',
    // Lorelei style
    'https://api.dicebear.com/7.x/lorelei/svg?seed=Willow&backgroundColor=b6e3f4&radius=50',
    'https://api.dicebear.com/7.x/lorelei/svg?seed=Jasper&backgroundColor=c0aede&radius=50',
    'https://api.dicebear.com/7.x/lorelei/svg?seed=Hazel&backgroundColor=ffd5dc&radius=50',
    'https://api.dicebear.com/7.x/lorelei/svg?seed=Rowan&backgroundColor=d1d4f9&radius=50',
    'https://api.dicebear.com/7.x/lorelei/svg?seed=Ember&backgroundColor=ffdfbf&radius=50',
    // Micah style
    'https://api.dicebear.com/7.x/micah/svg?seed=Sky&backgroundColor=b6e3f4&radius=50',
    'https://api.dicebear.com/7.x/micah/svg?seed=River&backgroundColor=c0aede&radius=50',
    'https://api.dicebear.com/7.x/micah/svg?seed=Ash&backgroundColor=ffd5dc&radius=50',
    'https://api.dicebear.com/7.x/micah/svg?seed=Blaze&backgroundColor=d1d4f9&radius=50',
    'https://api.dicebear.com/7.x/micah/svg?seed=Leaf&backgroundColor=ffdfbf&radius=50',
    // Miniavs style
    'https://api.dicebear.com/7.x/miniavs/svg?seed=Pixel&backgroundColor=b6e3f4&radius=50',
    'https://api.dicebear.com/7.x/miniavs/svg?seed=Dot&backgroundColor=c0aede&radius=50',
    'https://api.dicebear.com/7.x/miniavs/svg?seed=Spark&backgroundColor=ffd5dc&radius=50',
    'https://api.dicebear.com/7.x/miniavs/svg?seed=Chip&backgroundColor=d1d4f9&radius=50',
    'https://api.dicebear.com/7.x/miniavs/svg?seed=Bit&backgroundColor=ffdfbf&radius=50',
    // Personas style
    'https://api.dicebear.com/7.x/personas/svg?seed=Hero&backgroundColor=b6e3f4&radius=50',
    'https://api.dicebear.com/7.x/personas/svg?seed=Dreamer&backgroundColor=c0aede&radius=50',
    'https://api.dicebear.com/7.x/personas/svg?seed=Guardian&backgroundColor=ffd5dc&radius=50',
    'https://api.dicebear.com/7.x/personas/svg?seed=Explorer&backgroundColor=d1d4f9&radius=50',
    'https://api.dicebear.com/7.x/personas/svg?seed=Inventor&backgroundColor=ffdfbf&radius=50',
    // Bottts style (robots)
    'https://api.dicebear.com/7.x/bottts/svg?seed=Robo&backgroundColor=b6e3f4&radius=50',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Giga&backgroundColor=c0aede&radius=50',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Nano&backgroundColor=ffd5dc&radius=50',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Byte&backgroundColor=d1d4f9&radius=50',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Zeta&backgroundColor=ffdfbf&radius=50',
    // Fun-emoji style
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Joy&backgroundColor=b6e3f4&radius=50',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Sunny&backgroundColor=c0aede&radius=50',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Lucky&backgroundColor=ffd5dc&radius=50',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Peachy&backgroundColor=d1d4f9&radius=50',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Chill&backgroundColor=ffdfbf&radius=50',
  ];
  
  export const movieAvatarService = {
    // Get all movie avatars
    getAllMovieAvatars: () => {
      return movieAvatars;
    },
    
    // Get a random movie avatar
    getRandomMovieAvatar: () => {
      const randomIndex = Math.floor(Math.random() * movieAvatars.length);
      return movieAvatars[randomIndex];
    },
    
    // Get a subset of movie avatars for selection
    getMovieAvatarSelection: (count: number = 12) => {
      // Shuffle the array using Fisher-Yates algorithm
      const shuffled = [...movieAvatars];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      // Return the requested number of avatars
      return shuffled.slice(0, Math.min(count, shuffled.length));
    },
    
    // Generate a deterministic avatar based on a seed (room name)
    getAvatarForRoomName: (roomName: string) => {
      // Create a simple hash of the room name
      let hash = 0;
      for (let i = 0; i < roomName.length; i++) {
        hash = ((hash << 5) - hash) + roomName.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      
      // Use the hash to select an avatar
      const index = Math.abs(hash) % movieAvatars.length;
      return movieAvatars[index];
    }
  };
  