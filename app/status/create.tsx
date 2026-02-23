/**
 * Create Status Screen
 * 
 * Facebook-style story creation with full-screen text input,
 * vertical options on the right, color picker, text effects,
 * alignment, fonts, and background image support.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  FlatList,
  Dimensions,
  KeyboardAvoidingView,
  StatusBar,
  SafeAreaView,
  Modal,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { createStatus, getUserStatuses, getSignedUrlForMedia } from '@/lib/status-queries';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { 
  X, 
  Settings, 
  Music, 
  Type,
  Image as ImageIcon, 
  Grid3x3,
  ChevronDown,
  MoreHorizontal,
  Smile,
  Camera,
  Check,
  ChevronRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Upload,
} from 'lucide-react-native';
import StickerPicker from '@/components/StickerPicker';
import { Sticker } from '@/types';

const { width, height } = Dimensions.get('window');
const GRID_ITEM_SIZE = (width - 48) / 3;

type ScreenMode = 'gallery' | 'text' | 'privacy' | 'preview';
type TextEffect = 'default' | 'white-bg' | 'black-bg' | 'outline-white' | 'outline-black' | 'glow';
type TextAlignment = 'left' | 'center' | 'right';
type FontStyle = 'classic' | 'neon' | 'typewriter' | 'elegant' | 'bold' | 'italic';

export default function CreateStatusScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { currentUser } = useApp();
  const [screenMode, setScreenMode] = useState<ScreenMode>('gallery');
  const [textContent, setTextContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [backgroundImageUri, setBackgroundImageUri] = useState<string | null>(null);
  const [contentType, setContentType] = useState<'text' | 'image' | 'video'>('text');
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'friends' | 'followers' | 'only_me'>('friends');
  const [isPosting, setIsPosting] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedGallery, setSelectedGallery] = useState<string>('Gallery');
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [showVideoTrimmer, setShowVideoTrimmer] = useState(false);
  const [videoToTrim, setVideoToTrim] = useState<MediaLibrary.Asset | null>(null);
  /* eslint-disable @typescript-eslint/no-unused-vars -- trim setters kept for future video trimmer UI */
  const [, setTrimStartTime] = useState(0);
  const [, setTrimEndTime] = useState(15);
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const [textStyle, setTextStyle] = useState<FontStyle>('classic');
  const [textEffect, setTextEffect] = useState<TextEffect>('default');
  const [textAlignment, setTextAlignment] = useState<TextAlignment>('center');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string>>({});
  
  // Cycle through text effects when Aa button is clicked
  const cycleTextEffect = () => {
    const effects: TextEffect[] = ['default', 'white-bg', 'black-bg', 'outline-white', 'outline-black', 'glow'];
    const currentIndex = effects.indexOf(textEffect);
    const nextIndex = (currentIndex + 1) % effects.length;
    const nextEffect = effects[nextIndex];
    setTextEffect(nextEffect);
    console.log('🎨 Text effect changed to:', nextEffect); // Debug log
  };

  // Cycle through text alignment when alignment button is clicked
  const cycleTextAlignment = () => {
    const alignments: TextAlignment[] = ['left', 'center', 'right'];
    const currentIndex = alignments.indexOf(textAlignment);
    const nextIndex = (currentIndex + 1) % alignments.length;
    setTextAlignment(alignments[nextIndex]);
  };
  const [textBackgroundColor, setTextBackgroundColor] = useState<string>('#1A73E8');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [, setLastStatus] = useState<any>(null);
  const [, setLastStatusMediaUrl] = useState<string | null>(null);
  const [, setSelectedMedia] = useState<MediaLibrary.Asset | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [selectedStickers, setSelectedStickers] = useState<{ id: string; imageUrl: string; positionX?: number; positionY?: number; scale?: number; rotation?: number }[]>([]);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showMutedStories, setShowMutedStories] = useState(false);
  const [showOverlayEditor, setShowOverlayEditor] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const [overlayPos, setOverlayPos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.35 }); // normalized
  const [previewSize, setPreviewSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const overlayDragging = useRef(false);
  const overlayStartPos = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.35 });
  const [activeStickerIndex, setActiveStickerIndex] = useState<number | null>(null);
  const stickerStartPos = useRef<Record<number, { x: number; y: number }>>({});
  const stickerStartScale = useRef<Record<number, number>>({});
  const stickerInitialTouchDistance = useRef<Record<number, number>>({});
  const stickerPanResponders = useRef<Record<number, any>>({});
  const selectedStickersRef = useRef(selectedStickers);
  const previewSizeRef = useRef(previewSize);
  
  // Keep refs in sync with state
  useEffect(() => {
    selectedStickersRef.current = selectedStickers;
  }, [selectedStickers]);
  
  useEffect(() => {
    previewSizeRef.current = previewSize;
  }, [previewSize]);

  const overlayPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: () => {
        overlayStartPos.current = overlayPos;
        overlayDragging.current = true;
      },
      onPanResponderMove: (_, gesture) => {
        if (!previewSize.w || !previewSize.h) return;
        const nextX = Math.max(0, Math.min(1, overlayStartPos.current.x + gesture.dx / previewSize.w));
        const nextY = Math.max(0, Math.min(1, overlayStartPos.current.y + gesture.dy / previewSize.h));
        setOverlayPos({ x: nextX, y: nextY });
      },
      onPanResponderRelease: () => {
        overlayDragging.current = false;
      },
      onPanResponderTerminate: () => {
        overlayDragging.current = false;
      },
    })
  ).current;

  // Create PanResponder for a sticker
  const createStickerPanResponder = (index: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: (evt) => {
        setActiveStickerIndex(index);
        const stickers = selectedStickersRef.current;
        const size = previewSizeRef.current;
        const sticker = stickers[index];
        if (!sticker) return;
        
        const currentPosX = sticker.positionX ?? 0.5;
        const currentPosY = sticker.positionY ?? 0.4;
        
        // Store initial position in pixels (absolute position)
        stickerStartPos.current[index] = {
          x: currentPosX * (size.w || width),
          y: currentPosY * (size.h || height),
        };
        stickerStartScale.current[index] = sticker.scale ?? 1.0;
        
        // Calculate initial distance for pinch gesture
        if (evt.nativeEvent.touches.length === 2) {
          const touch1 = evt.nativeEvent.touches[0];
          const touch2 = evt.nativeEvent.touches[1];
          stickerInitialTouchDistance.current[index] = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) + 
            Math.pow(touch2.pageY - touch1.pageY, 2)
          );
        } else {
          stickerInitialTouchDistance.current[index] = 0;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const size = previewSizeRef.current;
        if (!size.w || !size.h) return;
        
        const stickers = selectedStickersRef.current;
        const sticker = stickers[index];
        if (!sticker) return;
        const startPos = stickerStartPos.current[index] || { x: 0, y: 0 };
        const startScale = stickerStartScale.current[index] || 1.0;
        const initialDistance = stickerInitialTouchDistance.current[index] || 0;
        
        // Handle two-finger pinch for scaling
        if (evt.nativeEvent.touches.length === 2 && initialDistance > 0) {
          const touch1 = evt.nativeEvent.touches[0];
          const touch2 = evt.nativeEvent.touches[1];
          const currentDistance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) + 
            Math.pow(touch2.pageY - touch1.pageY, 2)
          );
          
          const scaleFactor = currentDistance / initialDistance;
          const newScale = Math.max(0.3, Math.min(5.0, startScale * scaleFactor));
          
          setSelectedStickers((prev) => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index] = {
                ...updated[index],
                scale: newScale,
              };
            }
            return updated;
          });
        } else if (evt.nativeEvent.touches.length === 1) {
          // Single finger drag - calculate absolute position from start position
          const newPixelX = startPos.x + gestureState.dx;
          const newPixelY = startPos.y + gestureState.dy;
          
          // Convert to normalized coordinates (0-1)
          const newX = Math.max(0, Math.min(1, newPixelX / size.w));
          const newY = Math.max(0, Math.min(1, newPixelY / size.h));
          
          setSelectedStickers((prev) => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index] = {
                ...updated[index],
                positionX: newX,
                positionY: newY,
              };
            }
            return updated;
          });
        }
      },
      onPanResponderRelease: () => {
        setActiveStickerIndex(null);
      },
      onPanResponderTerminate: () => {
        setActiveStickerIndex(null);
      },
    });
  };

  const bgColor = isDark ? '#000' : '#fff';
  const textColor = isDark ? '#fff' : '#000';
  const cardBg = isDark ? '#1a1a1a' : '#f5f5f5';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const colorPalette = [
    '#1A73E8', '#1877F2', '#42A5F5', '#66BB6A', '#34A853',
    '#EF5350', '#EA4335', '#FFA726', '#FBBC04', '#AB47BC',
    '#EC407A', '#FF5722', '#00BCD4', '#009688', '#4CAF50',
    '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800',
    '#FF5722', '#F44336', '#E91E63', '#9C27B0', '#673AB7',
    '#3F51B5', '#2196F3', '#00BCD4', '#009688', '#4CAF50',
    '#000000', '#FFFFFF', '#808080', '#C0C0C0',
  ];

  useEffect(() => {
    loadMediaAssets();
    loadLastStatus();
    loadAlbums();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount
  }, []);

  useEffect(() => {
    if (selectedAlbumId) {
      loadMediaAssets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on album change
  }, [selectedAlbumId]);

  const loadAlbums = async () => {
    // Request read permissions for accessing videos/photos (audioPermission: false in config prevents audio permission request)
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return;

    try {
      const albumsData = await MediaLibrary.getAlbumsAsync();
      setAlbums(albumsData);
    } catch (error) {
      console.error('Error loading albums:', error);
    }
  };

  const loadMediaAssets = async () => {
    try {
      // Request read permissions for accessing videos/photos (audioPermission: false in config prevents audio permission request)
      // Videos with audio tracks are handled by video permissions, not separate audio permission
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photos and videos to create stories.');
        return;
      }

      const options: MediaLibrary.AssetsOptions = {
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: MediaLibrary.SortBy.creationTime,
        first: 100,
      };

      if (selectedAlbumId) {
        options.album = selectedAlbumId;
      }

      const assets = await MediaLibrary.getAssetsAsync(options);
      setMediaAssets(assets.assets || []);
      
      // Load thumbnails for videos (async, don't block)
      const videoAssets = (assets.assets || []).filter(a => a.mediaType === 'video');
      if (videoAssets.length > 0) {
        const thumbnailPromises = videoAssets.map(async (asset) => {
          try {
            const info = await MediaLibrary.getAssetInfoAsync(asset);
            // Use thumbnail URI if available, otherwise fall back to asset URI
            const thumbnailUri = (info as any)?.localUri || (info as any)?.uri || asset.uri;
            return { id: asset.id, uri: thumbnailUri };
          } catch (error) {
            console.error('Error loading thumbnail for asset:', asset.id, error);
            return { id: asset.id, uri: asset.uri };
          }
        });
        
        Promise.all(thumbnailPromises).then((thumbnails) => {
          const thumbnailMap: Record<string, string> = {};
          thumbnails.forEach(({ id, uri }) => {
            thumbnailMap[id] = uri;
          });
          setVideoThumbnails((prev: Record<string, string>) => ({ ...prev, ...thumbnailMap }));
        }).catch((error) => {
          console.error('Error loading video thumbnails:', error);
        });
      }
    } catch (error) {
      console.error('Error loading media assets:', error);
      Alert.alert('Error', 'Failed to load photos. Please try again.');
      // Set empty array to prevent crashes
      setMediaAssets([]);
    }
  };

  const loadLastStatus = async () => {
    if (!currentUser?.id) return;
    try {
      const statuses = await getUserStatuses(currentUser.id);
      if (statuses && statuses.length > 0) {
        const latest = statuses[statuses.length - 1];
        setLastStatus(latest);
        
        if (latest.media_path && (latest.content_type === 'image' || latest.content_type === 'video')) {
          try {
            const url = await getSignedUrlForMedia(latest.media_path);
            setLastStatusMediaUrl(url);
          } catch (error) {
            console.error('Error loading last status media:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading last status:', error);
    }
  };

  const handleSelectMedia = async (asset: MediaLibrary.Asset) => {
    try {
      // Validate asset
      if (!asset || !asset.uri) {
        Alert.alert('Error', 'Invalid media selected. Please try again.');
        return;
      }

      // For videos, check duration and automatically open trimmer if needed
      if (asset.mediaType === 'video') {
        const duration = asset.duration || 0;
        
        // Allow small margin for floating point precision (15.1 seconds)
        // If video is longer than 15.1 seconds, automatically open trimmer
        if (duration > 15.1) {
          // Show a brief message, then automatically open the video trimmer
          // Note: ImagePicker doesn't support pre-selecting videos, so user will need to select it again
          Alert.alert(
            'Video Too Long',
            `This video is ${Math.round(duration)} seconds. Story videos must be 15 seconds or less. Please select the same video again to trim it.`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Trim Video',
                onPress: async () => {
                  try {
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                      allowsEditing: true,
                      videoMaxDuration: 15,
                      quality: 0.8,
                      allowsMultipleSelection: false,
                    });

                    if (!result.canceled && result.assets[0]) {
                      const trimmedAsset = result.assets[0];
                      setSelectedMedia({
                        ...asset,
                        uri: trimmedAsset.uri,
                        duration: trimmedAsset.duration || 15,
                      } as MediaLibrary.Asset);
                      setMediaUri(trimmedAsset.uri);
                      setContentType('video');
                      setScreenMode('preview');
                      setOverlayPos({ x: 0.5, y: 0.35 });
                      // Reset video loading/error states
                      setVideoLoading(false);
                      setVideoError(null);
                    }
                    // If user cancels, just return (don't proceed with original video)
                  } catch (error) {
                    console.error('Error trimming video:', error);
                    Alert.alert('Error', 'Failed to trim video. Please try again.');
                  }
                },
              },
            ]
          );
          return;
        }
        
        // If duration is 0 or undefined, try to proceed (might be metadata issue)
        // If video is 15 seconds or less, proceed normally
      }

      setSelectedMedia(asset);
      setMediaUri(asset.uri);
      setContentType(asset.mediaType === 'video' ? 'video' : 'image');
      setScreenMode('preview');
      // Reset overlay position for a new media item
      setOverlayPos({ x: 0.5, y: 0.35 });
      // Reset video loading/error states
      setVideoLoading(false);
      setVideoError(null);
    } catch (error) {
      console.error('Error selecting media:', error);
      Alert.alert('Error', 'Failed to select media. Please try again.');
    }
  };

  const handleTrimVideo = async () => {
    if (!videoToTrim) return;

    try {
      // Use ImagePicker to trim the video in-app
      // On iOS, this opens the native video editor within the app
      // On Android, it may open the system video editor
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: 15,
        quality: 0.8,
        // Pre-select the video we want to trim
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const trimmedAsset = result.assets[0];
        setSelectedMedia({
          ...videoToTrim,
          uri: trimmedAsset.uri,
          duration: trimmedAsset.duration || 15,
        } as MediaLibrary.Asset);
        setMediaUri(trimmedAsset.uri);
        setContentType('video');
        setScreenMode('preview');
        setOverlayPos({ x: 0.5, y: 0.35 });
        setShowVideoTrimmer(false);
        setVideoToTrim(null);
      } else {
        // User cancelled trimming
        setShowVideoTrimmer(false);
        setVideoToTrim(null);
      }
    } catch (error) {
      console.error('Error trimming video:', error);
      Alert.alert('Error', 'Failed to trim video. Please try again.');
      setShowVideoTrimmer(false);
      setVideoToTrim(null);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need camera access to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setContentType('image');
      setScreenMode('preview');
      setOverlayPos({ x: 0.5, y: 0.35 });
    }
  };

  const handlePost = async () => {
    if (contentType === 'text' && !textContent.trim()) {
      Alert.alert('Required', 'Please enter some text for your status.');
      return;
    }

    if (contentType !== 'text' && !mediaUri) {
      Alert.alert('Required', 'Please select media.');
      return;
    }

    setIsPosting(true);
    try {
      // If background image is set, use it as mediaUri
      const finalMediaUri = backgroundImageUri || mediaUri;
      
      // Prepare customization data
      const customization = {
        backgroundColor: textBackgroundColor,
        textStyle: textStyle,
        textEffect: textEffect,
        textAlignment: textAlignment,
        textPositionX: overlayEnabled ? overlayPos.x : 0.5,
        textPositionY: overlayEnabled ? overlayPos.y : 0.5,
        backgroundImageUri: contentType === 'text' ? backgroundImageUri : null,
        stickers: selectedStickers.map((sticker) => {
          console.log('📌 Preparing sticker for save:', {
            id: sticker.id,
            imageUrl: sticker.imageUrl,
            positionX: sticker.positionX,
            positionY: sticker.positionY,
            scale: sticker.scale,
            rotation: sticker.rotation,
          });
          return {
            id: sticker.id,
            imageUrl: sticker.imageUrl,
            positionX: sticker.positionX ?? 0.5,
            positionY: sticker.positionY ?? 0.5,
            scale: sticker.scale ?? 1.0,
            rotation: sticker.rotation ?? 0,
          };
        }),
      };

      const status = await createStatus(
        contentType,
        (overlayEnabled || contentType === 'text') ? (textContent || null) : null,
        finalMediaUri,
        privacyLevel,
        undefined, // allowedUserIds (for custom privacy)
        customization
      );

      if (status) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to post status. Please try again.');
      }
    } catch (error) {
      console.error('Error creating status:', error);
      Alert.alert('Error', (error as any)?.message || 'Failed to post status. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleTextOption = () => {
    setScreenMode('text');
    setContentType('text');
  };

  const handleSelectMultiple = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      handleSelectMedia({
        id: asset.uri,
        uri: asset.uri,
        mediaType: asset.type === 'video' ? 'video' : 'photo',
        duration: asset.duration || 0,
        width: asset.width || 0,
        height: asset.height || 0,
        creationTime: Date.now(),
        modificationTime: Date.now(),
        albumId: '',
      } as MediaLibrary.Asset);
    }
  };

  const handleBackgroundImageUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setBackgroundImageUri(result.assets[0].uri);
      setShowColorPicker(false);
    }
  };

  // Gallery Picker Screen
  if (screenMode === 'gallery') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <X size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>Create story</Text>
          <TouchableOpacity onPress={() => setScreenMode('privacy')} style={styles.headerButton}>
            <Settings size={24} color={textColor} />
          </TouchableOpacity>
        </View>

        {/* Story Creation Tools */}
        <View style={[styles.toolsSection, { borderBottomColor: borderColor }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolsScrollContent}
          >
            <TouchableOpacity 
              style={[styles.toolCard, styles.toolCardPrimary]} 
              onPress={handleTextOption}
              activeOpacity={0.8}
            >
              <View style={[styles.toolIconWrapper, { backgroundColor: cardBg, borderColor }]}>
                <Type size={28} color={colors.primary} />
              </View>
              <Text style={[styles.toolLabel, { color: textColor }]}>Text</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.toolCard} 
              activeOpacity={0.8}
              onPress={() => Alert.alert('Music', 'Music feature coming soon!')}
            >
              <View style={[styles.toolIconWrapper, { backgroundColor: cardBg, borderColor }]}>
                <Music size={28} color={colors.primary} />
              </View>
              <Text style={[styles.toolLabel, { color: textColor }]}>Music</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.toolCard} 
              activeOpacity={0.8}
              onPress={() => Alert.alert('AI Images', 'AI image generation coming soon!')}
            >
              <View style={[styles.toolIconWrapper, { backgroundColor: cardBg, borderColor }]}>
                <ImageIcon size={28} color={colors.primary} />
              </View>
              <Text style={[styles.toolLabel, { color: textColor }]}>AI images</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.toolCard} 
              activeOpacity={0.8}
              onPress={() => Alert.alert('Collage', 'Collage creation coming soon!')}
            >
              <View style={[styles.toolIconWrapper, { backgroundColor: cardBg, borderColor }]}>
                <Grid3x3 size={28} color={colors.primary} />
              </View>
              <Text style={[styles.toolLabel, { color: textColor }]}>Collage</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.toolCard, styles.toolCardLarge]} 
              onPress={handleSelectMultiple}
              activeOpacity={0.8}
            >
              <View style={[styles.toolIconWrapper, { backgroundColor: cardBg, borderColor }]}>
                <ImageIcon size={32} color={colors.primary} />
              </View>
              <Text style={[styles.toolLabel, { color: textColor }]}>Select multiple</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.toolCard, styles.toolCardCamera]} 
              onPress={handleTakePhoto}
              activeOpacity={0.8}
            >
              <View style={[styles.toolIconWrapper, { backgroundColor: cardBg, borderColor }]}>
                <Camera size={28} color={colors.primary} />
              </View>
              <Text style={[styles.toolLabel, { color: textColor }]}>Camera</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Gallery Selector */}
        <TouchableOpacity 
          style={[styles.gallerySelector, { borderBottomColor: borderColor }]}
          activeOpacity={0.7}
          onPress={() => setShowAlbumPicker(true)}
        >
          <Text style={[styles.gallerySelectorText, { color: textColor }]}>{selectedGallery}</Text>
          <ChevronDown size={18} color={colors.text.secondary} />
        </TouchableOpacity>

        {/* Media Grid */}
        <FlatList
          data={mediaAssets}
          numColumns={3}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => handleSelectMedia(item)}
              activeOpacity={0.8}
            >
              {item.mediaType === 'video' ? (
                <>
                  <Image 
                    source={{ uri: videoThumbnails[item.id] || item.uri }} 
                    style={styles.gridMedia} 
                    contentFit="cover" 
                  />
                  <View style={styles.videoOverlay}>
                    <View style={styles.videoBadge}>
                      <Text style={styles.videoDuration}>
                        {Math.round(item.duration || 0)}s
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <Image source={{ uri: item.uri }} style={styles.gridMedia} contentFit="cover" />
              )}
            </TouchableOpacity>
          )}
        />

        {/* Album Picker Modal */}
        <Modal
          visible={showAlbumPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAlbumPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAlbumPicker(false)}
          >
            <View style={[styles.albumPickerContainer, { backgroundColor: cardBg }]}>
              <View style={[styles.modalHeaderContainer, { borderBottomColor: borderColor }]}>
                <Text style={[styles.modalTitleText, { color: textColor }]}>Select Album</Text>
                <TouchableOpacity onPress={() => setShowAlbumPicker(false)}>
                  <X size={24} color={textColor} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.albumList}>
                <TouchableOpacity
                  style={[
                    styles.albumItem,
                    { backgroundColor: cardBg },
                    !selectedAlbumId && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => {
                    setSelectedAlbumId(null);
                    setSelectedGallery('Gallery');
                    setShowAlbumPicker(false);
                    loadMediaAssets();
                  }}
                >
                  <Text style={[styles.albumItemText, { color: textColor }]}>All Photos & Videos</Text>
                  {!selectedAlbumId && <Check size={20} color={colors.primary} />}
                </TouchableOpacity>
                {albums.map((album) => (
                  <TouchableOpacity
                    key={album.id}
                    style={[
                      styles.albumItem,
                      { backgroundColor: cardBg },
                      selectedAlbumId === album.id && { backgroundColor: colors.primary + '20' }
                    ]}
                    onPress={() => {
                      setSelectedAlbumId(album.id);
                      setSelectedGallery(album.title);
                      setShowAlbumPicker(false);
                      loadMediaAssets();
                    }}
                  >
                    <Text style={[styles.albumItemText, { color: textColor }]}>{album.title}</Text>
                    {selectedAlbumId === album.id && <Check size={20} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Video Trimmer Modal */}
        <Modal
          visible={showVideoTrimmer}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowVideoTrimmer(false);
            setVideoToTrim(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.videoTrimmerContainer, { backgroundColor: cardBg }]}>
              <View style={[styles.modalHeaderContainer, { borderBottomColor: borderColor }]}>
                <Text style={[styles.modalTitleText, { color: textColor }]}>Trim Video</Text>
                <TouchableOpacity onPress={() => {
                  setShowVideoTrimmer(false);
                  setVideoToTrim(null);
                }}>
                  <X size={24} color={textColor} />
                </TouchableOpacity>
              </View>
              
              {videoToTrim && (
                <>
                  <View style={styles.videoTrimmerPreview}>
                    <Video
                      source={{ uri: videoToTrim.uri }}
                      style={styles.trimPreviewVideo}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay
                      isLooping
                      useNativeControls
                    />
                  </View>
                  
                  <View style={styles.trimInfoContainer}>
                    <Text style={[styles.trimInfoText, { color: colors.text.secondary }]}>
                      Original duration: {Math.round(videoToTrim.duration || 0)}s
                    </Text>
                    <Text style={[styles.trimInfoText, { color: textColor }]}>
                      Story videos must be 15 seconds or less
                    </Text>
                    <Text style={[styles.trimInfoText, { color: colors.text.secondary, fontSize: 12, marginTop: 8 }]}>
                      Tap "Trim Video" to select a 15-second segment
                    </Text>
                  </View>

                  <View style={styles.trimButtonsContainer}>
                    <TouchableOpacity
                      style={[styles.trimButton, styles.trimButtonSecondary, { borderColor: borderColor }]}
                      onPress={() => {
                        setShowVideoTrimmer(false);
                        setVideoToTrim(null);
                      }}
                    >
                      <Text style={[styles.trimButtonText, { color: textColor }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.trimButton, styles.trimButtonPrimary, { backgroundColor: colors.primary }]}
                      onPress={handleTrimVideo}
                    >
                      <Text style={styles.trimButtonTextPrimary}>Trim Video</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Privacy Settings Screen
  if (screenMode === 'privacy') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => setScreenMode('gallery')} style={styles.headerButton}>
            <ChevronRight size={24} color={textColor} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>Story privacy</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.privacyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.privacySection}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Who can see your story?</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.text.secondary }]}>
              Your story will be visible for 24 hours on Committed and Messages.
            </Text>

            {[
              { value: 'public', label: 'Public', subtitle: 'Anyone on Committed or Messages', icon: '🌐' },
              { value: 'friends', label: 'Friends', subtitle: 'Only your friends', icon: '👥' },
              { value: 'followers', label: 'Followers', subtitle: 'Only your followers', icon: '👤' },
              { value: 'only_me', label: 'Only Me', subtitle: 'Just you', icon: '🔒' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.privacyOption,
                  { backgroundColor: cardBg },
                  privacyLevel === option.value && { backgroundColor: colors.primary + '20', borderColor: colors.primary, borderWidth: 1 },
                ]}
                onPress={() => setPrivacyLevel(option.value as any)}
                activeOpacity={0.7}
              >
                <View style={styles.privacyOptionLeft}>
                  <Text style={styles.privacyIcon}>{option.icon}</Text>
                  <View style={styles.privacyOptionContent}>
                    <Text style={[styles.privacyOptionLabel, { color: textColor }]}>{option.label}</Text>
                    <Text style={[styles.privacyOptionSubtitle, { color: colors.text.secondary }]}>{option.subtitle}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.radioButton,
                    { borderColor: colors.border.medium },
                    privacyLevel === option.value && { borderColor: colors.primary },
                  ]}
                >
                  {privacyLevel === option.value && (
                    <View style={[styles.radioButtonInner, { backgroundColor: colors.primary }]} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.privacySection}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Other settings</Text>
            <TouchableOpacity 
              style={[styles.settingsOption, { backgroundColor: cardBg }]} 
              activeOpacity={0.7}
              onPress={() => setShowMutedStories(true)}
            >
              <Text style={styles.settingsIcon}>🔇</Text>
              <Text style={[styles.settingsLabel, { color: textColor }]}>Stories you've muted</Text>
              <ChevronRight size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Preview Screen
  if (screenMode === 'preview' && mediaUri) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
        <StatusBar barStyle="light-content" />
        
        <View style={styles.previewHeader}>
          <TouchableOpacity 
            onPress={() => {
              setScreenMode('gallery');
              setMediaUri(null);
              setSelectedMedia(null);
            }} 
            style={styles.headerButton}
          >
            <ChevronRight size={24} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preview</Text>
          <TouchableOpacity 
            onPress={handlePost} 
            style={styles.postButton}
            disabled={isPosting}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        <View
          style={styles.previewContent}
          onLayout={(e) => {
            const { width: w, height: h } = e.nativeEvent.layout;
            setPreviewSize({ w, h });
          }}
        >
          {contentType === 'text' ? (
            <View style={[styles.textPreviewContainer, {
              backgroundColor: textBackgroundColor || '#1A73E8',
            }]}>
              {/* Background Image */}
              {backgroundImageUri && (
                <Image 
                  source={{ uri: backgroundImageUri }} 
                  style={styles.textPreviewBackgroundImage} 
                  contentFit="cover" 
                />
              )}
              
              {/* Text Content with Customization - Matches status viewer structure */}
              <View style={[styles.textPreviewWrapper, {
                alignItems: textAlignment === 'left' ? 'flex-start' : 
                           textAlignment === 'right' ? 'flex-end' : 'center',
              }]}>
                {/* Per-line Backgrounds */}
                {(textEffect === 'white-bg' || textEffect === 'black-bg') && textContent && (
                  <View 
                    style={[styles.adaptiveBackgroundContainer, {
                      alignItems: textAlignment === 'left' ? 'flex-start' : 
                                 textAlignment === 'right' ? 'flex-end' : 'center',
                    }]} 
                    pointerEvents="none"
                  >
                    {textContent.split('\n').map((line, index) => {
                      const trimmedLine = line.trim();
                      if (!trimmedLine) return null;
                      
                      return (
                        <View
                          key={index}
                          style={[
                            styles.adaptiveLineBackground,
                            {
                              backgroundColor: textEffect === 'white-bg' ? '#fff' : '#000',
                              // Border radius based on alignment
                              ...(textAlignment === 'left' ? {
                                borderTopLeftRadius: 0,
                                borderBottomLeftRadius: 0,
                                borderTopRightRadius: 20,
                                borderBottomRightRadius: 20,
                              } : textAlignment === 'right' ? {
                                borderTopRightRadius: 0,
                                borderBottomRightRadius: 0,
                                borderTopLeftRadius: 20,
                                borderBottomLeftRadius: 20,
                              } : {
                                borderRadius: 15, // Center: reduced radius
                              }),
                              marginTop: index > 0 ? -2 : 0,
                              alignSelf: textAlignment === 'center' ? 'center' : 
                                        textAlignment === 'right' ? 'flex-end' : 'flex-start',
                            },
                          ]}
                          pointerEvents="none"
                        >
                          <Text
                            style={[
                              getTextStyle(),
                              {
                                textAlign: textAlignment,
                                color: 'transparent',
                                opacity: 0,
                                includeFontPadding: false,
                                textAlignVertical: 'center',
                              },
                            ]}
                            pointerEvents="none"
                          >
                            {trimmedLine}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                
                {/* Actual Text - Positioned absolutely over backgrounds */}
                <View style={[styles.textPreviewTextOverlay, {
                  alignItems: textAlignment === 'left' ? 'flex-start' : 
                             textAlignment === 'right' ? 'flex-end' : 'center',
                }]}>
                  <Text
                    style={[
                      getTextStyle(),
                      getTextEffectStyle(),
                      {
                        textAlign: textAlignment,
                        color: (textEffect === 'white-bg' || textEffect === 'black-bg')
                          ? (textEffect === 'white-bg' ? '#000' : '#fff')
                          : '#fff',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        maxWidth: '85%',
                      },
                    ]}
                  >
                    {textContent}
                  </Text>
                </View>
              </View>
              
              {/* Stickers */}
              {selectedStickers.length > 0 && (
                <View style={styles.previewStickersContainer}>
                  {selectedStickers.map((sticker, index) => {
                    if (!stickerPanResponders.current[index]) {
                      stickerPanResponders.current[index] = createStickerPanResponder(index);
                    }
                    const panResponder = stickerPanResponders.current[index];
                    
                    return (
                      <View
                        key={sticker.id || index}
                        style={[styles.previewStickerWrapper, {
                          left: `${(sticker.positionX ?? (0.5 + (index % 2) * 0.2)) * 100}%`,
                          top: `${(sticker.positionY ?? (0.4 + (index * 0.15))) * 100}%`,
                          transform: [
                            { translateX: -40 },
                            { translateY: -40 },
                          ],
                        }]}
                        {...panResponder.panHandlers}
                      >
                        <Image
                          source={{ uri: sticker.imageUrl }}
                          style={[styles.previewSticker, {
                            transform: [
                              { scale: sticker.scale ?? 1.0 },
                              { rotate: `${sticker.rotation ?? 0}deg` },
                            ],
                            opacity: activeStickerIndex === index ? 0.8 : 1,
                          }]}
                          contentFit="contain"
                        />
                        {activeStickerIndex === index && (
                          <View style={styles.stickerSelectionIndicator} />
                        )}
                        <TouchableOpacity
                          style={styles.removeStickerButton}
                          onPress={() => {
                            setSelectedStickers((prev) => prev.filter((_, i) => i !== index));
                            if (activeStickerIndex === index) {
                              setActiveStickerIndex(null);
                            }
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <X size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.previewMediaWrapper}>
              {contentType === 'image' ? (
                <Image source={{ uri: mediaUri }} style={styles.previewMediaFull} contentFit="contain" />
              ) : (
                <>
                  {videoLoading && (
                    <View style={styles.videoLoadingContainer}>
                      <ActivityIndicator size="large" color="#fff" />
                    </View>
                  )}
                  {videoError && (
                    <View style={styles.videoErrorContainer}>
                      <Text style={styles.videoErrorText}>{videoError}</Text>
                    </View>
                  )}
                  <Video
                    source={{ uri: mediaUri }}
                    style={[styles.previewMediaFull, videoLoading && { opacity: 0 }]}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                    isLooping
                    useNativeControls
                    onLoadStart={() => {
                      setVideoLoading(true);
                      setVideoError(null);
                    }}
                    onLoad={() => {
                      setVideoLoading(false);
                      setVideoError(null);
                    }}
                    onError={(error) => {
                      console.error('Video load error in preview:', error);
                      setVideoLoading(false);
                      setVideoError('Failed to load video. Please try selecting it again.');
                    }}
                  />
                </>
              )}

              {/* Stickers on Media */}
              {selectedStickers.length > 0 && (
                <View style={styles.previewStickersContainer} pointerEvents="box-none">
                  {selectedStickers.map((sticker, index) => {
                    if (!stickerPanResponders.current[index]) {
                      stickerPanResponders.current[index] = createStickerPanResponder(index);
                    }
                    const panResponder = stickerPanResponders.current[index];
                    
                    return (
                      <View
                        key={sticker.id || `sticker-${index}`}
                        style={[styles.previewStickerWrapper, {
                          left: `${(sticker.positionX ?? (0.5 + (index % 2) * 0.2)) * 100}%`,
                          top: `${(sticker.positionY ?? (0.3 + (index * 0.15))) * 100}%`,
                          transform: [
                            { translateX: -40 },
                            { translateY: -40 },
                          ],
                        }]}
                        {...panResponder.panHandlers}
                      >
                        <Image
                          source={{ uri: sticker.imageUrl }}
                          style={[styles.previewSticker, {
                            transform: [
                              { scale: sticker.scale ?? 1.0 },
                              { rotate: `${sticker.rotation ?? 0}deg` },
                            ],
                            opacity: activeStickerIndex === index ? 0.8 : 1,
                          }]}
                          contentFit="contain"
                          onError={(error) => {
                            console.error('Error loading sticker image:', error, sticker.imageUrl);
                          }}
                        />
                        {activeStickerIndex === index && (
                          <View style={styles.stickerSelectionIndicator} />
                        )}
                        <TouchableOpacity
                          style={styles.removeStickerButton}
                          onPress={() => {
                            setSelectedStickers((prev) => prev.filter((_, i) => i !== index));
                            if (activeStickerIndex === index) {
                              setActiveStickerIndex(null);
                            }
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <X size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Draggable text overlay */}
              {overlayEnabled && (
                <View
                  style={[
                    styles.overlayTextContainer,
                    {
                      left: `${overlayPos.x * 100}%`,
                      top: `${overlayPos.y * 100}%`,
                      transform: [{ translateX: -110 }, { translateY: -22 }],
                    },
                  ]}
                  {...overlayPan.panHandlers}
                >
                  <View
                    onTouchEnd={() => {
                      // Only open editor if not dragging
                      if (!overlayDragging.current) {
                        setShowOverlayEditor(true);
                      }
                      overlayDragging.current = false;
                    }}
                  >
                    <Text style={[styles.overlayText, getTextStyle(), getTextEffectStyle()]}>
                      {textContent?.trim() ? textContent : 'Tap to add text'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Quick action buttons */}
              <View style={styles.previewOverlayActions}>
                <TouchableOpacity
                  style={styles.previewOverlayAction}
                  onPress={() => {
                    setOverlayEnabled(true);
                    setShowOverlayEditor(true);
                  }}
                >
                  <Text style={styles.previewOverlayActionText}>Aa</Text>
                </TouchableOpacity>
                {overlayEnabled && (
                  <TouchableOpacity
                    style={styles.previewOverlayAction}
                    onPress={() => {
                      setOverlayEnabled(false);
                      setTextContent('');
                    }}
                  >
                    <X size={18} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.previewOverlayAction}
                  onPress={() => setShowStickerPicker(true)}
                >
                  <Smile size={20} color="#fff" />
                </TouchableOpacity>
                {selectedStickers.length > 0 && (
                  <TouchableOpacity
                    style={styles.previewOverlayAction}
                    onPress={() => {
                      // Remove last sticker
                      setSelectedStickers(selectedStickers.slice(0, -1));
                    }}
                  >
                    <Text style={styles.previewOverlayActionText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={styles.privacyBadge}
          onPress={() => setScreenMode('privacy')}
        >
          <Text style={styles.privacyBadgeText}>
            {privacyLevel === 'public' ? '🌐' : 
             privacyLevel === 'friends' ? '👥' : 
             privacyLevel === 'followers' ? '👤' : '🔒'} {privacyLevel.charAt(0).toUpperCase() + privacyLevel.slice(1)}
          </Text>
        </TouchableOpacity>

        {/* Overlay text editor modal */}
        <Modal
          visible={showOverlayEditor}
          transparent
          animationType="fade"
          onRequestClose={() => setShowOverlayEditor(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowOverlayEditor(false)}
          >
            <View style={styles.overlayEditorCard}>
              <Text style={styles.overlayEditorTitle}>Add text</Text>
              <TextInput
                value={textContent}
                onChangeText={(t) => {
                  setTextContent(t);
                  if (!overlayEnabled) setOverlayEnabled(true);
                }}
                placeholder="Type something…"
                placeholderTextColor="rgba(255,255,255,0.6)"
                style={styles.overlayEditorInput}
                multiline
                autoFocus
              />
              <View style={styles.overlayEditorActions}>
                <TouchableOpacity
                  onPress={() => {
                    setOverlayEnabled(false);
                    setTextContent('');
                    setShowOverlayEditor(false);
                  }}
                  style={styles.overlayEditorSecondary}
                >
                  <Text style={styles.overlayEditorSecondaryText}>Remove</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowOverlayEditor(false)}
                  style={styles.overlayEditorPrimary}
                >
                  <Text style={styles.overlayEditorPrimaryText}>Done</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.overlayEditorHint}>Tip: tap and drag the text on the preview to move it.</Text>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Sticker Picker Modal for Preview Screen */}
        <StickerPicker
          visible={showStickerPicker}
          onClose={() => setShowStickerPicker(false)}
          onSelectSticker={(sticker: Sticker) => {
            // Add sticker with default positioning
            console.log('Adding sticker:', sticker);
            const newSticker = {
              id: sticker.id,
              imageUrl: sticker.imageUrl,
              positionX: 0.5 + (selectedStickers.length % 2) * 0.2,
              positionY: 0.3 + (selectedStickers.length * 0.15),
              scale: 1.0,
              rotation: 0,
            };
            setSelectedStickers([...selectedStickers, newSticker]);
            setShowStickerPicker(false);
          }}
        />
      </SafeAreaView>
    );
  }

  // Text Creation Screen - Facebook Style Full Screen
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: textBackgroundColor }]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.flex1}>
        {/* Header - Simple header */}
        <View style={styles.textHeader}>
          <TouchableOpacity 
            style={styles.textHeaderIconButton}
            onPress={() => setScreenMode('gallery')}
          >
            <ChevronRight size={20} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
          <View style={styles.textHeaderRight}>
            <TouchableOpacity 
              style={styles.textHeaderIconButton}
              onPress={() => setShowStickerPicker(true)}
            >
              <Smile size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.textHeaderIconButton}
              onPress={() => setShowMoreOptions(!showMoreOptions)}
            >
              <MoreHorizontal size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Full Screen Text Input with Background */}
        <View style={styles.fullScreenTextContainer}>
          {backgroundImageUri ? (
            <Image 
              source={{ uri: backgroundImageUri }} 
              style={styles.backgroundImage} 
              contentFit="cover" 
            />
          ) : (
            <View style={[styles.textInputArea, { backgroundColor: textBackgroundColor }]} />
          )}
          
          {/* Text Input Area - Per-line Adaptive Backgrounds, Each with Rounded Corners */}
          <View style={styles.textInputWrapper}>
            {/* Per-line Backgrounds - Each line has own width, all corners rounded, merged seamlessly */}
            {(textEffect === 'white-bg' || textEffect === 'black-bg') && textContent && (
              <View 
                style={[
                  styles.adaptiveBackgroundContainer,
                  {
                    alignItems: textAlignment === 'left' ? 'flex-start' : 
                               textAlignment === 'right' ? 'flex-end' : 'center',
                  },
                ]} 
                pointerEvents="none"
              >
                {textContent.split('\n').map((line, index, lines) => {
                  const trimmedLine = line.trim();
                  if (!trimmedLine && index === lines.length - 1 && lines.length === 1) {
                    // Show background for empty first line
                    return (
                    <View
                      key={index}
                      style={[
                        styles.adaptiveLineBackground,
                        {
                          backgroundColor: textEffect === 'white-bg' ? '#fff' : '#000',
                          // Border radius based on alignment
                          ...(textAlignment === 'left' ? {
                            borderTopLeftRadius: 0,
                            borderBottomLeftRadius: 0,
                            borderTopRightRadius: 20,
                            borderBottomRightRadius: 20,
                          } : textAlignment === 'right' ? {
                            borderTopRightRadius: 0,
                            borderBottomRightRadius: 0,
                            borderTopLeftRadius: 20,
                            borderBottomLeftRadius: 20,
                          } : {
                            borderRadius: 15, // Center: reduced radius
                          }),
                          marginTop: index > 0 ? -2 : 0, // Merge seamlessly
                          alignSelf: textAlignment === 'center' ? 'center' : 
                                    textAlignment === 'right' ? 'flex-end' : 'flex-start',
                        },
                      ]}
                      pointerEvents="none"
                    >
                      {/* Invisible Text for empty line measurement */}
                      <Text
                        style={[
                          getTextStyle(),
                          {
                            textAlign: textAlignment,
                            color: 'transparent',
                            opacity: 0.01, // Nearly invisible but still measurable
                          },
                        ]}
                        pointerEvents="none"
                      >
                        {' '}
                      </Text>
                    </View>
                    );
                  }
                  if (!trimmedLine) return null;
                  
                  return (
                    <View
                      key={index}
                      style={[
                        styles.adaptiveLineBackground,
                        {
                          backgroundColor: textEffect === 'white-bg' ? '#fff' : '#000',
                          // Border radius based on alignment
                          ...(textAlignment === 'left' ? {
                            borderTopLeftRadius: 0,
                            borderBottomLeftRadius: 0,
                            borderTopRightRadius: 20,
                            borderBottomRightRadius: 20,
                          } : textAlignment === 'right' ? {
                            borderTopRightRadius: 0,
                            borderBottomRightRadius: 0,
                            borderTopLeftRadius: 20,
                            borderBottomLeftRadius: 20,
                          } : {
                            borderRadius: 15, // Center: reduced radius
                          }),
                          marginTop: index > 0 ? -4 : 0, // Merge seamlessly - overlap to connect
                          alignSelf: textAlignment === 'center' ? 'center' : 
                                    textAlignment === 'right' ? 'flex-end' : 'flex-start',
                          // Ensure it only wraps the text width, not expanding
                          flexShrink: 1,
                          flexGrow: 0,
                        },
                      ]}
                      pointerEvents="none"
                    >
                      {/* Invisible Text for width measurement only - completely hidden */}
                      {/* CRITICAL: This Text must match TextInput font properties EXACTLY */}
                      <Text
                        style={[
                          getTextStyle(), // This already includes fontSize, fontWeight, fontStyle, fontFamily, lineHeight
                          {
                            textAlign: textAlignment,
                            color: 'transparent', // Transparent text
                            opacity: 0.001, // Essentially invisible but still measurable
                            includeFontPadding: false,
                            // All font properties come from getTextStyle() - no need to duplicate
                          },
                        ]}
                        numberOfLines={1}
                        pointerEvents="none"
                      >
                        {trimmedLine}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
            
            {/* TextInput - Positioned to overlay EXACTLY on adaptive backgrounds */}
            <View 
              style={[
                styles.textInputOverlay,
                {
                  // CRITICAL: Use EXACT same alignment as adaptiveBackgroundContainer
                  alignItems: textAlignment === 'left' ? 'flex-start' : 
                             textAlignment === 'right' ? 'flex-end' : 'center',
                  // Both containers use justifyContent: 'center' - ensures same vertical centering
                },
              ]}
            >
              <TextInput
                style={[
                  getTextStyle(),
                  getTextEffectStyle(),
                  { 
                    textAlign: textAlignment,
                    textAlignVertical: 'top', // Top align to match line-by-line background positioning
                    lineHeight: getTextStyle().lineHeight, // MUST match background Text exactly
                    color: (textEffect === 'white-bg' || textEffect === 'black-bg') 
                      ? (textEffect === 'white-bg' ? '#000' : '#fff')
                      : '#fff',
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    outlineWidth: 0,
                    paddingHorizontal: 12, // MUST match adaptiveLineBackground paddingHorizontal exactly
                    paddingVertical: 8, // MUST match adaptiveLineBackground paddingVertical exactly
                    maxWidth: '85%',
                    includeFontPadding: false,
                    // CRITICAL: Match background Views' alignSelf behavior
                    alignSelf: textAlignment === 'center' ? 'center' : 
                              textAlignment === 'right' ? 'flex-end' : 'flex-start',
                    // CRITICAL: TextInput must align exactly with background Text
                    // Both use same fontSize, fontWeight, fontStyle, fontFamily, lineHeight
                    // Both use same paddingHorizontal, paddingVertical
                    // Both containers use same justifyContent: 'center' and alignItems
                    // Both use same alignSelf based on textAlignment
                    // TextInput uses textAlignVertical: 'top' to match line-by-line background positioning
                  },
                ]}
                placeholder="Type or @Tag"
                placeholderTextColor={getPlaceholderColor()}
                value={textContent}
                onChangeText={setTextContent}
                multiline
                autoFocus
              />
            </View>
          </View>

          {/* Stickers on Text Screen */}
          {selectedStickers.length > 0 && (
            <View style={styles.textStickersContainer}>
              {selectedStickers.map((sticker, index) => {
                if (!stickerPanResponders.current[index]) {
                  stickerPanResponders.current[index] = createStickerPanResponder(index);
                }
                const panResponder = stickerPanResponders.current[index];
                
                return (
                  <View
                    key={sticker.id || index}
                    style={[styles.textScreenStickerWrapper, {
                      left: `${(sticker.positionX ?? (0.5 + (index % 2) * 0.2)) * 100}%`,
                      top: `${(sticker.positionY ?? (0.4 + (index * 0.15))) * 100}%`,
                      transform: [
                        { translateX: -40 },
                        { translateY: -40 },
                      ],
                    }]}
                    {...panResponder.panHandlers}
                  >
                    <Image
                      source={{ uri: sticker.imageUrl }}
                      style={[styles.textScreenSticker, {
                        transform: [
                          { scale: sticker.scale ?? 1.0 },
                          { rotate: `${sticker.rotation ?? 0}deg` },
                        ],
                        opacity: activeStickerIndex === index ? 0.8 : 1,
                      }]}
                      contentFit="contain"
                    />
                    {activeStickerIndex === index && (
                      <View style={styles.stickerSelectionIndicator} />
                    )}
                    <TouchableOpacity
                      style={styles.removeStickerButton}
                      onPress={() => {
                        setSelectedStickers((prev) => prev.filter((_, i) => i !== index));
                        if (activeStickerIndex === index) {
                          setActiveStickerIndex(null);
                        }
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Text Style Selector at Bottom - All Fonts - Scrollable */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.textStyleSelectorContainer}
          style={styles.textStyleSelectorScrollView}
        >
          {(['classic', 'neon', 'typewriter', 'elegant', 'bold', 'italic'] as FontStyle[]).map((style) => (
            <TouchableOpacity
              key={style}
              style={[
                styles.textStyleButton,
                textStyle === style && styles.textStyleButtonActive,
              ]}
              onPress={() => setTextStyle(style)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.textStyleButtonText,
                textStyle === style && styles.textStyleButtonTextActive,
                // Apply font preview style to button text
                getFontPreviewStyle(style),
              ]}>
                {style === 'classic' ? 'Classic' : 
                 style === 'neon' ? 'Neon' : 
                 style === 'typewriter' ? 'Typewriter' : 
                 style === 'elegant' ? 'Elegant' : 
                 style === 'bold' ? 'Bold' : 
                 'Italic'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Vertical Options on Right Side - ABOVE background layer for clickability */}
        <View style={styles.verticalOptionsContainer}>
          {/* Color Picker */}
          <TouchableOpacity
            style={[styles.verticalOptionButton, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
            onPress={() => setShowColorPicker(!showColorPicker)}
            activeOpacity={0.7}
          >
            <View style={[styles.colorPreviewCircle, { backgroundColor: textBackgroundColor }]} />
          </TouchableOpacity>

          {/* Text Effect (Aa) - Cycles through effects */}
          <TouchableOpacity
            style={[styles.verticalOptionButton, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
            onPress={cycleTextEffect}
            activeOpacity={0.7}
          >
            <Text style={styles.aaButton}>Aa</Text>
          </TouchableOpacity>

          {/* Alignment - Cycles through left/center/right */}
          <TouchableOpacity
            style={[styles.verticalOptionButton, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
            onPress={cycleTextAlignment}
            activeOpacity={0.7}
          >
            {textAlignment === 'left' ? (
              <AlignLeft size={24} color="#fff" />
            ) : textAlignment === 'center' ? (
              <AlignCenter size={24} color="#fff" />
            ) : (
              <AlignRight size={24} color="#fff" />
            )}
          </TouchableOpacity>

          {/* Music */}
          <TouchableOpacity
            style={[styles.verticalOptionButton, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
            onPress={() => {
              Alert.alert('Music', 'Music feature coming soon!');
            }}
            activeOpacity={0.7}
          >
            <Music size={24} color="#fff" />
          </TouchableOpacity>

          {/* Stickers */}
          <TouchableOpacity
            style={[styles.verticalOptionButton, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
            onPress={() => setShowStickerPicker(true)}
            activeOpacity={0.7}
          >
            <Smile size={24} color="#fff" />
          </TouchableOpacity>

          {/* Done Button */}
          <TouchableOpacity
            style={[
              styles.verticalDoneButton,
              { backgroundColor: '#EF4444' },
              (isPosting || !textContent.trim()) && { opacity: 0.5 },
            ]}
            onPress={handlePost}
            disabled={isPosting || !textContent.trim()}
            activeOpacity={0.7}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.doneButtonText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sticker Picker Modal */}
        <StickerPicker
          visible={showStickerPicker}
          onClose={() => setShowStickerPicker(false)}
          onSelectSticker={(sticker: Sticker) => {
            // Add sticker with default positioning
            console.log('Adding sticker:', sticker);
            const newSticker = {
              id: sticker.id,
              imageUrl: sticker.imageUrl,
              positionX: 0.5 + (selectedStickers.length % 2) * 0.2,
              positionY: 0.4 + (selectedStickers.length * 0.1),
              scale: 1.0,
              rotation: 0,
            };
            setSelectedStickers([...selectedStickers, newSticker]);
            setShowStickerPicker(false);
          }}
        />

        {/* More Options Modal */}
        {showMoreOptions && (
          <Modal
            visible={showMoreOptions}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMoreOptions(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowMoreOptions(false)}
            >
              <View style={[styles.moreOptionsMenu, { backgroundColor: cardBg }]}>
                <TouchableOpacity
                  style={styles.moreOptionsItem}
                  onPress={() => {
                    setShowMoreOptions(false);
                    Alert.alert('Help', 'Story help coming soon!');
                  }}
                >
                  <Text style={[styles.moreOptionsText, { color: textColor }]}>Help</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.moreOptionsItem}
                  onPress={() => {
                    setShowMoreOptions(false);
                    Alert.alert('Report', 'Report feature coming soon!');
                  }}
                >
                  <Text style={[styles.moreOptionsText, { color: textColor }]}>Report a Problem</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Muted Stories Modal */}
        {showMutedStories && (
          <Modal
            visible={showMutedStories}
            transparent
            animationType="slide"
            onRequestClose={() => setShowMutedStories(false)}
          >
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={1}
                onPress={() => setShowMutedStories(false)}
              />
              <View style={[styles.mutedStoriesModal, { backgroundColor: cardBg }]}>
                <View style={[styles.modalHeaderContainer, { borderBottomColor: borderColor }]}>
                  <Text style={[styles.modalTitleText, { color: textColor }]}>Muted Stories</Text>
                  <TouchableOpacity onPress={() => setShowMutedStories(false)}>
                    <X size={24} color={textColor} />
                  </TouchableOpacity>
                </View>
                <View style={styles.emptyStateContainer}>
                  <Text style={[styles.emptyStateText, { color: colors.text.secondary }]}>
                    No muted stories
                  </Text>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Color Picker Modal */}
        {showColorPicker && (
          <Modal
            visible={showColorPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowColorPicker(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowColorPicker(false)}
            >
              <View style={[styles.colorPickerContainer, { backgroundColor: cardBg }]}>
                <View style={styles.colorPickerHeader}>
                  <Text style={[styles.colorPickerTitle, { color: textColor }]}>Background</Text>
                  <TouchableOpacity onPress={() => setShowColorPicker(false)}>
                    <X size={24} color={textColor} />
                  </TouchableOpacity>
                </View>
                
                {/* Color Circles */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.colorPaletteContainer}
                >
                  {colorPalette.map((color, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        textBackgroundColor === color && styles.colorCircleSelected,
                      ]}
                      onPress={() => {
                        setTextBackgroundColor(color);
                        setBackgroundImageUri(null); // Clear background image when color is selected
                      }}
                      activeOpacity={0.7}
                    />
                  ))}
                </ScrollView>

                {/* Upload Background Image */}
                <TouchableOpacity
                  style={[styles.uploadBackgroundButton, { backgroundColor: colors.primary }]}
                  onPress={handleBackgroundImageUpload}
                  activeOpacity={0.7}
                >
                  <Upload size={20} color="#fff" />
                  <Text style={styles.uploadBackgroundText}>Upload background image</Text>
                </TouchableOpacity>

                {/* Remove Background */}
                {backgroundImageUri && (
                  <TouchableOpacity
                    style={[styles.removeBackgroundButton, { borderColor: colors.danger }]}
                    onPress={() => {
                      setBackgroundImageUri(null);
                      setShowColorPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <X size={20} color={colors.danger} />
                    <Text style={[styles.removeBackgroundText, { color: colors.danger }]}>
                      Remove background image
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          </Modal>
        )}

      </SafeAreaView>
    </KeyboardAvoidingView>
  );

  function getTextStyle() {
    // Font size based on style
    let fontSize = 32;
    if (textStyle === 'typewriter') {
      fontSize = 20;
    } else if (textStyle === 'elegant') {
      fontSize = 24;
    } else if (textStyle === 'bold' || textStyle === 'italic') {
      fontSize = 32; // Same as classic
    }
    const lineHeight = fontSize * 1.2; // Consistent line height multiplier
    const baseStyle: any = {
      fontSize: fontSize,
      lineHeight: lineHeight,
      color: textEffect === 'black-bg' ? '#fff' : textEffect === 'white-bg' ? '#000' : '#fff',
      fontWeight: textStyle === 'bold' ? ('700' as const) : textStyle === 'typewriter' ? ('400' as const) : textStyle === 'italic' ? ('400' as const) : ('600' as const),
      fontStyle: textStyle === 'italic' ? ('italic' as const) : ('normal' as const),
    };

    // Font family - handle all font styles
    if (textStyle === 'typewriter') {
      baseStyle.fontFamily = 'monospace';
    } else if (textStyle === 'elegant') {
      baseStyle.fontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif';
    } else if (textStyle === 'neon') {
      baseStyle.fontFamily = Platform.OS === 'ios' ? 'Arial' : 'sans-serif-medium';
    } else if (textStyle === 'classic') {
      baseStyle.fontFamily = Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto';
    } else if (textStyle === 'bold') {
      baseStyle.fontFamily = Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto';
    } else if (textStyle === 'italic') {
      baseStyle.fontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif';
    }

    return baseStyle;
  }

  function getPlaceholderColor() {
    switch (textEffect) {
      case 'white-bg':
        return 'rgba(0, 0, 0, 0.4)';
      case 'black-bg':
        return 'rgba(255, 255, 255, 0.5)';
      default:
        return 'rgba(255, 255, 255, 0.6)';
    }
  }

  function getTextEffectStyle() {
    const styles: any = {};
    
    switch (textEffect) {
      case 'white-bg':
        // Text color handled by inline style override
        // Background is rendered by Text component layer behind
        // No text shadow needed
        break;
      case 'black-bg':
        // Text color handled by inline style override
        // Background is rendered by Text component layer behind
        // No text shadow needed
        break;
      case 'outline-white':
        // Thin white outline
        styles.textShadowColor = '#fff';
        styles.textShadowOffset = { width: -1, height: 1 };
        styles.textShadowRadius = 2;
        break;
      case 'outline-black':
        // Thin black outline
        styles.textShadowColor = '#000';
        styles.textShadowOffset = { width: -1, height: 1 };
        styles.textShadowRadius = 2;
        break;
      case 'glow':
        // Glowing effect
        styles.textShadowColor = textBackgroundColor;
        styles.textShadowOffset = { width: 0, height: 0 };
        styles.textShadowRadius = 20;
        break;
    }
    
    return styles;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future effect preview
  function _getEffectPreviewStyle(effect: TextEffect) {
    const styles: any = {
      fontSize: 24,
      fontWeight: '600' as const,
    };
    
    switch (effect) {
      case 'white-bg':
        styles.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        styles.color = '#000';
        break;
      case 'black-bg':
        styles.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        styles.color = '#fff';
        break;
      case 'outline-white':
        styles.color = textBackgroundColor;
        styles.textShadowColor = '#fff';
        styles.textShadowOffset = { width: -1, height: 1 };
        styles.textShadowRadius = 2;
        break;
      case 'outline-black':
        styles.color = '#fff';
        styles.textShadowColor = '#000';
        styles.textShadowOffset = { width: -1, height: 1 };
        styles.textShadowRadius = 2;
        break;
      case 'glow':
        styles.color = '#fff';
        styles.textShadowColor = textBackgroundColor;
        styles.textShadowOffset = { width: 0, height: 0 };
        styles.textShadowRadius = 10;
        break;
      default:
        styles.color = '#fff';
    }
    
    return styles;
  }

  function getFontPreviewStyle(font: FontStyle) {
    const styles: any = {
      fontSize: 14, // Match button text size
      color: textStyle === font ? '#000' : '#fff', // Active state handled by textStyleButtonTextActive
    };
    
    switch (font) {
      case 'bold':
        styles.fontWeight = '700' as const;
        styles.fontFamily = Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto';
        break;
      case 'italic':
        styles.fontStyle = 'italic' as const;
        styles.fontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif';
        break;
      case 'neon':
        styles.color = textStyle === font ? '#000' : '#00ffff';
        styles.fontFamily = Platform.OS === 'ios' ? 'Arial' : 'sans-serif-medium';
        break;
      case 'elegant':
        styles.fontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif';
        break;
      case 'typewriter':
        styles.fontFamily = 'monospace';
        break;
      case 'classic':
        styles.fontFamily = Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto';
        styles.fontWeight = '600' as const;
        break;
    }
    
    return styles;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  toolsSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  toolsScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  toolCard: {
    width: 80,
    alignItems: 'center',
    marginRight: 12,
  },
  toolCardPrimary: {
    width: 90,
  },
  toolCardLarge: {
    width: 110,
  },
  toolCardCamera: {
    width: 85,
  },
  toolIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
  },
  toolLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  gallerySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  gallerySelectorText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  gridContainer: {
    padding: 16,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  gridMedia: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 4,
  },
  videoBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoDuration: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600' as const,
  },
  privacyContent: {
    flex: 1,
    padding: 16,
  },
  privacySection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 20,
  },
  privacyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  privacyOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  privacyIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  privacyOptionContent: {
    flex: 1,
  },
  privacyOptionLabel: {
    fontSize: 17,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  privacyOptionSubtitle: {
    fontSize: 14,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingsIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600' as const,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
  },
  previewContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textPreviewContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  textPreviewBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  textPreviewWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  textPreviewTextOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    zIndex: 10,
    pointerEvents: 'none',
  },
  previewStickersContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 50,
  },
  previewStickerWrapper: {
    position: 'absolute',
    width: 80,
    height: 80,
    zIndex: 100,
  },
  previewSticker: {
    width: 80,
    height: 80,
  },
  stickerSelectionIndicator: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 4,
    borderStyle: 'dashed',
  },
  removeStickerButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  textStickersContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  textScreenStickerWrapper: {
    position: 'absolute',
    width: 80,
    height: 80,
    zIndex: 100,
  },
  textScreenSticker: {
    width: 80,
    height: 80,
  },
  previewMediaFull: {
    width: width,
    height: height * 0.75,
  },
  previewMediaWrapper: {
    width: width,
    height: height * 0.75,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
  videoErrorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    zIndex: 2,
  },
  videoErrorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  previewOverlayActions: {
    position: 'absolute',
    right: 16,
    top: 16,
    gap: 10,
  },
  previewOverlayAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  previewOverlayActionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800' as const,
  },
  overlayTextContainer: {
    position: 'absolute',
    zIndex: 60,
    maxWidth: '88%',
  },
  overlayText: {
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    overflow: 'hidden',
  },
  overlayEditorCard: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(20,20,20,0.98)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  overlayEditorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800' as const,
    marginBottom: 10,
  },
  overlayEditorInput: {
    minHeight: 80,
    maxHeight: 160,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700' as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overlayEditorActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  overlayEditorSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  overlayEditorSecondaryText: {
    color: '#fff',
    fontWeight: '700' as const,
  },
  overlayEditorPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A73E8',
  },
  overlayEditorPrimaryText: {
    color: '#fff',
    fontWeight: '800' as const,
  },
  overlayEditorHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 10,
  },
  privacyBadge: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  privacyBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#1A73E8',
    borderRadius: 20,
  },
  postButtonText: {
    color: '#fff',
    fontWeight: '600' as const,
    fontSize: 16,
  },
  textHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    backgroundColor: 'transparent',
  },
  textHeaderRight: {
    flexDirection: 'row',
    gap: 8,
  },
  textHeaderIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Header Text Style Buttons (Classic, Neon, Typewriter)
  headerTextStyleButtons: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextStyleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerTextStyleButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  headerTextStyleButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  headerTextStyleButtonTextActive: {
    color: '#000',
    fontWeight: '700' as const,
  },
  // Header Color Dot
  headerColorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  // Header Aa Button
  aaButtonHeader: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  // Header Done Button
  headerDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDoneButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  fullScreenTextContainer: {
    flex: 1,
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  textInputArea: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  textInputWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
    height: '100%',
    // Children are absolutely positioned, so justifyContent: 'center' creates reference point
  },
  // Adaptive Background Container - Holds per-line backgrounds
  adaptiveBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center', // Center content vertically
    alignItems: 'flex-start', // Default to flex-start, will be overridden
    zIndex: 1, // Below TextInput
    pointerEvents: 'none',
    // alignItems will be set dynamically based on textAlignment
    // Container should NOT expand - let children determine width
    flexDirection: 'column',
  },
  // Adaptive Line Background - Each line has own width, wraps text tightly
  adaptiveLineBackground: {
    // Tight padding - hugs text closely (each line has its own padding)
    // CRITICAL: Must match TextInput padding exactly
    paddingHorizontal: 12,
    paddingVertical: 8,
    // Center content vertically and horizontally within the wrapper
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: undefined, // Let it wrap to content
    // CRITICAL: No maxWidth - let it shrink to text width only
    // Border radius is set dynamically based on text alignment
    // Shadow for depth
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    // View wraps invisible text to determine width - MUST shrink to content
    alignSelf: 'flex-start', // Start with flex-start, will be overridden
  },
  // TextInput overlay container - positioned on top of background bubbles
  textInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center', // CRITICAL: Same as adaptiveBackgroundContainer - centers content vertically
    alignItems: 'center', // Default, will be overridden dynamically to match adaptiveBackgroundContainer
    zIndex: 2, // Above background bubbles
    flexDirection: 'column', // Match adaptiveBackgroundContainer structure
    // alignItems will be overridden dynamically based on textAlignment to match adaptiveBackgroundContainer exactly
  },
  textInputWithBg: {
    position: 'relative',
  },
  verticalOptionsContainer: {
    position: 'absolute',
    right: 16,
    top: height * 0.3,
    alignItems: 'center',
    gap: 12,
    zIndex: 10, // Above everything - buttons must be clickable
    elevation: 10, // Android elevation
  },
  verticalOptionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPreviewCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  aaButton: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  verticalDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  colorPickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: height * 0.5,
  },
  colorPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  colorPickerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  colorPaletteContainer: {
    gap: 12,
    paddingVertical: 10,
  },
  colorCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: '#1A73E8',
    borderWidth: 3,
  },
  uploadBackgroundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  uploadBackgroundText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  removeBackgroundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
    marginTop: 12,
  },
  removeBackgroundText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  fontPickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: height * 0.6,
  },
  fontPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  fontPickerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  effectSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  effectOptions: {
    gap: 12,
  },
  effectOption: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  effectPreview: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  effectLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  fontSection: {
    marginBottom: 24,
  },
  fontOptions: {
    gap: 12,
  },
  fontOption: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fontPreview: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  alignmentPickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  alignmentPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  alignmentPickerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  alignmentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  alignmentOption: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  alignmentLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  // Text Style Selector at Bottom - Facebook Style - Scrollable
  textStyleSelectorScrollView: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 0,
    right: 0,
    zIndex: 10, // Above everything - buttons must be clickable
    elevation: 10, // Android elevation
    maxHeight: 60,
  },
  textStyleSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  textStyleButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 75,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  textStyleButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  textStyleButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  textStyleButtonTextActive: {
    color: '#000',
    fontWeight: '700' as const,
  },
  moreOptionsMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 50,
    right: 16,
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  moreOptionsItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  moreOptionsText: {
    fontSize: 16,
  },
  mutedStoriesModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
  },
  modalHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyStateText: {
    fontSize: 16,
  },
  albumPickerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
  },
  albumList: {
    maxHeight: height * 0.6,
  },
  albumItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  albumItemText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  videoTrimmerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.8,
  },
  videoTrimmerPreview: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
    marginTop: 16,
  },
  trimPreviewVideo: {
    width: '100%',
    height: '100%',
  },
  trimInfoContainer: {
    padding: 16,
    gap: 8,
  },
  trimInfoText: {
    fontSize: 14,
    textAlign: 'center',
  },
  trimButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
  },
  trimButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trimButtonSecondary: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  trimButtonPrimary: {
    backgroundColor: '#1A73E8',
  },
  trimButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  trimButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
