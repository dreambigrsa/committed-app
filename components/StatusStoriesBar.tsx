/**
 * StatusStoriesBar Component
 * 
 * Horizontal scrollable bar displaying user status stories
 * Used in both Feed and Messages screens (like Facebook/Messenger)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getStatusFeedForFeed, getStatusFeedForMessenger, getSignedUrlForMedia } from '@/lib/status-queries';
import type { StatusFeedItem } from '@/lib/status-queries';
import { LinearGradient } from 'expo-linear-gradient';

interface StatusStoriesBarProps {
  /**
   * Context: 'feed' for Feed screen, 'messenger' for Messages screen
   * Determines which query to use and user filtering
   */
  context: 'feed' | 'messenger';
  /**
   * Callback when a status is tapped
   * If not provided, opens default status viewer
   */
  onStatusPress?: (statusItem: StatusFeedItem) => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = 112; // Facebook-style card width
const CARD_HEIGHT = 200; // Facebook-style card height
const CARD_MARGIN = 8;
const BUBBLE_SIZE = 64; // For other users' circular bubbles
const BUBBLE_MARGIN = 8;

/**
 * Format time ago helper
 */
function formatTimeAgo(dateString: string): string {
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
}

/**
 * Other User Story Card Component
 * Facebook-style card showing preview of other users' statuses (Feed only)
 */
function OtherUserStoryCard({
  statusItem,
  hasUnviewed,
  onPress,
}: {
  statusItem: StatusFeedItem;
  hasUnviewed: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const status = statusItem.latest_status;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      if (status.media_path) {
        try {
          const url = await getSignedUrlForMedia(status.media_path);
          if (isMounted) {
            setPreviewUrl(url);
          }
        } catch (error) {
          console.error('Error loading other user story preview:', error);
        }
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [status.media_path]);

  const cardStyles = StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
      borderWidth: hasUnviewed ? 2 : 0,
      borderColor: hasUnviewed ? colors.primary : 'transparent',
    },
    cardImage: {
      width: '100%',
      height: '100%',
    },
    gradientOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '40%',
    },
    cardOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 10,
      paddingTop: 12,
    },
    cardTitle: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700' as const,
      marginBottom: 4,
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    cardText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '500' as const,
      textAlign: 'center',
      marginBottom: 4,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    cardTime: {
      color: '#FFFFFF',
      fontSize: 9,
      textAlign: 'center',
      marginTop: 2,
      opacity: 0.8,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    profileBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 3,
      borderColor: hasUnviewed ? colors.primary : colors.background.primary,
      overflow: 'hidden',
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
    textPreviewContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 8,
    },
    textBackgroundWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      // No padding - padding is on individual line backgrounds
    },
    textLineBackground: {
      paddingHorizontal: 6,
      paddingVertical: 4,
      marginBottom: 2,
    },
    textPreviewOverlay: {
      position: 'absolute', // Position absolutely to overlay exactly on background
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      // No padding - padding is on the Text component itself
    },
    stickersPreview: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
    },
    stickerPreview: {
      position: 'absolute',
      width: 24,
      height: 24,
      marginLeft: -12,
      marginTop: -12,
    },
  });

  // Helper functions for text styling
  const getTextStyle = (textStyle: string = 'classic') => {
    const fontSize = textStyle === 'typewriter' ? 10 : textStyle === 'elegant' ? 12 : 11;
    const baseStyle: any = {
      fontSize: fontSize,
      lineHeight: fontSize * 1.2, // Add lineHeight for consistent spacing
      fontWeight: textStyle === 'bold' ? ('700' as const) : textStyle === 'typewriter' ? ('400' as const) : ('600' as const),
      fontStyle: textStyle === 'italic' ? ('italic' as const) : ('normal' as const),
    };

    if (textStyle === 'typewriter') {
      baseStyle.fontFamily = 'monospace';
    } else if (textStyle === 'elegant') {
      baseStyle.fontFamily = 'serif';
    } else if (textStyle === 'neon') {
      baseStyle.fontFamily = 'sans-serif-medium';
    }

    return baseStyle;
  };

  const getTextEffectStyle = (
    textEffect: string = 'default',
    backgroundColor: string = '#1A73E8'
  ) => {
    const styles: any = {};
    
    switch (textEffect) {
      case 'outline-white':
        styles.textShadowColor = '#fff';
        styles.textShadowOffset = { width: -0.5, height: 0.5 };
        styles.textShadowRadius = 1;
        break;
      case 'outline-black':
        styles.textShadowColor = '#000';
        styles.textShadowOffset = { width: -0.5, height: 0.5 };
        styles.textShadowRadius = 1;
        break;
      case 'glow':
        styles.textShadowColor = backgroundColor;
        styles.textShadowOffset = { width: 0, height: 0 };
        styles.textShadowRadius = 8;
        break;
    }
    
    return styles;
  };

  // Get preview image or use gradient background
  const hasMedia = status.media_path && (status.content_type === 'image' || status.content_type === 'video');
  const displayText = status.text_content || '';
  const truncatedText = displayText.length > 30 ? displayText.substring(0, 30) + '...' : displayText;

  return (
    <TouchableOpacity style={{ marginHorizontal: CARD_MARGIN, width: CARD_WIDTH }} onPress={onPress} activeOpacity={0.8}>
      <View style={cardStyles.card}>
        {/* Background - media preview or gradient */}
        {previewUrl ? (
          <Image source={{ uri: previewUrl }} style={cardStyles.cardImage} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={[colors.primary, colors.primary + 'DD', colors.primary + 'AA']}
            style={cardStyles.cardImage}
          />
        )}

        {/* Gradient overlay for text readability */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
          style={cardStyles.gradientOverlay}
        />

        {/* Profile picture badge at top */}
        <View style={cardStyles.profileBadge}>
          {statusItem.user_avatar ? (
            <Image
              source={{ uri: statusItem.user_avatar }}
              style={cardStyles.profileImage}
              contentFit="cover"
            />
          ) : (
            <View style={[cardStyles.profileImage, { backgroundColor: colors.background.primary, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>
                {statusItem.user_name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        {/* Content overlay */}
        <View style={cardStyles.cardOverlay}>
          {/* Title - username */}
          <Text style={cardStyles.cardTitle} numberOfLines={1}>
            {statusItem.user_name || 'User'}
          </Text>
          
          {/* Status text preview */}
          {status.text_content && (
            <Text style={cardStyles.cardText} numberOfLines={2}>
              {truncatedText}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Your Story Card Component
 * Facebook-style card showing preview of user's own status
 */
function YourStoryCard({
  statusItem,
  currentUser,
  onPress,
}: {
  statusItem: StatusFeedItem;
  currentUser: any;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const status = statusItem.latest_status;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [stickerUrls, setStickerUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      // Load media preview
      if (status.media_path) {
        try {
          const url = await getSignedUrlForMedia(status.media_path);
          if (isMounted) {
            setPreviewUrl(url);
          }
        } catch (error) {
          console.error('Error loading your story preview:', error);
        }
      }

      // Load background image for text statuses
      if (status.content_type === 'text' && status.background_image_path) {
        try {
          const url = await getSignedUrlForMedia(status.background_image_path);
          if (isMounted) {
            setBackgroundImageUrl(url);
          }
        } catch (error) {
          console.error('Error loading background image:', error);
        }
      }

      // Load stickers
      if (status.stickers && status.stickers.length > 0) {
        try {
          const stickerUrlMap = new Map<string, string>();
          for (const sticker of status.stickers) {
            if (sticker.sticker_image_url.startsWith('status-media/')) {
              const url = await getSignedUrlForMedia(sticker.sticker_image_url);
              if (url) {
                stickerUrlMap.set(sticker.id, url);
              }
            } else {
              stickerUrlMap.set(sticker.id, sticker.sticker_image_url);
            }
          }
          if (isMounted) {
            setStickerUrls(stickerUrlMap);
          }
        } catch (error) {
          console.error('Error loading stickers:', error);
        }
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [status.media_path, status.background_image_path, status.stickers]);

  const cardStyles = StyleSheet.create({
    yourCard: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    yourCardImage: {
      width: '100%',
      height: '100%',
    },
    gradientOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '40%',
    },
    yourCardOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 10,
      paddingTop: 12,
    },
    cardTitle: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700' as const,
      marginBottom: 4,
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    cardText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '500' as const,
      textAlign: 'center',
      marginBottom: 4,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    cardTime: {
      color: '#FFFFFF',
      fontSize: 9,
      textAlign: 'center',
      marginTop: 2,
      opacity: 0.8,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    profileBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 3,
      borderColor: colors.primary,
      overflow: 'hidden',
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
    textPreviewContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 8,
    },
    textBackgroundWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      // No padding - padding is on individual line backgrounds
    },
    textLineBackground: {
      paddingHorizontal: 6,
      paddingVertical: 4,
      marginBottom: 2,
    },
    textPreviewOverlay: {
      position: 'absolute', // Position absolutely to overlay exactly on background
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      // No padding - padding is on the Text component itself
    },
    stickersPreview: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
    },
    stickerPreview: {
      position: 'absolute',
      width: 24,
      height: 24,
      marginLeft: -12,
      marginTop: -12,
    },
  });

  // Helper functions for text styling
  const getTextStyle = (textStyle: string = 'classic') => {
    const fontSize = textStyle === 'typewriter' ? 10 : textStyle === 'elegant' ? 12 : 11;
    const baseStyle: any = {
      fontSize: fontSize,
      lineHeight: fontSize * 1.2, // Add lineHeight for consistent spacing
      fontWeight: textStyle === 'bold' ? ('700' as const) : textStyle === 'typewriter' ? ('400' as const) : ('600' as const),
      fontStyle: textStyle === 'italic' ? ('italic' as const) : ('normal' as const),
    };

    if (textStyle === 'typewriter') {
      baseStyle.fontFamily = 'monospace';
    } else if (textStyle === 'elegant') {
      baseStyle.fontFamily = 'serif';
    } else if (textStyle === 'neon') {
      baseStyle.fontFamily = 'sans-serif-medium';
    }

    return baseStyle;
  };

  const getTextEffectStyle = (
    textEffect: string = 'default',
    backgroundColor: string = '#1A73E8'
  ) => {
    const styles: any = {};
    
    switch (textEffect) {
      case 'outline-white':
        styles.textShadowColor = '#fff';
        styles.textShadowOffset = { width: -0.5, height: 0.5 };
        styles.textShadowRadius = 1;
        break;
      case 'outline-black':
        styles.textShadowColor = '#000';
        styles.textShadowOffset = { width: -0.5, height: 0.5 };
        styles.textShadowRadius = 1;
        break;
      case 'glow':
        styles.textShadowColor = backgroundColor;
        styles.textShadowOffset = { width: 0, height: 0 };
        styles.textShadowRadius = 8;
        break;
    }
    
    return styles;
  };

  // Get preview image or use gradient background
  const hasMedia = status.media_path && (status.content_type === 'image' || status.content_type === 'video');
  const isTextStatus = status.content_type === 'text';
  const displayText = status.text_content || 'Your Story';
  const truncatedText = displayText.length > 30 ? displayText.substring(0, 30) + '...' : displayText;

  return (
    <TouchableOpacity style={{ marginHorizontal: CARD_MARGIN, width: CARD_WIDTH }} onPress={onPress} activeOpacity={0.8}>
      <View style={cardStyles.yourCard}>
        {/* Background - media preview, background image, or gradient/color */}
        {previewUrl && hasMedia ? (
          <Image source={{ uri: previewUrl }} style={cardStyles.yourCardImage} contentFit="cover" />
        ) : isTextStatus && backgroundImageUrl ? (
          <Image source={{ uri: backgroundImageUrl }} style={cardStyles.yourCardImage} contentFit="cover" />
        ) : isTextStatus && status.background_color ? (
          <View style={[cardStyles.yourCardImage, { backgroundColor: status.background_color }]} />
        ) : (
          <LinearGradient
            colors={[colors.primary, colors.primary + 'DD', colors.primary + 'AA']}
            style={cardStyles.yourCardImage}
          />
        )}

        {/* Text status content with customization */}
        {isTextStatus && status.text_content && (
          <View style={cardStyles.textPreviewContainer}>
            {/* Per-line backgrounds for white-bg/black-bg effects */}
            {(status.text_effect === 'white-bg' || status.text_effect === 'black-bg') && (
              <View 
                style={[cardStyles.textBackgroundWrapper, {
                  alignItems: status.text_alignment === 'left' ? 'flex-start' : 
                             status.text_alignment === 'right' ? 'flex-end' : 'center',
                }]} 
                pointerEvents="none"
              >
                {status.text_content.split('\n').slice(0, 2).map((line, index) => {
                  const trimmedLine = line.trim();
                  if (!trimmedLine) return null;
                  const displayLine = trimmedLine.length > 20 ? trimmedLine.substring(0, 20) + '...' : trimmedLine;
                  
                  // Get text style to match font size exactly
                  const textStyleObj = getTextStyle(status.text_style || 'classic');
                  
                  return (
                    <View
                      key={index}
                      style={[
                        cardStyles.textLineBackground,
                        {
                          backgroundColor: status.text_effect === 'white-bg' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)',
                          borderRadius: 10,
                          marginTop: index > 0 ? -2 : 0,
                          alignSelf: status.text_alignment === 'center' ? 'center' : 
                                    status.text_alignment === 'right' ? 'flex-end' : 'flex-start',
                          // Match padding exactly with actual text
                          paddingHorizontal: 6,
                          paddingVertical: 4,
                        },
                      ]}
                      pointerEvents="none"
                    >
                      {/* Invisible Text for width measurement - MUST match actual text exactly */}
                      <Text
                        style={[
                          textStyleObj, // Use same font style, size, weight, family
                          {
                            textAlign: status.text_alignment || 'center',
                            color: 'transparent',
                            opacity: 0.001, // Nearly invisible
                            lineHeight: textStyleObj.lineHeight, // Use lineHeight from getTextStyle()
                            includeFontPadding: false,
                          },
                        ]}
                        numberOfLines={1}
                        pointerEvents="none"
                      >
                        {displayLine}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
            
            {/* Actual text - MUST align exactly with background */}
            <View style={[cardStyles.textPreviewOverlay, {
              alignItems: status.text_alignment === 'left' ? 'flex-start' : 
                         status.text_alignment === 'right' ? 'flex-end' : 'center',
            }]}>
              <Text
                style={[
                  getTextStyle(status.text_style || 'classic'), // Use SAME getTextStyle() function
                  getTextEffectStyle(status.text_effect || 'default', status.background_color || '#1A73E8'),
                  {
                    textAlign: status.text_alignment || 'center',
                    color: (status.text_effect === 'white-bg' || status.text_effect === 'black-bg')
                      ? (status.text_effect === 'white-bg' ? '#000' : '#fff')
                      : '#fff',
                    // CRITICAL: Use fontSize from getTextStyle() - don't override it
                    // fontSize comes from getTextStyle() - don't set fontSize: 10 here
                    paddingHorizontal: 6, // Match background View padding
                    paddingVertical: 4, // Match background View padding
                    maxWidth: '90%',
                    includeFontPadding: false,
                  },
                ]}
                numberOfLines={2}
              >
                {truncatedText}
              </Text>
            </View>

            {/* Stickers (small preview) */}
            {status.stickers && status.stickers.length > 0 && stickerUrls.size > 0 && (
              <View style={cardStyles.stickersPreview} pointerEvents="none">
                {status.stickers.slice(0, 2).map((sticker) => {
                  const stickerUrl = stickerUrls.get(sticker.id);
                  if (!stickerUrl) return null;
                  
                  return (
                    <Image
                      key={sticker.id}
                      source={{ uri: stickerUrl }}
                      style={[cardStyles.stickerPreview, {
                        left: `${Math.min(sticker.position_x * 100, 70)}%`,
                        top: `${Math.min(sticker.position_y * 100, 60)}%`,
                      }]}
                      contentFit="contain"
                    />
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Gradient overlay for text readability (only if not text status with background) */}
        {(!isTextStatus || (!status.background_color && !backgroundImageUrl)) && (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
            style={cardStyles.gradientOverlay}
          />
        )}

        {/* Profile picture badge at top */}
        <View style={cardStyles.profileBadge}>
          {statusItem.user_avatar || currentUser?.profilePicture ? (
            <Image
              source={{ uri: statusItem.user_avatar || currentUser?.profilePicture }}
              style={cardStyles.profileImage}
              contentFit="cover"
            />
          ) : (
            <View style={[cardStyles.profileImage, { backgroundColor: colors.background.primary, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>
                {currentUser?.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
        </View>

        {/* Content overlay */}
        <View style={cardStyles.yourCardOverlay}>
          {/* Title - username or app name */}
          <Text style={cardStyles.cardTitle} numberOfLines={1}>
            {statusItem.user_name || 'Committed'}
          </Text>
          {/* Time elapsed */}
          <Text style={cardStyles.cardTime}>
            {formatTimeAgo(status.created_at)}
          </Text>
          
          {/* Status text preview (if not text status with customization) */}
          {!isTextStatus && status.text_content && (
            <Text style={cardStyles.cardText} numberOfLines={2}>
              {truncatedText}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Story Preview Bubble Component
 * Shows a preview of the story content (like Facebook)
 */
function StoryPreviewBubble({
  mediaPath,
  contentType,
  profilePicture,
  userName,
}: {
  mediaPath: string;
  contentType: 'image' | 'video';
  profilePicture: string | null;
  userName: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { colors } = useTheme();

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      try {
        const url = await getSignedUrlForMedia(mediaPath);
        if (isMounted) {
          setPreviewUrl(url);
        }
      } catch (error) {
        console.error('Error loading story preview:', error);
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [mediaPath]);

  const styles = StyleSheet.create({
    previewContainer: {
      width: '100%',
      height: '100%',
      borderRadius: (BUBBLE_SIZE - 4) / 2,
      overflow: 'hidden',
      position: 'relative',
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    profileOverlay: {
      position: 'absolute',
      bottom: 2,
      left: 2,
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.background.primary,
      overflow: 'hidden',
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
    profilePlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profilePlaceholderText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: colors.text.white,
    },
  });

  return (
    <View style={styles.previewContainer}>
      {previewUrl ? (
        <>
          <Image
            source={{ uri: previewUrl }}
            style={styles.previewImage}
            contentFit="cover"
          />
          {/* Small profile picture overlay in bottom-left corner */}
          <View style={styles.profileOverlay}>
            {profilePicture ? (
              <Image
                source={{ uri: profilePicture }}
                style={styles.profileImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profilePlaceholderText}>
                  {userName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
        </>
      ) : (
        // Fallback to profile picture while loading
        <>
          {profilePicture ? (
            <Image
              source={{ uri: profilePicture }}
              style={styles.previewImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profilePlaceholderText}>
                {userName?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function StatusStoriesBar({ context, onStatusPress }: StatusStoriesBarProps) {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const [statusFeed, setStatusFeed] = useState<StatusFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 12,
      paddingHorizontal: 4,
      backgroundColor: colors.background.primary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.light,
    },
    scrollView: {
      paddingHorizontal: 4,
    },
    bubbleContainer: {
      alignItems: 'center',
      marginHorizontal: BUBBLE_MARGIN,
      width: BUBBLE_SIZE + 16,
    },
    avatarContainer: {
      width: BUBBLE_SIZE,
      height: BUBBLE_SIZE,
      borderRadius: BUBBLE_SIZE / 2,
      borderWidth: 2,
      borderColor: colors.border.light,
      padding: 2,
      marginBottom: 4,
    },
    createButton: {
      borderColor: colors.border.light,
      borderWidth: 2,
    },
    plusIcon: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.background.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plusIconText: {
      color: colors.text.white,
      fontSize: 16,
      fontWeight: '700' as const,
      lineHeight: 18,
    },
    unreadRing: {
      borderWidth: 3,
      borderColor: '#31A24C', // Green ring for unviewed status (Messenger style)
    },
    viewedRing: {
      borderWidth: 3,
      borderColor: '#8E8E93', // Gray ring for viewed status (Messenger style)
    },
    avatar: {
      width: '100%',
      height: '100%',
      borderRadius: (BUBBLE_SIZE - 4) / 2,
    },
    avatarPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: (BUBBLE_SIZE - 4) / 2,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarPlaceholderText: {
      fontSize: BUBBLE_SIZE / 2.5,
      fontWeight: '700' as const,
      color: colors.text.white,
    },
    name: {
      fontSize: 11,
      color: colors.text.primary,
      textAlign: 'center',
      maxWidth: BUBBLE_SIZE + 16,
      marginTop: 2,
    },
    yourStoryText: {
      fontWeight: '600' as const,
      color: colors.primary,
    },
    loadingContainer: {
      height: BUBBLE_SIZE + 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      height: BUBBLE_SIZE + 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    // Card-based styles (for Create Story and Your Story)
    cardContainer: {
      marginHorizontal: CARD_MARGIN,
      width: CARD_WIDTH,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.background.secondary,
    },
    createCard: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    createCardImage: {
      width: '100%',
      height: '100%',
    },
    createCardOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '40%',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    createCardPlus: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -24 }, { translateY: -24 }],
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: colors.background.primary,
    },
    createCardPlusText: {
      color: colors.text.white,
      fontSize: 28,
      fontWeight: '700' as const,
      lineHeight: 32,
    },
    createCardLabel: {
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600' as const,
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
  });

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      console.log(`🔄 [StatusStoriesBar] useEffect triggered for context: ${context}`);
      setLoading(true);
      try {
        const feed = context === 'feed' 
          ? await getStatusFeedForFeed()
          : await getStatusFeedForMessenger();
        
        console.log(`✅ [StatusStoriesBar] Feed loaded in useEffect:`, {
          context,
          feedLength: feed?.length || 0,
          feed: feed,
        });
        
        if (isMounted) {
          setStatusFeed(Array.isArray(feed) ? feed : []);
        }
      } catch (error) {
        console.error('❌ [StatusStoriesBar] Error loading status feed in useEffect:', error);
        if (isMounted) {
          setStatusFeed([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    
    // Refresh every 30 seconds to check for new statuses
    const interval = setInterval(() => {
      if (isMounted) {
        loadData();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [context]);

  // Keep loadStatusFeed for manual refreshes (like after viewing a status)
  const loadStatusFeed = async () => {
    console.log(`🔄 [StatusStoriesBar] Manual loadStatusFeed called for context: ${context}`);
    setLoading(true);
    try {
      const feed = context === 'feed' 
        ? await getStatusFeedForFeed()
        : await getStatusFeedForMessenger();
      
      console.log(`✅ [StatusStoriesBar] Feed loaded manually:`, {
        context,
        feedLength: feed?.length || 0,
        feed: feed,
      });
      
      setStatusFeed(Array.isArray(feed) ? feed : []);
    } catch (error) {
      console.error('❌ [StatusStoriesBar] Error loading status feed manually:', error);
      setStatusFeed([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusPress = (statusItem: StatusFeedItem) => {
    if (onStatusPress) {
      onStatusPress(statusItem);
      return;
    }

    // Default behavior: Open status viewer
    router.push(`/status/${statusItem.user_id}` as any);
    
    // Reload feed after viewing
    setTimeout(() => {
      loadStatusFeed();
    }, 1000);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Loading stories...</Text>
        </View>
      </View>
    );
  }

  // Separate current user's status from others
  const ownStatusInFeed = statusFeed.find((item: StatusFeedItem) => item.user_id === currentUser?.id);
  const otherUsersStatuses = statusFeed.filter((item: StatusFeedItem) => item.user_id !== currentUser?.id);

  console.log(`📊 [StatusStoriesBar] Status breakdown:`, {
    totalStatusFeed: statusFeed.length,
    ownStatusInFeed: !!ownStatusInFeed,
    otherUsersCount: otherUsersStatuses.length,
    currentUserId: currentUser?.id,
  });

  // Show other users' statuses (or all if none from other users)
  const statusesToShow = otherUsersStatuses;

  console.log(`🎨 [StatusStoriesBar] Rendering bar:`, {
    totalStatusFeed: statusFeed.length,
    otherUsersCount: otherUsersStatuses.length,
    currentUserId: currentUser?.id,
    willShowBubbles: otherUsersStatuses.length > 0,
  });

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollView}
        bounces={false}
      >
        {/* Create Story - Card in feed, circular bubble in messenger */}
        {context === 'feed' ? (
          <TouchableOpacity
            style={styles.cardContainer}
            onPress={() => router.push('/status/create' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.createCard}>
              {/* Background thumbnail - use profile picture or gradient */}
              {currentUser?.profilePicture ? (
                <Image
                  source={{ uri: currentUser.profilePicture }}
                  style={styles.createCardImage}
                  contentFit="cover"
                />
              ) : (
                <LinearGradient
                  colors={[colors.primary, colors.primary + 'DD']}
                  style={styles.createCardImage}
                />
              )}
              
              {/* Dark overlay for better text readability */}
              <View style={styles.createCardOverlay} />
              
              {/* Large Plus Sign - Centered */}
              <View style={styles.createCardPlus}>
                <Text style={styles.createCardPlusText}>+</Text>
              </View>
              
              {/* "Create story" label at bottom */}
              <Text style={styles.createCardLabel}>Create story</Text>
            </View>
          </TouchableOpacity>
        ) : (
          // Messenger: Circular bubble with plus icon
          <TouchableOpacity
            style={styles.bubbleContainer}
            onPress={() => router.push('/status/create' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.avatarContainer, { borderWidth: 2, borderColor: colors.border.light }]}>
              {currentUser?.profilePicture ? (
                <Image
                  source={{ uri: currentUser.profilePicture }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>
                    {currentUser?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              {/* Plus icon overlay */}
              <View style={styles.plusIcon}>
                <Text style={styles.plusIconText}>+</Text>
              </View>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              Your story
            </Text>
          </TouchableOpacity>
        )}

        {/* Your Story - Shows as card in feed, circular bubble in messenger */}
        {ownStatusInFeed && (
          context === 'feed' ? (
            <YourStoryCard
              statusItem={ownStatusInFeed}
              currentUser={currentUser}
              onPress={() => router.push(`/status/${currentUser?.id}` as any)}
            />
          ) : (
            // Messenger: Show as circular bubble
            (() => {
              const status = ownStatusInFeed.latest_status;
              const hasMedia = status?.media_path && (status.content_type === 'image' || status.content_type === 'video');
              const hasStatus = !!status;
              return (
                <TouchableOpacity
                  key={ownStatusInFeed.user_id}
                  style={styles.bubbleContainer}
                  onPress={() => router.push(`/status/${currentUser?.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.avatarContainer,
                      // Your own status is always considered viewed, so gray ring
                      hasStatus && styles.viewedRing,
                      !hasStatus && { borderWidth: 0 },
                    ]}
                  >
                    {hasMedia ? (
                      <StoryPreviewBubble
                        mediaPath={status.media_path!}
                        contentType={status.content_type as 'image' | 'video'}
                        profilePicture={ownStatusInFeed.user_avatar || currentUser?.profilePicture || null}
                        userName={ownStatusInFeed.user_name || currentUser?.fullName || ''}
                      />
                    ) : (
                      <>
                        {ownStatusInFeed.user_avatar || currentUser?.profilePicture ? (
                          <Image
                            source={{ uri: ownStatusInFeed.user_avatar || currentUser?.profilePicture }}
                            style={styles.avatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarPlaceholderText}>
                              {currentUser?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                  <Text
                    style={styles.name}
                    numberOfLines={1}
                  >
                    Your story
                  </Text>
                </TouchableOpacity>
              );
            })()
          )
        )}

        {/* Other Users' Statuses */}
        {statusesToShow.map((item: StatusFeedItem) => {
          const hasUnviewed = item.has_unviewed;
          const status = item.latest_status;

          // In Feed: Use card style for all statuses (like Facebook)
          // In Messenger: Use circular bubbles
          if (context === 'feed') {
            return (
              <React.Fragment key={item.user_id}>
                <OtherUserStoryCard
                  statusItem={item}
                  hasUnviewed={hasUnviewed}
                  onPress={() => handleStatusPress(item)}
                />
              </React.Fragment>
            );
          } else {
            // Messenger: Use circular bubbles
            const hasMedia = status?.media_path && (status.content_type === 'image' || status.content_type === 'video');
            const hasStatus = !!status; // Check if user has a status
            return (
              <TouchableOpacity
                key={item.user_id}
                style={styles.bubbleContainer}
                onPress={() => handleStatusPress(item)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.avatarContainer,
                    hasStatus && hasUnviewed && styles.unreadRing, // Green ring for unviewed
                    hasStatus && !hasUnviewed && styles.viewedRing, // Gray ring for viewed
                    !hasStatus && { borderWidth: 0 }, // No ring if no status
                  ]}
                >
                  {/* Show story preview (media) if available, otherwise show profile picture */}
                  {hasMedia ? (
                    <StoryPreviewBubble
                      mediaPath={status.media_path!}
                      contentType={status.content_type as 'image' | 'video'}
                      profilePicture={item.user_avatar || null}
                      userName={item.user_name || ''}
                    />
                  ) : (
                    <>
                      {item.user_avatar ? (
                        <Image
                          source={{ uri: item.user_avatar }}
                          style={styles.avatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarPlaceholderText}>
                            {item.user_name?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
                <Text
                  style={styles.name}
                  numberOfLines={1}
                >
                  {item.user_name}
                </Text>
              </TouchableOpacity>
            );
          }
        })}
      </ScrollView>
    </View>
  );
}

