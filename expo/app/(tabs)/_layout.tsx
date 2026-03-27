import { Tabs } from "expo-router";
import { Home, Search, User, MessageSquare, Film, Heart, Sparkles } from "lucide-react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import NotificationBadgeIcon from "@/components/NotificationBadgeIcon";

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Calculate tab bar height: base height (64) + safe area bottom inset
  const tabBarHeight = 64 + insets.bottom;
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
          backgroundColor: colors.background.primary,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          height: tabBarHeight,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600' as const,
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
        tabBarLabelPosition: 'below-icon',
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Home size={focused ? 26 : 24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, focused }) => (
            <Heart size={focused ? 26 : 24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: "Reels",
          tabBarIcon: ({ color, focused }) => (
            <Film size={focused ? 26 : 24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="dating"
        options={{
          title: "Dating",
          tabBarIcon: ({ color, focused }) => (
            <Sparkles size={focused ? 26 : 24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, focused }) => (
            <Search size={focused ? 26 : 24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notify",
          tabBarIcon: ({ color, focused }) => (
            <NotificationBadgeIcon color={color} size={focused ? 26 : 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, focused }) => (
            <MessageSquare size={focused ? 26 : 24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <User size={focused ? 26 : 24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
    </Tabs>
  );
}
