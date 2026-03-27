import { Link, Stack } from 'expo-router';
import { StyleSheet, View, Text } from 'react-native';
import { colors } from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Page not found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This page doesn&apos;t exist.</Text>
        <Text style={styles.subtitle}>The link may be invalid or expired.</Text>

        <Link href="/auth" style={styles.link}>
          <Text style={styles.linkText}>Go to Sign In</Text>
        </Link>
        <Link href="/" style={[styles.link, styles.linkSecondary]}>
          <Text style={styles.linkTextSecondary}>Go to home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.background.secondary,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  link: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  linkSecondary: {
    marginTop: 8,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  linkTextSecondary: {
    fontSize: 14,
    color: colors.text.secondary,
  },
});
