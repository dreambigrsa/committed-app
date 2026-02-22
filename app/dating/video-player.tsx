import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Video, ResizeMode } from 'expo-av';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function VideoPlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ videoUrl: string }>();
  useTheme();
  const videoRef = useRef<Video>(null);
  const [isLoading, setIsLoading] = useState(true);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    video: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
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
    loadingContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => router.back()}
      >
        <X size={24} color="#fff" />
      </TouchableOpacity>
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      <Video
        ref={videoRef}
        source={{ uri: params.videoUrl }}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping
        onLoad={() => setIsLoading(false)}
        onError={(error) => {
          console.error('Video error:', error);
          setIsLoading(false);
        }}
      />
    </SafeAreaView>
  );
}

