import React, { useCallback } from 'react';
import { BackHandler, TouchableOpacity } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { navigateToDatingHome } from '@/lib/dating-navigation';

export default function DatingLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (pathname?.startsWith('/dating/')) {
          navigateToDatingHome(router);
          return true;
        }

        return false;
      });

      return () => subscription.remove();
    }, [pathname, router])
  );

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background.primary },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { color: colors.text.primary },
        headerShadowVisible: true,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => navigateToDatingHome(router)}
            style={{ paddingHorizontal: 8, paddingVertical: 6, marginLeft: -8 }}
            accessibilityRole="button"
            accessibilityLabel="Back to Dating"
          >
            <ArrowLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
        ),
      }}
    />
  );
}
