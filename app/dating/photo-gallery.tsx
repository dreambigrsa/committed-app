import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { DatingPhoto } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PhotoGalleryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const photos: DatingPhoto[] = params.photos ? JSON.parse(params.photos as string) : [];
  const initialIndex = params.initialIndex ? parseInt(params.initialIndex as string) : 0;
  
  // Handle both old format (array of objects) and new format
  const photoUrls = photos.map((p: any) => 
    typeof p === 'string' ? p : (p.photo_url || p.photoUrl || p)
  );
  const userName = params.userName as string;
  const userAge = params.userAge ? parseInt(params.userAge as string) : undefined;
  
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollViewRef.current && initialIndex > 0) {
      scrollViewRef.current.scrollTo({
        x: initialIndex * SCREEN_WIDTH,
        animated: false,
      });
    }
  }, [initialIndex]);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const goToNext = () => {
    if (currentIndex < photos.length - 1) {
      const nextIndex = currentIndex + 1;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentIndex(nextIndex);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      scrollViewRef.current?.scrollTo({
        x: prevIndex * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentIndex(prevIndex);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color={colors.text.white} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {userName && (
            <Text style={styles.headerName}>
              {userName}
              {userAge && `, ${userAge}`}
            </Text>
          )}
          <Text style={styles.headerCount}>
            {currentIndex + 1} / {photos.length}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Photo Scroll */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {photos.map((photo: any, index: number) => (
          <View key={photo.id || index} style={styles.photoContainer}>
            <ExpoImage
              source={{ uri: photo.photo_url || photo.photoUrl }}
              style={styles.photo}
              contentFit="contain"
            />
          </View>
        ))}
      </ScrollView>

      {/* Navigation Buttons */}
      {currentIndex > 0 && (
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonLeft]}
          onPress={goToPrev}
        >
          <ChevronLeft size={32} color={colors.text.white} />
        </TouchableOpacity>
      )}

      {currentIndex < photos.length - 1 && (
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonRight]}
          onPress={goToNext}
        >
          <ChevronRight size={32} color={colors.text.white} />
        </TouchableOpacity>
      )}

      {/* Photo Indicators */}
      {photos.length > 1 && (
        <View style={styles.indicators}>
          {photos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentIndex && styles.indicatorActive,
              ]}
            />
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerInfo: {
      flex: 1,
      alignItems: 'center',
    },
    headerName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.white,
      marginBottom: 2,
    },
    headerCount: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.7)',
    },
    scrollView: {
      flex: 1,
    },
    photoContainer: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
    },
    photo: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
    },
    navButton: {
      position: 'absolute',
      top: '50%',
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    navButtonLeft: {
      left: 16,
    },
    navButtonRight: {
      right: 16,
    },
    indicators: {
      position: 'absolute',
      bottom: 40,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    indicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    indicatorActive: {
      backgroundColor: '#fff',
      width: 24,
    },
  });

