import React from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Image as ExpoImage } from 'expo-image';

export default function PaymentProofViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUrl: string }>();
  useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    imageContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    closeButton: {
      position: 'absolute',
      top: 60,
      right: 20,
      zIndex: 10,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 20,
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => router.back()}
      >
        <X size={24} color="#fff" />
      </TouchableOpacity>
      <View style={styles.imageContainer}>
        <ExpoImage
          source={{ uri: params.imageUrl }}
          style={styles.image}
          contentFit="contain"
          transition={200}
        />
      </View>
    </SafeAreaView>
  );
}

