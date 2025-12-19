/**
 * Status Viewer Screen
 * 
 * Full-screen status viewer (like Instagram Stories)
 * Shows all statuses from a user in sequence
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Platform,
  Clipboard,
  Share,
  InteractionManager,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Trash2, Plus, Music, Type, Image as ImageIcon, RefreshCw, Share2, MoreHorizontal, Globe, Lock, MessageCircle, Download, Archive, Link, AlertCircle, AtSign, ChevronUp, Camera } from 'lucide-react-native';
import { getUserStatuses, markStatusAsViewed, getSignedUrlForMedia, deleteStatus, getStatusViewers, getStatusViewCount, updateStatusPrivacy, archiveStatus, reactToStatus, removeStatusReaction, getUserReaction, getStatusReactionCounts, type StatusViewer, type Status } from '@/lib/status-queries';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';

const { width, height } = Dimensions.get('window');
const PROGRESS_BAR_HEIGHT = 3;

export default function StatusViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser, createOrGetConversation, createNotification, sendMessage } = useApp();
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [stickerUrls, setStickerUrls] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [showOwnStatusMenu, setShowOwnStatusMenu] = useState(false);
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [viewCount, setViewCount] = useState<number>(0);
  const [viewers, setViewers] = useState<StatusViewer[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [userReactions, setUserReactions] = useState<Record<string, 'heart' | 'like' | 'laugh' | null>>({});
  const [reactionCounts, setReactionCounts] = useState<Record<string, { heart: number; like: number; laugh: number }>>({});
  const [pausedProgress, setPausedProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    progressContainer: {
      flexDirection: 'row',
      paddingHorizontal: 4,
      paddingTop: 8,
      gap: 4,
      height: PROGRESS_BAR_HEIGHT + 8,
    },
    progressBarWrapper: {
      flex: 1,
      height: PROGRESS_BAR_HEIGHT,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: PROGRESS_BAR_HEIGHT / 2,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: '#fff',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingTop: 16,
      zIndex: 100,
      position: 'relative',
    },
    userInfo: {
      flex: 1,
    },
    userInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    profilePicture: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    profilePlaceholder: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profilePlaceholderText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600' as const,
    },
    userName: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600' as const,
    },
    timestampRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
      gap: 4,
    },
    timestamp: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 12,
    },
    timestampSeparator: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: 12,
      marginHorizontal: 2,
    },
    viewCountText: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 12,
    },
    closeButton: {
      padding: 8,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    textStatusContainer: {
      flex: 1,
      width: '100%',
      position: 'relative',
    },
    textBackgroundImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
    },
    textWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    adaptiveBackgroundContainer: {
      position: 'absolute',
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    adaptiveLineBackground: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 2,
    },
    textOverlay: {
      position: 'relative',
      width: '100%',
      maxWidth: '85%',
    },
    stickersContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
    },
    sticker: {
      position: 'absolute',
      width: 80,
      height: 80,
      marginLeft: -40,
      marginTop: -40,
    },
    textContent: {
      color: '#fff',
      fontSize: 24,
      textAlign: 'center',
      fontWeight: '500' as const,
    },
    media: {
      width: width,
      height: height * 0.7,
    },
    mediaWrapper: {
      width: width,
      height: height * 0.7,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    mediaOverlayTextContainer: {
      position: 'absolute',
      zIndex: 20,
      maxWidth: '88%',
    },
    mediaOverlayText: {
      color: '#fff',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.25)',
      overflow: 'hidden',
    },
    loadingText: {
      color: '#fff',
      fontSize: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navArea: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: width / 3,
    },
    leftArea: {
      left: 0,
    },
    rightArea: {
      right: 0,
    },
    centerArea: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: width / 3,
      right: width / 3,
    },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      paddingBottom: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      gap: 8,
    },
    quickReactions: {
      flexDirection: 'row',
      gap: 4,
    },
    quickReactionEmoji: {
      fontSize: 20,
    },
    messageInputContainer: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      maxHeight: 50,
    },
    messageInput: {
      color: '#fff',
      fontSize: 14,
      padding: 0,
    },
    reactionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    reactionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactionEmoji: {
      fontSize: 22,
    },
    reactionButtonActive: {
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderWidth: 2,
      borderColor: '#fff',
    },
    plusButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    plusMenuOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    plusMenuBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    plusMenu: {
      position: 'absolute',
      bottom: 80,
      left: 0,
      right: 0,
      backgroundColor: '#1a1a1a',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 8,
      paddingBottom: 20,
    },
    plusMenuOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 16,
    },
    plusMenuIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    plusMenuText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '500' as const,
    },
    // Own Status Menu Styles
    ownStatusMenuOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
    },
    ownStatusMenuBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    ownStatusMenu: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#1C1C1E',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
      maxHeight: height * 0.7,
    },
    ownStatusMenuHandle: {
      width: 40,
      height: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    ownStatusMenuOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 16,
    },
    ownStatusMenuIcon: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ownStatusMenuContent: {
      flex: 1,
    },
    ownStatusMenuText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '400' as const,
    },
    ownStatusMenuSubtext: {
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: 13,
      marginTop: 2,
    },
    // Owner's bottom bar styles
    ownerBottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingBottom: Platform.OS === 'ios' ? 34 : 12,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      zIndex: 10,
    },
    ownerBottomLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    ownerViewersText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '500' as const,
    },
    ownerBottomRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 24,
    },
    ownerActionButton: {
      alignItems: 'center',
      gap: 4,
    },
    ownerActionIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ownerActionText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '500' as const,
    },
  });

  useEffect(() => {
    if (!userId || userId === 'undefined') {
      router.back();
      return;
    }

    loadStatuses();
  }, [userId]);

  useEffect(() => {
    if (statuses.length > 0 && currentIndex < statuses.length) {
      loadMedia();
      loadBackgroundImage();
      loadStickers();
      startProgress();
      markAsViewed();
      // Load view count after a short delay to ensure status is set
      setTimeout(() => {
        loadViewCount();
      }, 100);
      // Load user's reaction and reaction counts
      loadUserReaction();
      loadReactionCounts();
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [currentIndex, statuses]);

  const loadUserReaction = async () => {
    const status = statuses[currentIndex];
    if (!status) return;
    
    const reaction = await getUserReaction(status.id);
    setUserReactions((prev: Record<string, 'heart' | 'like' | 'laugh' | null>) => ({ ...prev, [status.id]: reaction }));
  };

  const loadReactionCounts = async () => {
    const status = statuses[currentIndex];
    if (!status) return;
    
    const counts = await getStatusReactionCounts(status.id);
    setReactionCounts((prev: Record<string, { heart: number; like: number; laugh: number }>) => ({ ...prev, [status.id]: counts }));
  };

  // Pause when viewers modal opens, resume when it closes
  useEffect(() => {
    if (showViewers) {
      pauseProgress();
    } else if (!showViewers && isPaused && progressInterval.current === null) {
      resumeProgress();
    }
  }, [showViewers]);

  // Pause when own status menu opens, resume when it closes
  useEffect(() => {
    if (showOwnStatusMenu) {
      pauseProgress();
    } else if (!showOwnStatusMenu && isPaused && progressInterval.current === null) {
      resumeProgress();
    }
  }, [showOwnStatusMenu]);

  const loadViewCount = async () => {
    const status = statuses[currentIndex];
    if (!status) {
      setViewCount(0);
      return;
    }

    // Only show view count for own statuses
    if (currentUser?.id !== status.user_id) {
      setViewCount(0);
      return;
    }

    try {
      const count = await getStatusViewCount(status.id);
      setViewCount(count || 0);
    } catch (error) {
      console.error('Error loading view count:', error);
      setViewCount(0);
    }
  };

  const loadViewers = async () => {
    const status = statuses[currentIndex];
    if (!status || currentUser?.id !== status.user_id) {
      return;
    }

    setLoadingViewers(true);
    try {
      const viewerList = await getStatusViewers(status.id);
      setViewers(viewerList);
    } catch (error) {
      console.error('Error loading viewers:', error);
    } finally {
      setLoadingViewers(false);
    }
  };

  const handleViewersPress = async () => {
    const status = statuses[currentIndex];
    if (!status || currentUser?.id !== status.user_id) {
      return; // Only allow viewing for own statuses
    }
    
    pauseProgress();
    setShowViewers(true);
    await loadViewers();
  };

  const loadStatuses = async () => {
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.error('❌ [StatusViewer] Invalid userId:', userId);
      router.back();
      return;
    }

    console.log('🔍 [StatusViewer] Loading statuses for userId:', userId);
    setIsLoading(true);
    
    try {
      const userStatuses = await getUserStatuses(userId);
      console.log('📊 [StatusViewer] Received statuses:', {
        count: userStatuses.length,
        statuses: userStatuses.map(s => ({
          id: s.id?.substring(0, 8) + '...',
          content_type: s.content_type,
        })),
      });
      
      if (userStatuses.length === 0) {
        console.warn('⚠️ [StatusViewer] No statuses found for user:', userId);
        Alert.alert('No Statuses', 'This user has no active statuses.');
        router.back();
        return;
      }
      
      setStatuses(userStatuses);
      setCurrentIndex(0);
    } catch (error) {
      console.error('❌ [StatusViewer] Error loading statuses:', error);
      Alert.alert('Error', 'Failed to load statuses. Please try again.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMedia = async () => {
    const status = statuses[currentIndex];
    if (!status || !status.media_path) {
      setMediaUrl(null);
      return;
    }

    try {
      const url = await getSignedUrlForMedia(status.media_path);
      setMediaUrl(url);
    } catch (error) {
      console.error('Error loading media:', error);
      setMediaUrl(null);
    }
  };

  const loadBackgroundImage = async () => {
    const status = statuses[currentIndex];
    if (!status || !status.background_image_path) {
      setBackgroundImageUrl(null);
      return;
    }

    try {
      const url = await getSignedUrlForMedia(status.background_image_path);
      setBackgroundImageUrl(url);
    } catch (error) {
      console.error('Error loading background image:', error);
      setBackgroundImageUrl(null);
    }
  };

  const loadStickers = async () => {
    const status = statuses[currentIndex];
    if (!status || !status.stickers || status.stickers.length === 0) {
      setStickerUrls(new Map());
      return;
    }

    try {
      const stickerUrlMap = new Map<string, string>();
      for (const sticker of status.stickers) {
        // If sticker_image_url is a storage path, get signed URL
        // Otherwise, use it directly (if it's already a URL)
        if (sticker.sticker_image_url.startsWith('status-media/')) {
          const url = await getSignedUrlForMedia(sticker.sticker_image_url);
          if (url) {
            stickerUrlMap.set(sticker.id, url);
          }
        } else {
          stickerUrlMap.set(sticker.id, sticker.sticker_image_url);
        }
      }
      setStickerUrls(stickerUrlMap);
    } catch (error) {
      console.error('Error loading stickers:', error);
      setStickerUrls(new Map());
    }
  };

  const markAsViewed = async () => {
    const status = statuses[currentIndex];
    if (!status) return;

    await markStatusAsViewed(status.id);
  };

  // Helper functions for text styling (matching create screen)
  const getTextStyle = (textStyle: 'classic' | 'neon' | 'typewriter' | 'elegant' | 'bold' | 'italic' = 'classic') => {
    const baseStyle: any = {
      fontSize: textStyle === 'typewriter' ? 20 : textStyle === 'elegant' ? 24 : 32,
      fontWeight: textStyle === 'bold' ? ('700' as const) : textStyle === 'typewriter' ? ('400' as const) : ('600' as const),
      fontStyle: textStyle === 'italic' ? ('italic' as const) : ('normal' as const),
    };

    // Font family
    if (textStyle === 'typewriter') {
      baseStyle.fontFamily = 'monospace';
    } else if (textStyle === 'elegant') {
      baseStyle.fontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif';
    } else if (textStyle === 'neon') {
      baseStyle.fontFamily = Platform.OS === 'ios' ? 'Arial' : 'sans-serif-medium';
    }

    return baseStyle;
  };

  const getTextEffectStyle = (
    textEffect: 'default' | 'white-bg' | 'black-bg' | 'outline-white' | 'outline-black' | 'glow' = 'default',
    backgroundColor: string = '#1A73E8'
  ) => {
    const styles: any = {};
    
    switch (textEffect) {
      case 'outline-white':
        styles.textShadowColor = '#fff';
        styles.textShadowOffset = { width: -1, height: 1 };
        styles.textShadowRadius = 2;
        break;
      case 'outline-black':
        styles.textShadowColor = '#000';
        styles.textShadowOffset = { width: -1, height: 1 };
        styles.textShadowRadius = 2;
        break;
      case 'glow':
        styles.textShadowColor = backgroundColor;
        styles.textShadowOffset = { width: 0, height: 0 };
        styles.textShadowRadius = 20;
        break;
    }
    
    return styles;
  };

  const pauseProgress = () => {
    if (progressInterval.current && !isPaused) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
      setIsPaused(true);
      // Save current progress value synchronously
      progressAnim.stopAnimation((value: number) => {
        setPausedProgress(value);
      });
    }
  };

  const resumeProgress = () => {
    if (isPaused) {
      // Clear any existing interval first
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      
      // Get current progress value from the animated value directly
      // stopAnimation is synchronous in terms of getting the value
      progressAnim.stopAnimation((currentProgressValue: number) => {
        // Update state
        setIsPaused(false);
        setPausedProgress(currentProgressValue);
        
        const duration = 5000; // 5 seconds per status
        const remainingProgress = Math.max(0, Math.min(1, 1 - currentProgressValue));
        const remainingDuration = duration * remainingProgress;
        const steps = 100;
        const stepDuration = Math.max(10, remainingDuration / steps); // Minimum 10ms per step
        let currentStep = currentProgressValue * steps;

        // Start the interval
        progressInterval.current = setInterval(() => {
          currentStep++;
          const progress = Math.min(1, currentStep / steps);

          progressAnim.setValue(progress);

          if (progress >= 1) {
            if (progressInterval.current) {
              clearInterval(progressInterval.current);
              progressInterval.current = null;
            }
            handleNext();
          }
        }, stepDuration);
      });
    }
  };

  const togglePause = () => {
    if (isPaused) {
      resumeProgress();
    } else {
      pauseProgress();
    }
  };

  const startProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    setIsPaused(false);
    setPausedProgress(0);
    progressAnim.setValue(0);
    const duration = 5000; // 5 seconds per status
    const steps = 100;
    const stepDuration = duration / steps;
    let currentStep = 0;

    progressInterval.current = setInterval(() => {
      if (!isPaused) {
        currentStep++;
        const progress = currentStep / steps;

        progressAnim.setValue(progress);

        if (progress >= 1) {
          if (progressInterval.current) {
            clearInterval(progressInterval.current);
            progressInterval.current = null;
          }
          handleNext();
        }
      }
    }, stepDuration);
  };

  const handleNext = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      router.back();
    }
  };

  const handlePrev = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleClose = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    router.back();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentUser) return;
    
    const status = statuses[currentIndex];
    if (!status) return;
    
    try {
      // Store the media_path instead of signed URL so it doesn't expire
      // We'll generate the signed URL when displaying the message
      let statusPreviewUrl: string | null = null;
      if (status.media_path) {
        // Store the media_path, not the signed URL, so it doesn't expire
        statusPreviewUrl = status.media_path;
      }
      
      // Navigate to conversation with the status owner
      const conversation = await createOrGetConversation(status.user_id);
      
      if (conversation) {
        // Send message with status attachment
        await sendMessage(
          conversation.id,
          status.user_id,
          messageText.trim(),
          undefined, // mediaUrl
          undefined, // documentUrl
          undefined, // documentName
          'text', // messageType
          undefined, // stickerId
          status.id, // statusId - NEW PARAMETER
          statusPreviewUrl || undefined // statusPreviewUrl - convert null to undefined
        );
        
        // Navigate to the conversation screen
        router.push(`/messages/${conversation.id}` as any);
        // Clear the input
        setMessageText('');
      } else {
        Alert.alert('Error', 'Could not start conversation. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const handleReaction = async (reactionType: 'heart' | 'like' | 'laugh') => {
    const status = statuses[currentIndex];
    if (!status || !currentUser) return;

    try {
      const currentReaction = userReactions[status.id];
      
      // If clicking the same reaction, remove it; otherwise, update it
      if (currentReaction === reactionType) {
        const success = await removeStatusReaction(status.id);
        if (success) {
          setUserReactions((prev: Record<string, 'heart' | 'like' | 'laugh' | null>) => ({ ...prev, [status.id]: null }));
          // Update counts
          const counts = await getStatusReactionCounts(status.id);
          setReactionCounts((prev: Record<string, { heart: number; like: number; laugh: number }>) => ({ ...prev, [status.id]: counts }));
        }
      } else {
        try {
          await reactToStatus(status.id, reactionType);
          setUserReactions((prev: Record<string, 'heart' | 'like' | 'laugh' | null>) => ({ ...prev, [status.id]: reactionType }));
          // Update counts
          const counts = await getStatusReactionCounts(status.id);
          setReactionCounts((prev: Record<string, { heart: number; like: number; laugh: number }>) => ({ ...prev, [status.id]: counts }));
          
          // Send notification to status owner (if not own status)
          if (status.user_id !== currentUser.id) {
            const reactionEmoji = reactionType === 'heart' ? '❤️' : reactionType === 'like' ? '👍' : '😂';
            await createNotification(
              status.user_id,
              'status_reaction',
              'Status Reaction',
              `${currentUser.fullName} reacted ${reactionEmoji} to your story`,
              { statusId: status.id, reactionType, userId: currentUser.id, statusOwnerId: status.user_id }
            );
          }
        } catch (reactionError: any) {
          console.error('Error reacting to status:', reactionError);
          let errorMessage = 'Failed to react to status.';
          
          if (reactionError?.code === '42P01' || reactionError?.message?.includes('does not exist')) {
            errorMessage = 'Status reactions table not found. Please run the status-reactions-setup.sql script in Supabase.';
          } else if (reactionError?.code === '42501' || reactionError?.message?.includes('permission denied') || reactionError?.code === 'PGRST301') {
            errorMessage = 'Permission denied. Please check that the status_reactions table exists and RLS policies are set up correctly.';
          } else if (reactionError?.message) {
            errorMessage = `Failed to react: ${reactionError.message}`;
          }
          
          Alert.alert('Error', errorMessage);
        }
      }
    } catch (error: any) {
      console.error('Error handling reaction:', error);
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      Alert.alert('Error', `Failed to react to status: ${errorMessage}`);
    }
  };

  const handleUpdatePrivacy = async (privacyLevel: 'public' | 'friends' | 'followers' | 'only_me' | 'custom') => {
    const status = statuses[currentIndex];
    if (!status || !currentUser || status.user_id !== currentUser.id) return;

    try {
      const success = await updateStatusPrivacy(status.id, privacyLevel);
      if (success) {
        // Update local state
        setStatuses((prev: Status[]) => prev.map((s: Status) => 
          s.id === status.id ? { ...s, privacy_level: privacyLevel } : s
        ));
        Alert.alert('Success', 'Story privacy updated successfully!');
      } else {
        Alert.alert('Error', 'Failed to update story privacy. Please try again.');
      }
    } catch (error) {
      console.error('Error updating privacy:', error);
      Alert.alert('Error', 'Failed to update story privacy. Please try again.');
    }
    setShowPrivacyPicker(false);
    resumeProgress();
  };

  const handleArchiveStatus = async () => {
    const status = statuses[currentIndex];
    if (!status || !currentUser || status.user_id !== currentUser.id) return;

    Alert.alert(
      'Archive Story',
      'This story will be removed from your story and saved to your archive. You can view it later in your archive.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'default',
          onPress: async () => {
            try {
              const success = await archiveStatus(status.id);
              if (success) {
                // Remove from current statuses list
                const remainingStatuses = statuses.filter((s: Status) => s.id !== status.id);
                setStatuses(remainingStatuses);
                
                if (remainingStatuses.length === 0) {
                  router.back();
                } else if (currentIndex >= remainingStatuses.length) {
                  setCurrentIndex(remainingStatuses.length - 1);
                }
                
                Alert.alert('Success', 'Story archived successfully!');
              } else {
                Alert.alert('Error', 'Failed to archive story. Please try again.');
              }
            } catch (error) {
              console.error('Error archiving status:', error);
              Alert.alert('Error', 'Failed to archive story. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSendInMessenger = async () => {
    const status = statuses[currentIndex];
    if (!status || !currentUser || status.user_id !== currentUser.id) return;

    try {
      // For now, we'll navigate to messages and show a prompt
      // In a full implementation, you'd create a conversation and send the status as a message
      Alert.alert(
        'Send in Messenger',
        'Would you like to share this story in a message?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Messages',
            onPress: () => {
              router.push('/(tabs)/messages' as any);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error sending in messenger:', error);
      Alert.alert('Error', 'Failed to open messenger. Please try again.');
    }
  };

  const handleMentionPeople = () => {
    // For now, show info about mentions
    // In a full implementation, you'd show a user picker to mention
    Alert.alert(
      'Mention People',
      'To mention people in your story, type @ followed by their name while creating or editing your story text.',
      [{ text: 'OK' }]
    );
  };

  const handleReportIssue = () => {
    Alert.alert(
      'Report an Issue',
      'If you\'re experiencing problems with this story, please contact support.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Contact Support',
          onPress: () => {
            // In a full implementation, open support/feedback screen
            Alert.alert('Support', 'Please email support@yourapp.com with details about the issue.');
          },
        },
      ]
    );
  };

  const handleDelete = async (e?: any) => {
    // Stop event propagation to prevent triggering navigation
    if (e) {
      e.stopPropagation?.();
      e.preventDefault?.();
    }

    const status = statuses[currentIndex];
    if (!status) {
      console.warn('⚠️ [handleDelete] No status at current index');
      return;
    }

    const isOwnStatus = currentUser?.id === status.user_id;

    if (!isOwnStatus) {
      Alert.alert('Error', 'You can only delete your own statuses.');
      return;
    }

    if (!currentUser?.id) {
      Alert.alert('Error', 'You must be logged in to delete a status.');
      return;
    }

    Alert.alert(
      'Delete Status',
      'Are you sure you want to delete this status?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              console.log('🗑️ [handleDelete] Deleting status:', status.id);
              const success = await deleteStatus(status.id);
              console.log('🗑️ [handleDelete] Delete result:', success);
              
              if (success) {
                // Remove deleted status from list
                const newStatuses = statuses.filter((s: Status) => s.id !== status.id);
                setStatuses(newStatuses);

                // Navigate appropriately
                if (newStatuses.length === 0) {
                  console.log('✅ [handleDelete] No more statuses, going back');
                  router.back();
                } else {
                  // Adjust index if needed
                  const newIndex = currentIndex >= newStatuses.length 
                    ? newStatuses.length - 1 
                    : currentIndex;
                  console.log('✅ [handleDelete] Updated index to:', newIndex);
                  setCurrentIndex(newIndex);
                }
              } else {
                console.error('❌ [handleDelete] Delete failed');
                Alert.alert('Error', 'Failed to delete status. Please try again.');
              }
            } catch (error) {
              console.error('❌ [handleDelete] Exception:', error);
              Alert.alert('Error', `Failed to delete status: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading || statuses.length === 0) {
    return (
      <Modal visible={true} animationType="fade">
        <View style={[styles.container, { backgroundColor: '#000' }]}>
          <StatusBar barStyle="light-content" />
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  const status = statuses[currentIndex];

  return (
    <Modal visible={true} animationType="fade" onRequestClose={handleClose}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Progress Bars */}
        <View style={styles.progressContainer}>
          {statuses.map((_: Status, index: number) => (
            <View key={index} style={styles.progressBarWrapper}>
              {index === currentIndex ? (
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              ) : index < currentIndex ? (
                <View style={[styles.progressBarFill, { width: '100%' }]} />
              ) : null}
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.userInfoRow}>
              {status.user?.profile_picture ? (
                <Image
                  source={{ uri: status.user.profile_picture }}
                  style={styles.profilePicture}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.profilePicture, styles.profilePlaceholder]}>
                  <Text style={styles.profilePlaceholderText}>
                    {(status.user?.full_name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
                <View style={{ flex: 1 }}>
                <Text style={styles.userName}>
                  {status.user?.full_name || 'User'}
                </Text>
                <View style={styles.timestampRow}>
                  <Text style={styles.timestamp}>
                    {formatTimeAgo(status.created_at)}
                  </Text>
                  {/* Show view count for own statuses - inline with timestamp */}
                  {currentUser?.id === status.user_id && viewCount > 0 && (
                    <>
                      <Text style={styles.timestampSeparator}>·</Text>
                      <TouchableOpacity 
                        onPress={handleViewersPress}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.viewCountText}>
                          {viewCount} {viewCount === 1 ? 'viewer' : 'viewers'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 100 }}>
            {/* Three-dot menu - only show for own statuses */}
            {currentUser?.id === status.user_id && (
              <TouchableOpacity 
                style={[styles.closeButton, { zIndex: 101 }]} 
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  setShowOwnStatusMenu(true);
                }}
                activeOpacity={0.7}
              >
                <MoreHorizontal size={24} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.closeButton, { zIndex: 101 }]} 
              onPress={(e: any) => {
                e?.stopPropagation?.();
                handleClose();
              }}
              activeOpacity={0.7}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {status.content_type === 'text' ? (
            <View style={[styles.textStatusContainer, {
              backgroundColor: status.background_color || '#1A73E8',
            }]}>
              {/* Background Image */}
              {backgroundImageUrl && (
                <Image 
                  source={{ uri: backgroundImageUrl }} 
                  style={styles.textBackgroundImage} 
                  contentFit="cover" 
                />
              )}
              
              {/* Text Content with Customization */}
              <View style={[styles.textWrapper, {
                alignItems: status.text_alignment === 'left' ? 'flex-start' : 
                           status.text_alignment === 'right' ? 'flex-end' : 'center',
              }]}>
                {/* Per-line Backgrounds for white-bg/black-bg effects */}
                {(status.text_effect === 'white-bg' || status.text_effect === 'black-bg') && status.text_content && (
                  <View 
                    style={[styles.adaptiveBackgroundContainer, {
                      alignItems: status.text_alignment === 'left' ? 'flex-start' : 
                                 status.text_alignment === 'right' ? 'flex-end' : 'center',
                    }]} 
                    pointerEvents="none"
                  >
                    {status.text_content.split('\n').map((line: string, index: number) => {
                      const trimmedLine = line.trim();
                      if (!trimmedLine) return null;
                      
                      return (
                        <View
                          key={index}
                          style={[
                            styles.adaptiveLineBackground,
                            {
                              backgroundColor: status.text_effect === 'white-bg' ? '#fff' : '#000',
                              borderRadius: 20,
                              marginTop: index > 0 ? -2 : 0,
                              alignSelf: status.text_alignment === 'center' ? 'center' : 
                                        status.text_alignment === 'right' ? 'flex-end' : 'flex-start',
                            },
                          ]}
                          pointerEvents="none"
                        >
                          <Text
                            style={[
                              getTextStyle(status.text_style || 'classic'),
                              {
                                textAlign: status.text_alignment || 'center',
                                color: 'transparent',
                              },
                            ]}
                          >
                            {trimmedLine}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                
                {/* Actual Text */}
                <View style={styles.textOverlay}>
                  <Text
                    style={[
                      getTextStyle(status.text_style || 'classic'),
                      getTextEffectStyle(status.text_effect || 'default', status.background_color || '#1A73E8'),
                      {
                        textAlign: status.text_alignment || 'center',
                        color: (status.text_effect === 'white-bg' || status.text_effect === 'black-bg')
                          ? (status.text_effect === 'white-bg' ? '#000' : '#fff')
                          : '#fff',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      },
                    ]}
                  >
                    {status.text_content}
                  </Text>
                </View>
              </View>
              
              {/* Stickers */}
              {status.stickers && status.stickers.length > 0 && (
                <View style={styles.stickersContainer} pointerEvents="none">
                  {status.stickers.map((sticker: any) => {
                    const stickerUrl = stickerUrls.get(sticker.id);
                    if (!stickerUrl) return null;
                    
                    return (
                      <Image
                        key={sticker.id}
                        source={{ uri: stickerUrl }}
                        style={[styles.sticker, {
                          left: `${sticker.position_x * 100}%`,
                          top: `${sticker.position_y * 100}%`,
                          transform: [
                            { scale: sticker.scale || 1.0 },
                            { rotate: `${sticker.rotation || 0}deg` },
                          ],
                        }]}
                        contentFit="contain"
                      />
                    );
                  })}
                </View>
              )}
            </View>
          ) : (status.content_type === 'image' || status.content_type === 'video') && mediaUrl ? (
            <View
              style={styles.mediaWrapper}
              onLayout={(e) => {
                // reserved for future exact centering; we store but don't strictly need it right now
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { width: _w, height: _h } = e.nativeEvent.layout;
              }}
            >
              {status.content_type === 'image' ? (
                <Image source={{ uri: mediaUrl }} style={styles.media} contentFit="contain" />
              ) : (
                <Video
                  source={{ uri: mediaUrl }}
                  style={styles.media}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay
                />
              )}

              {/* Text overlay for image/video statuses */}
              {!!status.text_content?.trim() && (
                <View
                  style={[
                    styles.mediaOverlayTextContainer,
                    {
                      left: `${(status.text_position_x ?? 0.5) * 100}%`,
                      top: `${(status.text_position_y ?? 0.5) * 100}%`,
                      transform: [{ translateX: -110 }, { translateY: -22 }],
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Text
                    style={[
                      styles.mediaOverlayText,
                      getTextStyle(status.text_style || 'classic'),
                      getTextEffectStyle(status.text_effect || 'default', status.background_color || '#000'),
                    ]}
                  >
                    {status.text_content}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.loadingText}>Loading media...</Text>
          )}
        </View>

        {/* Full screen tap to pause/resume */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={togglePause}
          activeOpacity={1}
        />
        
        {/* Navigation Areas - these will intercept touches but also allow pause/resume */}
        <TouchableOpacity
          style={[styles.navArea, styles.leftArea]}
          onPress={(e: any) => {
            e?.stopPropagation?.();
            togglePause();
            handlePrev();
          }}
          activeOpacity={1}
        />
        <TouchableOpacity
          style={[styles.navArea, styles.rightArea]}
          onPress={(e: any) => {
            e?.stopPropagation?.();
            togglePause();
            handleNext();
          }}
          activeOpacity={1}
        />

        {/* Owner's Bottom Bar - Only show for own statuses */}
        {currentUser?.id === status.user_id && (
          <View style={styles.ownerBottomBar}>
            <TouchableOpacity 
              style={styles.ownerBottomLeft}
              onPress={handleViewersPress}
              activeOpacity={0.7}
            >
              <ChevronUp size={16} color="#fff" />
              <Text style={styles.ownerViewersText}>
                {viewCount} {viewCount === 1 ? 'viewer' : 'viewers'}
              </Text>
            </TouchableOpacity>
            
            <View style={styles.ownerBottomRight}>
              <TouchableOpacity
                style={styles.ownerActionButton}
                onPress={() => {
                  router.push('/status/create' as any);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.ownerActionIcon}>
                  <Plus size={18} color="#fff" />
                </View>
                <Text style={styles.ownerActionText}>Add new</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.ownerActionButton}
                onPress={() => {
                  handleMentionPeople();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.ownerActionIcon}>
                  <AtSign size={18} color="#fff" />
                </View>
                <Text style={styles.ownerActionText}>Mention</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Interaction Bar - Only show for other people's statuses */}
        {currentUser?.id !== status.user_id && (
          <View style={styles.bottomBar}>
            {/* Send Message Input */}
            <View style={styles.messageInputContainer}>
              <TextInput
                style={styles.messageInput}
                placeholder="Send message..."
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={messageText}
                onChangeText={setMessageText}
                onSubmitEditing={handleSendMessage}
                multiline={false}
              />
            </View>

            {/* Reaction Buttons - Only 3 emojis (near plus icon) */}
            <View style={styles.reactionButtons}>
              <TouchableOpacity
                style={[
                  styles.reactionButton,
                  userReactions[statuses[currentIndex]?.id] === 'heart' && styles.reactionButtonActive
                ]}
                onPress={() => handleReaction('heart')}
              >
                <Text style={styles.reactionEmoji}>❤️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.reactionButton,
                  userReactions[statuses[currentIndex]?.id] === 'like' && styles.reactionButtonActive
                ]}
                onPress={() => handleReaction('like')}
              >
                <Text style={styles.reactionEmoji}>👍</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.reactionButton,
                  userReactions[statuses[currentIndex]?.id] === 'laugh' && styles.reactionButtonActive
                ]}
                onPress={() => handleReaction('laugh')}
              >
                <Text style={styles.reactionEmoji}>😂</Text>
              </TouchableOpacity>
            </View>

            {/* Plus Icon */}
            <TouchableOpacity
              style={styles.plusButton}
              onPress={() => setShowPlusMenu(!showPlusMenu)}
            >
              <Plus size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Plus Menu Modal */}
        {showPlusMenu && (
          <View style={styles.plusMenuOverlay}>
            <TouchableOpacity
              style={styles.plusMenuBackdrop}
              onPress={() => setShowPlusMenu(false)}
              activeOpacity={1}
            />
            <View style={styles.plusMenu}>
              <TouchableOpacity
                style={styles.plusMenuOption}
                onPress={() => {
                  setShowPlusMenu(false);
                  router.push('/status/create' as any);
                }}
              >
                <View style={styles.plusMenuIcon}>
                  <Plus size={24} color="#fff" />
                </View>
                <Text style={styles.plusMenuText}>Create story</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.plusMenuOption}
                onPress={() => {
                  setShowPlusMenu(false);
                  Alert.alert('Coming Soon', 'Create story with music feature is coming soon!');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.plusMenuIcon}>
                  <Music size={24} color="#fff" />
                </View>
                <Text style={styles.plusMenuText}>Create with music</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.plusMenuOption}
                onPress={() => {
                  setShowPlusMenu(false);
                  Alert.alert('Coming Soon', 'AI image generation feature is coming soon!');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.plusMenuIcon}>
                  <ImageIcon size={24} color="#fff" />
                </View>
                <Text style={styles.plusMenuText}>Imagine</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.plusMenuOption}
                onPress={() => {
                  setShowPlusMenu(false);
                  Alert.alert('Reshare Story', 'Resharing stories feature is coming soon!');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.plusMenuIcon}>
                  <RefreshCw size={24} color="#fff" />
                </View>
                <Text style={styles.plusMenuText}>Reshare story</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.plusMenuOption}
                onPress={() => {
                  setShowPlusMenu(false);
                  Alert.alert('Share Story', 'Sharing stories feature is coming soon!');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.plusMenuIcon}>
                  <Share2 size={24} color="#fff" />
                </View>
                <Text style={styles.plusMenuText}>Share story</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Own Status Menu Modal */}
        {showOwnStatusMenu && status && (
          <View style={styles.ownStatusMenuOverlay}>
            <TouchableOpacity
              style={styles.ownStatusMenuBackdrop}
              onPress={() => {
                setShowOwnStatusMenu(false);
                resumeProgress();
              }}
              activeOpacity={1}
            />
            <View style={styles.ownStatusMenu}>
              <View style={styles.ownStatusMenuHandle} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={styles.ownStatusMenuOption}
                  onPress={() => {
                    setShowOwnStatusMenu(false);
                    resumeProgress();
                    handleMentionPeople();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.ownStatusMenuIcon}>
                    <AtSign size={24} color="#fff" />
                  </View>
                  <View style={styles.ownStatusMenuContent}>
                    <Text style={styles.ownStatusMenuText}>Mention people</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ownStatusMenuOption}
                  onPress={() => {
                    pauseProgress();
                    setShowOwnStatusMenu(false);
                    setShowPrivacyPicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.ownStatusMenuIcon}>
                    <Lock size={24} color="#fff" />
                  </View>
                  <View style={styles.ownStatusMenuContent}>
                    <Text style={styles.ownStatusMenuText}>Edit story privacy</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ownStatusMenuOption}
                  onPress={() => {
                    setShowOwnStatusMenu(false);
                    resumeProgress();
                    handleSendInMessenger();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.ownStatusMenuIcon}>
                    <MessageCircle size={24} color="#fff" />
                  </View>
                  <View style={styles.ownStatusMenuContent}>
                    <Text style={styles.ownStatusMenuText}>Send in Messenger</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ownStatusMenuOption}
                  onPress={async () => {
                    setShowOwnStatusMenu(false);
                    resumeProgress();
                    
                    const status = statuses[currentIndex];
                    if (!status) return;
                    
                    try {
                      let fileUri = null;
                      
                      if (status.content_type === 'image' && mediaUrl) {
                        fileUri = mediaUrl;
                      } else if (status.content_type === 'text' && backgroundImageUrl) {
                        fileUri = backgroundImageUrl;
                      }
                      
                      if (fileUri) {
                        // Request permission to save photos
                        // Note: After updating app.json, you must rebuild the app for AndroidManifest changes
                        try {
                          // Try requesting with writeOnly first (only write permission, no audio)
                          const permission = await MediaLibrary.requestPermissionsAsync(true);
                          if (!permission.granted) {
                            Alert.alert('Permission Required', 'Please grant photo library access to save images.');
                            return;
                          }
                        } catch (error: any) {
                          // If the error is about audio permission not being declared,
                          // it means the app needs to be rebuilt with the updated app.json
                          if (error?.message?.includes('AUDIO permission') || error?.message?.includes('AndroidManifest')) {
                            Alert.alert(
                              'Rebuild Required',
                              'The app needs to be rebuilt to apply permission changes. Please rebuild your development build or run: npx expo prebuild --clean',
                              [{ text: 'OK' }]
                            );
                            console.error('MediaLibrary permission error - rebuild required:', error);
                            return;
                          }
                          // For other errors, show generic message
                          Alert.alert('Error', 'Failed to request permission. Please try again.');
                          console.error('MediaLibrary permission error:', error);
                          return;
                        }
                        
                        const filename = fileUri.split('/').pop() || `status_${status.id}.jpg`;
                        const filePath = `${FileSystem.cacheDirectory}${filename}`;
                        
                        const downloadResult = await FileSystem.downloadAsync(fileUri, filePath);
                        await MediaLibrary.createAssetAsync(downloadResult.uri);
                        
                        Alert.alert('Success', 'Photo saved to your gallery!');
                      } else {
                        Alert.alert('No Media', 'This status doesn\'t contain a photo to save.');
                      }
                    } catch (error) {
                      console.error('Error saving photo:', error);
                      Alert.alert('Error', 'Failed to save photo. Please try again.');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.ownStatusMenuIcon}>
                    <Download size={24} color="#fff" />
                  </View>
                  <View style={styles.ownStatusMenuContent}>
                    <Text style={styles.ownStatusMenuText}>Save photo</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ownStatusMenuOption}
                  onPress={() => {
                    setShowOwnStatusMenu(false);
                    resumeProgress();
                    handleArchiveStatus();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.ownStatusMenuIcon}>
                    <Archive size={24} color="#fff" />
                  </View>
                  <View style={styles.ownStatusMenuContent}>
                    <Text style={styles.ownStatusMenuText}>Archive photo</Text>
                    <Text style={styles.ownStatusMenuSubtext}>Remove photo from story and save to archive.</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ownStatusMenuOption}
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    setShowOwnStatusMenu(false);
                    resumeProgress();
                    setTimeout(() => handleDelete(e), 300);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.ownStatusMenuIcon}>
                    <Trash2 size={24} color="#ff3b30" />
                  </View>
                  <View style={styles.ownStatusMenuContent}>
                    <Text style={[styles.ownStatusMenuText, { color: '#ff3b30' }]}>Delete photo</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ownStatusMenuOption}
                  onPress={async () => {
                    setShowOwnStatusMenu(false);
                    resumeProgress();
                    
                    const status = statuses[currentIndex];
                    if (!status || !status.id) return;
                    
                    try {
                      // Deep link opens the app when installed; fallback link lets users download the app.
                      const deepLink = `committed://status-item/${status.id}`;
                      const downloadUrl = `https://dreambig.org.za/committed`;
                      const shareUrl = deepLink;
                      
                      // Copy to clipboard
                      if (Clipboard && Clipboard.setString) {
                        Clipboard.setString(shareUrl);
                        Alert.alert('Link Copied', 'Story link copied to clipboard!', [{ text: 'OK' }]);
                      } else {
                        // Fallback: Use Share API
                        await Share.share({
                          message: `Open in app: ${deepLink}\nDownload Committed: ${downloadUrl}`,
                          url: shareUrl,
                        });
                      }
                    } catch (error) {
                      console.error('Error copying link:', error);
                      Alert.alert('Error', 'Failed to copy link. Please try again.');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.ownStatusMenuIcon}>
                    <Link size={24} color="#fff" />
                  </View>
                  <View style={styles.ownStatusMenuContent}>
                    <Text style={styles.ownStatusMenuText}>Copy link to share this story</Text>
                    <Text style={styles.ownStatusMenuSubtext}>
                      Stories are visible to {status.user?.full_name || 'your'}'s audience for 24 hours.
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ownStatusMenuOption}
                  onPress={() => {
                    setShowOwnStatusMenu(false);
                    resumeProgress();
                    handleReportIssue();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.ownStatusMenuIcon}>
                    <AlertCircle size={24} color="#fff" />
                  </View>
                  <View style={styles.ownStatusMenuContent}>
                    <Text style={styles.ownStatusMenuText}>Something went wrong</Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        )}

        {/* Privacy Picker Modal */}
        {showPrivacyPicker && status && (
          <View style={styles.ownStatusMenuOverlay}>
            <TouchableOpacity
              style={styles.ownStatusMenuBackdrop}
              onPress={() => {
                setShowPrivacyPicker(false);
                resumeProgress();
              }}
              activeOpacity={1}
            />
            <View style={styles.ownStatusMenu}>
              <View style={styles.ownStatusMenuHandle} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.ownStatusMenuText, { padding: 20, paddingBottom: 10, fontSize: 18, fontWeight: '600' as const }]}>
                  Edit Story Privacy
                </Text>
                <Text style={[styles.ownStatusMenuSubtext, { paddingHorizontal: 20, paddingBottom: 16 }]}>
                  Who can see your story?
                </Text>
                
                {(['public', 'friends', 'followers', 'only_me'] as const).map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={styles.ownStatusMenuOption}
                    onPress={() => {
                      handleUpdatePrivacy(level);
                      setShowPrivacyPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.ownStatusMenuIcon}>
                      {level === 'public' && <Globe size={24} color="#fff" />}
                      {(level === 'friends' || level === 'followers' || level === 'only_me') && <Lock size={24} color="#fff" />}
                    </View>
                    <View style={styles.ownStatusMenuContent}>
                      <Text style={styles.ownStatusMenuText}>
                        {level === 'public' && 'Public'}
                        {level === 'friends' && 'Friends'}
                        {level === 'followers' && 'Followers'}
                        {level === 'only_me' && 'Only Me'}
                        {status.privacy_level === level && ' ✓'}
                      </Text>
                      <Text style={styles.ownStatusMenuSubtext}>
                        {level === 'public' && 'Anyone can see your story'}
                        {level === 'friends' && 'Only your friends can see your story'}
                        {level === 'followers' && 'Only your followers can see your story'}
                        {level === 'only_me' && 'Only you can see your story'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Viewers Modal */}
        {showViewers && status && (
          <ViewersListModal
            visible={showViewers}
            onClose={() => {
              setShowViewers(false);
              resumeProgress();
            }}
            viewers={viewers}
            loading={loadingViewers}
            viewCount={viewCount}
            status={status}
            onRefresh={async () => {
              await loadViewers();
              await loadViewCount();
            }}
          />
        )}
      </View>
    </Modal>
  );
}

/**
 * Viewers List Modal Component
 */
function ViewersListModal({
  visible,
  onClose,
  viewers: initialViewers,
  loading: initialLoading,
  viewCount: initialViewCount,
  status,
  onRefresh,
}: {
  visible: boolean;
  onClose: () => void;
  viewers: StatusViewer[];
  loading: boolean;
  viewCount: number;
  status: Status;
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'viewers' | 'insights'>('viewers');
  const [viewers, setViewers] = useState<StatusViewer[]>(initialViewers);
  const [loading, setLoading] = useState(initialLoading);
  const [viewCount, setViewCount] = useState(initialViewCount);

  useEffect(() => {
    setViewers(initialViewers);
    setLoading(initialLoading);
    setViewCount(initialViewCount);
  }, [initialViewers, initialLoading, initialViewCount]);

  const styles = StyleSheet.create({
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#1a1a1a',
      zIndex: 1000,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      paddingTop: 50,
      borderBottomWidth: 1,
      borderBottomColor: '#333',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: '#fff',
    },
    closeButton: {
      padding: 8,
    },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#333',
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary || '#1877F2',
    },
    tabText: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: '#aaa',
    },
    tabTextActive: {
      color: '#fff',
    },
    content: {
      flex: 1,
      padding: 16,
    },
    viewersHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    viewersCount: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: '#fff',
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: '#333',
      gap: 6,
    },
    refreshButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '500' as const,
    },
    viewerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#333',
    },
    viewerAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    viewerAvatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#333',
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerAvatarText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600' as const,
    },
    viewerInfo: {
      flex: 1,
    },
    viewerName: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: '#fff',
      marginBottom: 4,
    },
    viewerTime: {
      fontSize: 14,
      color: '#aaa',
    },
    viewerReaction: {
      fontSize: 16,
    },
    messageIndicator: {
      backgroundColor: '#007AFF',
      borderRadius: 10,
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 2,
    },
    viewerOptions: {
      padding: 8,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 16,
      color: '#aaa',
      textAlign: 'center',
    },
  });

  const formatViewTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await onRefresh();
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.header}>
          <View style={{ width: 24 }} />
          <Text style={styles.headerTitle}>Story viewers</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'viewers' && styles.tabActive]}
            onPress={() => setActiveTab('viewers')}
          >
            <Text style={[styles.tabText, activeTab === 'viewers' && styles.tabTextActive]}>
              Viewers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'insights' && styles.tabActive]}
            onPress={() => setActiveTab('insights')}
          >
            <Text style={[styles.tabText, activeTab === 'insights' && styles.tabTextActive]}>
              Insights
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {activeTab === 'viewers' ? (
            <>
              <View style={styles.viewersHeader}>
                <Text style={styles.viewersCount}>
                  {viewCount} {viewCount === 1 ? 'viewer' : 'viewers'}
                </Text>
                <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
                  <RefreshCw size={16} color="#fff" />
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>

              {loading ? (
                <ActivityIndicator size="large" color="#fff" style={{ marginTop: 40 }} />
              ) : viewers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No viewers yet</Text>
                </View>
              ) : (
                viewers.map((viewer: StatusViewer) => {
                  const reactionEmoji = viewer.reaction_type === 'heart' ? '❤️' 
                    : viewer.reaction_type === 'like' ? '👍' 
                    : viewer.reaction_type === 'laugh' ? '😂' 
                    : null;
                  
                  const handleNavigateToProfile = () => {
                    // Use viewer_id directly (the person who viewed the status)
                    // This is the actual ID of the viewer, not the status owner
                    const profileUserId = viewer.viewer_id || viewer.user.id;
                    
                    // Get the status owner ID from the status prop
                    const statusOwnerId = status?.user_id;
                    
                    console.log('Navigating to profile:', {
                      profileUserId,
                      viewerId: viewer.viewer_id,
                      userId: viewer.user.id,
                      viewerName: viewer.user.full_name,
                      statusOwnerId: statusOwnerId
                    });
                    
                    if (!profileUserId) {
                      console.error('No profile user ID available');
                      Alert.alert('Error', 'Unable to navigate to profile');
                      return;
                    }
                    
                    // Safety check: Don't navigate if somehow we got the status owner's ID
                    // (This shouldn't happen, but just in case)
                    if (profileUserId === statusOwnerId) {
                      console.error('ERROR: Trying to navigate to status owner instead of viewer!');
                      console.error('Viewer ID:', viewer.viewer_id);
                      console.error('Status Owner ID:', statusOwnerId);
                      Alert.alert('Error', 'Cannot navigate to status owner. This is a bug.');
                      return;
                    }
                    
                    // Close modal first, then navigate after it's fully closed
                    // This prevents navigation conflicts
                    const profileRoute = `/profile/${profileUserId}`;
                    console.log('=== NAVIGATION DEBUG ===');
                    console.log('Profile Route:', profileRoute);
                    console.log('Profile User ID:', profileUserId);
                    console.log('Viewer ID:', viewer.viewer_id);
                    console.log('Viewer Name:', viewer.user.full_name);
                    console.log('Status Owner ID:', statusOwnerId);
                    console.log('Are they the same?', profileUserId === statusOwnerId);
                    console.log('=======================');
                    
                    // Close modal first
                    onClose();
                    
                    // Wait for modal to fully close, then navigate
                    // Use replace instead of push to replace the status viewer in the stack
                    InteractionManager.runAfterInteractions(() => {
                      setTimeout(() => {
                        try {
                          console.log('Navigating to profile after modal closed (using replace):', profileRoute);
                          // Use replace to prevent going back to status viewer
                          router.replace(profileRoute as any);
                        } catch (error) {
                          console.error('Navigation error after modal close:', error);
                          // Fallback: try push
                          try {
                            router.push(profileRoute as any);
                          } catch (pushError) {
                            console.error('Push also failed:', pushError);
                          }
                        }
                      }, 300); // Increased delay to ensure modal is fully closed
                    });
                  };

                  return (
                    <TouchableOpacity 
                      key={viewer.id} 
                      style={styles.viewerItem}
                      onPress={handleNavigateToProfile}
                      activeOpacity={0.7}
                    >
                      <TouchableOpacity
                        onPress={(e: any) => {
                          e.stopPropagation();
                          handleNavigateToProfile();
                        }}
                        activeOpacity={0.8}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ marginRight: 12 }}
                      >
                        {viewer.user.profile_picture ? (
                          <Image
                            source={{ uri: viewer.user.profile_picture }}
                            style={styles.viewerAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.viewerAvatarPlaceholder}>
                            <Text style={styles.viewerAvatarText}>
                              {viewer.user.full_name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.viewerInfo}>
                        <TouchableOpacity
                          onPress={handleNavigateToProfile}
                          activeOpacity={0.7}
                          style={{ flex: 1 }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={styles.viewerName}>{viewer.user.full_name}</Text>
                            {reactionEmoji && (
                              <Text style={styles.viewerReaction}>{reactionEmoji}</Text>
                            )}
                            {viewer.has_message && (
                              <View style={styles.messageIndicator}>
                                <MessageCircle size={14} color="#fff" />
                              </View>
                            )}
                          </View>
                          <Text style={styles.viewerTime}>{formatViewTime(viewer.viewed_at)}</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity 
                        style={styles.viewerOptions}
                        onPress={(e: any) => {
                          e.stopPropagation();
                          // Could add menu options here later
                        }}
                      >
                        <MoreHorizontal size={20} color="#aaa" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Insights coming soon</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

