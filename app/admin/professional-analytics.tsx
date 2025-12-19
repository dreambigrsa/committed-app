import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Stack } from 'expo-router';
import { BarChart3 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function AdminProfessionalAnalyticsScreen() {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Professional Analytics' }} />
      <View style={styles.emptyContainer}>
        <BarChart3 size={64} color={themeColors.text.tertiary} />
        <Text style={styles.emptyText}>Professional Analytics</Text>
        <Text style={styles.emptySubtext}>View session analytics and performance metrics</Text>
        <Text style={styles.comingSoon}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  comingSoon: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
});

