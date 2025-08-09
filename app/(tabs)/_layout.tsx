import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary || '#E50914',
        tabBarInactiveTintColor: colors.icon || '#888',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: StyleSheet.create({
          tabBar: {
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
            borderTopWidth: 0,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            backgroundColor: colors.card || '#121212',
            ...Platform.select({
              ios: {
                position: 'absolute',
              },
              default: {},
            }),
          },
        }).tabBar,
        tabBarLabelStyle: {
          fontWeight: '500',
          fontSize: 11,
          marginTop: 2,
        },
      }}>

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="compass" 
              size={24} 
              color={color} 
              style={focused ? styles.activeIcon : {}}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          title: 'Rooms',
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="users" 
              size={24} 
              color={color} 
              style={focused ? styles.activeIcon : {}}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="swipe"
        options={{
          title: 'Swipe',
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="layers" 
              size={24} 
              color={color} 
              style={focused ? styles.activeIcon : {}}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="watched"
        options={{
          title: 'Watched',
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="check-circle" 
              size={24} 
              color={color} 
              style={focused ? styles.activeIcon : {}}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="user" 
              size={24} 
              color={color} 
              style={focused ? styles.activeIcon : {}}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIcon: {
    transform: [{ scale: 1.1 }],
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
});
