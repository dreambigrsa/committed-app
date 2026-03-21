import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

type Props = {
  onOpen: () => void;
  /** Shown while user postponed the full-screen legal flow */
  subtitle?: string;
};

/**
 * Non-blocking reminder strip — tap opens the legal acceptance modal again.
 * Production UX: dismissible modal + persistent gentle reminder instead of hard-blocking navigation.
 */
export default function LegalReminderBanner({ onOpen, subtitle }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: Math.max(insets.top, 8),
          ...(Platform.OS === 'web' ? { top: 0 } : {}),
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.inner}
        onPress={onOpen}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="Review and accept required legal documents"
      >
        <Shield size={20} color={colors.text.white} />
        <View style={styles.textCol}>
          <Text style={styles.title}>Action needed: accept terms</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
        <Text style={styles.cta}>Review</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: {
  primary: string;
  text: { white: string };
}) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      zIndex: 9999,
      elevation: 9999,
    },
    inner: {
      marginHorizontal: 12,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    textCol: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text.white,
    },
    sub: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.88)',
      marginTop: 2,
    },
    cta: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text.white,
      textDecorationLine: 'underline',
    },
  });
}
