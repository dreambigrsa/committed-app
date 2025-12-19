import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  TextInput,
  Modal,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Plus, Film, MoreVertical, Edit2, Trash2, X, UserPlus, Flag, Smile, Image as ImageIcon } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import ReportContentModal from '@/components/ReportContentModal';
import { Reel, Advertisement, Sticker } from '@/types';
import StickerPicker from '@/components/StickerPicker';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink } from 'lucide-react-native';
import StatusIndicator from '@/components/StatusIndicator';

const { width, height } = Dimensions.get('window');

export default function ReelsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, reels, toggleReelLike, editReel, deleteReel, shareReel, adminDeleteReel, adminRejectReel, followUser, unfollowUser, isFollowing: checkIsFollowing, addReelComment, getReelComments, editReelComment, deleteReelComment, toggleReelCommentLike, reportContent, getActiveAds, getSmartAds, recordAdImpression, recordAdClick, getUserStatus, userStatuses } = useApp();
  const { colors } = useTheme();
  
  // Early return check - must be before all hooks
  if (!currentUser) {
    return null;
  }
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentReelId, setCurrentReelId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showReelMenu, setShowReelMenu] = useState<string | null>(null);
  const [editingReel, setEditingReel] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState<string>('');
  const [lastTap, setLastTap] = useState<{ time: number; reelId: string } | null>(null);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [isScreenFocused, setIsScreenFocused] = useState<boolean>(true);
  const [reportingReel, setReportingReel] = useState<{ id: string; userId: string } | null>(null);
  const [smartAds, setSmartAds] = useState<Advertisement[]>([]);
  const [activeVideoAd, setActiveVideoAd] = useState<{ reelId: string; ad: Advertisement; canSkip: boolean; skipDelay: number } | null>(null);
  const [activeBannerCardAd, setActiveBannerCardAd] = useState<{ reelId: string; ad: Advertisement; canSkip: boolean; skipDelay: number } | null>(null);
  const [videoAdPlaybackTime, setVideoAdPlaybackTime] = useState<number>(0);
  const [skipCountdown, setSkipCountdown] = useState<number>(0);
  const [bannerCardSkipCountdown, setBannerCardSkipCountdown] = useState<number>(0);
  const videoRefs = useRef<{ [key: string]: Video | null }>({});
  const adVideoRefs = useRef<{ [key: string]: Video | null }>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const skipButtonOpacity = useRef(new Animated.Value(0)).current;
  const bannerCardAdSlideAnim = useRef(new Animated.Value(200)).current; // Start off-screen
  const bannerCardSkipButtonOpacity = useRef(new Animated.Value(0)).current;
  const recordedImpressions = useRef<Set<string>>(new Set());
  const failedAdImages = useRef<Set<string>>(new Set());
  const skipCountdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const bannerCardSkipCountdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const bannerCardAutoDismissTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Configurable skip delay (5-15 seconds, default 15)
  const SKIP_DELAY_SECONDS = 15;
  const BANNER_CARD_AUTO_DISMISS_SECONDS = 20; // Auto-dismiss after 20 seconds if not interacted

  // Reset recorded impressions when ads change
  useEffect(() => {
    recordedImpressions.current.clear();
  }, [smartAds]);

  // Calculate tab bar height: base height (64) + safe area bottom inset
  const tabBarHeight = 64 + insets.bottom;
  // Add extra padding for the overlay to ensure content is visible above tab bar
  const overlayBottomPadding = tabBarHeight + 16;

  const styles = useMemo(() => createStyles(colors, overlayBottomPadding), [colors, overlayBottomPadding]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Load advertisements for reels
  useEffect(() => {
    const loadSmartAds = async () => {
      try {
        const ads = await getSmartAds('reels', [], 10);
        setSmartAds(ads);
      } catch (error) {
        console.error('Error loading smart ads for reels:', error);
        // Fallback to regular ads
        const fallbackAds = getActiveAds('reels');
        setSmartAds(fallbackAds.slice(0, 10));
      }
    };
    if (currentUser) {
      loadSmartAds();
    }
  }, [getSmartAds, getActiveAds, currentUser]);

  // Reload ads periodically to ensure rotation
  useEffect(() => {
    const interval = setInterval(async () => {
      if (currentUser && smartAds.length > 0) {
        try {
          const ads = await getSmartAds('reels', [], 10);
          setSmartAds(ads);
        } catch (error) {
          console.error('Error refreshing smart ads for reels:', error);
        }
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [currentUser, getSmartAds, smartAds.length]);

  // Handle ad display when scrolling to a reel with an ad
  useEffect(() => {
    if (reels.length > 0 && currentIndex >= 0 && currentReelId) {
      const reel = reels[currentIndex];
      if (reel) {
        // Smart ad logic: Show ads more frequently when there are fewer reels
        // - If 1-3 reels: Show ad after first reel (index 1)
        // - If 4-10 reels: Show ad every 3 reels (after 2nd, 5th, 8th)
        // - If 11+ reels: Show ad every 5 reels (after 4th, 9th, 14th, etc.)
        let shouldShowAdAfter = false;
        let adIndex = 0;
        
        if (smartAds.length > 0) {
          if (reels.length <= 3) {
            // For 1-3 reels: Show ad after first reel
            shouldShowAdAfter = currentIndex === 1;
            adIndex = 0;
          } else if (reels.length <= 10) {
            // For 4-10 reels: Show ad every 3 reels (after 2nd, 5th, 8th)
            shouldShowAdAfter = (currentIndex + 1) % 3 === 0 && currentIndex > 0;
            if (shouldShowAdAfter) {
              adIndex = Math.floor((currentIndex + 1) / 3 - 1) % smartAds.length;
            }
          } else {
            // For 11+ reels: Show ad every 5 reels (after 4th, 9th, 14th, etc.)
            shouldShowAdAfter = (currentIndex + 1) % 5 === 0;
            if (shouldShowAdAfter) {
              adIndex = Math.floor((currentIndex + 1) / 5 - 1) % smartAds.length;
            }
          }
        }
        
        if (shouldShowAdAfter) {
          const ad = smartAds[adIndex];
          
          if (ad) {
            // Video ads: Full overlay, pause video
            if (ad.type === 'video' && (!activeVideoAd || activeVideoAd.reelId !== reel.id)) {
              // Pause the reel video
              const reelVideoRef = videoRefs.current[reel.id];
              if (reelVideoRef) {
                reelVideoRef.pauseAsync().catch(() => {});
              }
              // Show video ad overlay
              setActiveVideoAd({ 
                reelId: reel.id, 
                ad, 
                canSkip: false,
                skipDelay: SKIP_DELAY_SECONDS 
              });
              setVideoAdPlaybackTime(0);
              setSkipCountdown(SKIP_DELAY_SECONDS);
              skipButtonOpacity.setValue(0);
            }
            // Banner/Card ads: Bottom overlay, video continues
            else if ((ad.type === 'banner' || ad.type === 'card') && 
                     (!activeBannerCardAd || activeBannerCardAd.reelId !== reel.id)) {
              // Don't pause the video - it continues playing
              // Show banner/card ad overlay at bottom
              setActiveBannerCardAd({ 
                reelId: reel.id, 
                ad, 
                canSkip: false,
                skipDelay: SKIP_DELAY_SECONDS 
              });
              setBannerCardSkipCountdown(SKIP_DELAY_SECONDS);
              // Reset skip button opacity (button is always visible now, but we keep this for consistency)
              bannerCardSkipButtonOpacity.setValue(1);
              
              // Slide up animation
              Animated.spring(bannerCardAdSlideAnim, {
                toValue: 0,
                damping: 15,
                stiffness: 100,
                useNativeDriver: true,
              }).start();
              
              // Auto-dismiss after 15 seconds
              if (bannerCardAutoDismissTimeout.current) {
                clearTimeout(bannerCardAutoDismissTimeout.current);
              }
              bannerCardAutoDismissTimeout.current = setTimeout(() => {
                handleDismissBannerCardAd();
              }, BANNER_CARD_AUTO_DISMISS_SECONDS * 1000);
            }
          }
        } else {
          // No ad for this reel, dismiss any active banner/card ads
          if (activeBannerCardAd && activeBannerCardAd.reelId === reel.id) {
            handleDismissBannerCardAd();
          }
        }
      }
    }
  }, [currentIndex, currentReelId, reels, smartAds]);

  // Stop all videos when component unmounts or loses focus
  useFocusEffect(
    React.useCallback(() => {
      // Screen is focused
      setIsScreenFocused(true);
      
      // Play current video when screen gains focus
      if (currentReelId && videoRefs.current[currentReelId]) {
        setTimeout(() => {
          videoRefs.current[currentReelId]?.playAsync().catch(() => {});
        }, 100);
      }
      
      return () => {
        // Screen lost focus - stop all videos
        setIsScreenFocused(false);
        
        // Stop all videos when leaving the screen - use stopAsync to fully stop playback
        Object.keys(videoRefs.current).forEach((reelId) => {
          const video = videoRefs.current[reelId];
          if (video) {
            video.stopAsync().catch(() => {});
            video.pauseAsync().catch(() => {});
          }
        });
      };
    }, [currentReelId])
  );

  useEffect(() => {
    // Initialize: play first video if available
    if (reels.length > 0 && !currentReelId) {
      const firstReelId = reels[0]?.id;
      if (firstReelId) {
        setCurrentReelId(firstReelId);
        setCurrentIndex(0);
        // Wait a bit for the ref to be set
        setTimeout(() => {
          if (videoRefs.current[firstReelId]) {
            videoRefs.current[firstReelId]?.playAsync().catch(() => {});
          }
        }, 100);
      }
    }
    
    return () => {
      // Cleanup: stop all videos on unmount
      Object.keys(videoRefs.current).forEach((reelId) => {
        const video = videoRefs.current[reelId];
        if (video) {
          video.stopAsync().catch(() => {});
          video.pauseAsync().catch(() => {});
        }
      });
    };
  }, [reels.length]);

  // Cleanup all intervals and timeouts on unmount
  useEffect(() => {
    return () => {
      if (skipCountdownInterval.current) {
        clearInterval(skipCountdownInterval.current);
        skipCountdownInterval.current = null;
      }
      if (bannerCardSkipCountdownInterval.current) {
        clearInterval(bannerCardSkipCountdownInterval.current);
        bannerCardSkipCountdownInterval.current = null;
      }
      if (bannerCardAutoDismissTimeout.current) {
        clearTimeout(bannerCardAutoDismissTimeout.current);
        bannerCardAutoDismissTimeout.current = null;
      }
    };
  }, []);
  
  // Ensure only the current reel is playing (only if screen is focused)
  useEffect(() => {
    if (!isScreenFocused) {
      // Screen is not focused, pause all videos
      Object.keys(videoRefs.current).forEach((reelId) => {
        const video = videoRefs.current[reelId];
        if (video) {
          video.stopAsync().catch(() => {});
          video.pauseAsync().catch(() => {});
        }
      });
      return;
    }

    Object.keys(videoRefs.current).forEach((reelId) => {
      const video = videoRefs.current[reelId];
      if (video) {
        if (reelId === currentReelId) {
          // This is the current reel, ensure it's playing (only if screen is focused)
          video.playAsync().catch(() => {});
        } else {
          // This is not the current reel, ensure it's paused
          video.pauseAsync().catch(() => {});
        }
      }
    });
  }, [currentReelId, isScreenFocused]);

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / height);
    
    if (index !== currentIndex && index >= 0 && index < reels.length) {
      const newReelId = reels[index]?.id;
      
      // Pause all videos first
      Object.keys(videoRefs.current).forEach((reelId) => {
        const video = videoRefs.current[reelId];
        if (video && reelId !== newReelId) {
          video.pauseAsync().catch(() => {});
        }
      });
      
      // Play the current video
      if (newReelId && videoRefs.current[newReelId]) {
        videoRefs.current[newReelId]?.playAsync().catch(() => {});
      }
      
      setCurrentIndex(index);
      setCurrentReelId(newReelId || null);
    }
  };

  const handleMomentumScrollEnd = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / height);
    
    // Ensure we snap to the exact position
    if (index >= 0 && index < reels.length) {
      const targetOffset = index * height;
      const currentOffset = event.nativeEvent.contentOffset.y;
      
      // If we're not perfectly aligned, snap to the correct position
      if (Math.abs(currentOffset - targetOffset) > 1) {
        scrollViewRef.current?.scrollTo({
          y: targetOffset,
          animated: true,
        });
      }
      
      const newReelId = reels[index]?.id;
      
      // Pause all videos
      Object.keys(videoRefs.current).forEach((reelId) => {
        const video = videoRefs.current[reelId];
        if (video && reelId !== newReelId) {
          video.pauseAsync().catch(() => {});
        }
      });
      
      // Play the current video
      if (newReelId && videoRefs.current[newReelId]) {
        videoRefs.current[newReelId]?.playAsync().catch(() => {});
      }
      
      setCurrentIndex(index);
      setCurrentReelId(newReelId || null);
    }
  };

  const handleDeleteReel = async (reelId: string) => {
    Alert.alert(
      'Delete Reel',
      'Are you sure you want to delete this reel?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteReel(reelId);
            if (success) {
              Alert.alert('Success', 'Reel deleted successfully');
            } else {
              Alert.alert('Error', 'Failed to delete reel');
            }
          },
        },
      ]
    );
    setShowReelMenu(null);
  };

  const handleEditReel = (reel: Reel) => {
    setEditingReel(reel.id);
    setEditCaption(reel.caption || '');
    setShowReelMenu(null);
  };

  const handleSaveEdit = async (reelId: string) => {
    const success = await editReel(reelId, editCaption);
    if (success) {
      setEditingReel(null);
      setEditCaption('');
      Alert.alert('Success', 'Reel updated successfully');
    } else {
      Alert.alert('Error', 'Failed to update reel');
    }
  };

  const handleAdminDeleteReel = async (reelId: string) => {
    Alert.alert(
      'Delete Reel (Admin)',
      'Are you sure you want to delete this reel?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await adminDeleteReel(reelId);
            if (success) {
              Alert.alert('Success', 'Reel deleted successfully');
            } else {
              Alert.alert('Error', 'Failed to delete reel');
            }
          },
        },
      ]
    );
    setShowReelMenu(null);
  };

  const handleAdminRejectReel = async (reelId: string) => {
    Alert.alert(
      'Reject Reel (Admin)',
      'Are you sure you want to reject this reel?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            const success = await adminRejectReel(reelId, 'Rejected by admin');
            if (success) {
              Alert.alert('Success', 'Reel rejected successfully');
            } else {
              Alert.alert('Error', 'Failed to reject reel');
            }
          },
        },
      ]
    );
    setShowReelMenu(null);
  };

  const handleVideoPress = (reelId: string) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (lastTap && lastTap.reelId === reelId && (now - lastTap.time) < DOUBLE_TAP_DELAY) {
      // Double tap detected - toggle like
      toggleReelLike(reelId);
      setLastTap(null);
    } else {
      // Single tap - pause/play video
      const video = videoRefs.current[reelId];
      if (video) {
        video.getStatusAsync().then((status: any) => {
          if (status.isLoaded) {
            if (status.isPlaying) {
              video.pauseAsync();
            } else {
              video.playAsync();
            }
          }
        });
      }
      setLastTap({ time: now, reelId });
      setTimeout(() => setLastTap(null), DOUBLE_TAP_DELAY);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!currentUser) return;
    
    try {
      const following = checkIsFollowing(userId);
    if (following) {
      await unfollowUser(userId);
    } else {
      await followUser(userId);
      }
      // AppContext handles state updates and errors gracefully
    } catch (error: any) {
      console.error('Follow/unfollow error:', error?.message || error?.code || JSON.stringify(error));
      // Only show alert for unexpected errors (not duplicate/unique constraint errors)
      if (error?.code !== '23505' && !error?.message?.includes('duplicate') && !error?.message?.includes('unique')) {
        Alert.alert('Error', error?.message || 'Failed to update follow status');
      }
    }
  };

  const handleAdPress = async (ad: Advertisement) => {
    await recordAdClick(ad.id);
    if (ad.linkUrl) {
      await WebBrowser.openBrowserAsync(ad.linkUrl);
    }
  };

  const handleSkipAd = () => {
    if (activeVideoAd && activeVideoAd.canSkip) {
      // Clear countdown interval
      if (skipCountdownInterval.current) {
        clearInterval(skipCountdownInterval.current);
        skipCountdownInterval.current = null;
      }
      
      // Pause ad video
      const adVideoRef = adVideoRefs.current[activeVideoAd.ad.id];
      if (adVideoRef) {
        adVideoRef.pauseAsync().catch(() => {});
      }
      // Resume reel video
      const reelVideoRef = videoRefs.current[activeVideoAd.reelId];
      if (reelVideoRef) {
        reelVideoRef.playAsync().catch(() => {});
      }
      setActiveVideoAd(null);
      setVideoAdPlaybackTime(0);
      setSkipCountdown(0);
    }
  };

  const handleVideoAdEnd = () => {
    if (activeVideoAd) {
      // Clear countdown interval
      if (skipCountdownInterval.current) {
        clearInterval(skipCountdownInterval.current);
        skipCountdownInterval.current = null;
      }
      
      // Resume reel video when ad ends
      const reelVideoRef = videoRefs.current[activeVideoAd.reelId];
      if (reelVideoRef) {
        reelVideoRef.playAsync().catch(() => {});
      }
      setActiveVideoAd(null);
      setVideoAdPlaybackTime(0);
      setSkipCountdown(0);
    }
  };

  const handleDismissBannerCardAd = () => {
    if (activeBannerCardAd) {
      // Clear intervals and timeouts
      if (bannerCardSkipCountdownInterval.current) {
        clearInterval(bannerCardSkipCountdownInterval.current);
        bannerCardSkipCountdownInterval.current = null;
      }
      if (bannerCardAutoDismissTimeout.current) {
        clearTimeout(bannerCardAutoDismissTimeout.current);
        bannerCardAutoDismissTimeout.current = null;
      }
      
      // Slide down animation
      Animated.timing(bannerCardAdSlideAnim, {
        toValue: 200,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setActiveBannerCardAd(null);
        setBannerCardSkipCountdown(0);
        bannerCardAdSlideAnim.setValue(200); // Reset for next time
      });
    }
  };

  const handleSkipBannerCardAd = () => {
    if (activeBannerCardAd && activeBannerCardAd.canSkip) {
      handleDismissBannerCardAd();
    }
  };

  // Start countdown timer when video ad is shown
  useEffect(() => {
    if (activeVideoAd && !activeVideoAd.canSkip) {
      // Reset countdown
      setSkipCountdown(activeVideoAd.skipDelay);
      
      // Start countdown interval
      skipCountdownInterval.current = setInterval(() => {
        setSkipCountdown((prev: number) => {
          if (prev <= 1) {
            // Countdown finished, enable skip
            if (skipCountdownInterval.current) {
              clearInterval(skipCountdownInterval.current);
              skipCountdownInterval.current = null;
            }
            setActiveVideoAd((prevAd: any) => 
              prevAd ? { ...prevAd, canSkip: true } : null
            );
            // Fade in skip button
            Animated.timing(skipButtonOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (skipCountdownInterval.current) {
          clearInterval(skipCountdownInterval.current);
          skipCountdownInterval.current = null;
        }
      };
    }
  }, [activeVideoAd?.reelId, activeVideoAd?.ad.id]);

  // Start countdown timer when banner/card ad is shown
  useEffect(() => {
    // Clear any existing interval first
    if (bannerCardSkipCountdownInterval.current) {
      clearInterval(bannerCardSkipCountdownInterval.current);
      bannerCardSkipCountdownInterval.current = null;
    }

    if (activeBannerCardAd && !activeBannerCardAd.canSkip) {
      // Reset countdown when ad is shown
      setBannerCardSkipCountdown(activeBannerCardAd.skipDelay);
      
      // Start countdown interval immediately
      bannerCardSkipCountdownInterval.current = setInterval(() => {
        setBannerCardSkipCountdown((prev: number) => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            // Countdown finished, enable skip
            if (bannerCardSkipCountdownInterval.current) {
              clearInterval(bannerCardSkipCountdownInterval.current);
              bannerCardSkipCountdownInterval.current = null;
            }
            setActiveBannerCardAd((prevAd: any) => 
              prevAd ? { ...prevAd, canSkip: true } : null
            );
            return 0;
          }
          return newValue;
        });
      }, 1000);
      
      return () => {
        if (bannerCardSkipCountdownInterval.current) {
          clearInterval(bannerCardSkipCountdownInterval.current);
          bannerCardSkipCountdownInterval.current = null;
        }
      };
    } else if (!activeBannerCardAd) {
      // Clear countdown when ad is dismissed
      setBannerCardSkipCountdown(0);
    }
  }, [activeBannerCardAd?.reelId, activeBannerCardAd?.ad.id, activeBannerCardAd?.canSkip]);

  // Render different ad types
  const renderBannerAd = (ad: Advertisement) => {
    // Prevent duplicate impressions
    if (!recordedImpressions.current.has(ad.id)) {
      recordAdImpression(ad.id);
      recordedImpressions.current.add(ad.id);
    }
    return (
      <View key={`ad-banner-${ad.id}`} style={styles.bannerAdContainer}>
        <TouchableOpacity
          style={styles.bannerAd}
          onPress={() => handleAdPress(ad)}
          activeOpacity={0.9}
        >
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>Sponsored</Text>
          </View>
          {!failedAdImages.current.has(ad.id) ? (
            <Image 
              source={{ uri: ad.imageUrl }} 
              style={styles.bannerAdImage} 
              contentFit="cover"
              onError={() => {
                failedAdImages.current.add(ad.id);
                console.warn('Failed to load banner ad image:', ad.id);
              }}
            />
          ) : (
            <View style={[styles.bannerAdImage, { backgroundColor: colors.background.secondary, justifyContent: 'center', alignItems: 'center' }]}>
              <ImageIcon size={32} color={colors.text.tertiary} />
            </View>
          )}
          <View style={styles.bannerAdContent}>
            <Text style={styles.bannerAdTitle}>{ad.title}</Text>
            {ad.linkUrl && (
              <View style={styles.bannerAdLinkButton}>
                <Text style={styles.bannerAdLinkText}>Learn More</Text>
                <ExternalLink size={14} color={colors.primary} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCardAd = (ad: Advertisement) => {
    // Prevent duplicate impressions
    if (!recordedImpressions.current.has(ad.id)) {
      recordAdImpression(ad.id);
      recordedImpressions.current.add(ad.id);
    }
    return (
      <View key={`ad-card-${ad.id}`} style={styles.adContainer}>
        <TouchableOpacity
          style={styles.adCard}
          onPress={() => handleAdPress(ad)}
          activeOpacity={0.9}
        >
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>Sponsored</Text>
          </View>
          {!failedAdImages.current.has(ad.id) ? (
            <Image 
              source={{ uri: ad.imageUrl }} 
              style={styles.adImage} 
              contentFit="cover"
              onError={() => {
                failedAdImages.current.add(ad.id);
                console.warn('Failed to load card ad image:', ad.id);
              }}
            />
          ) : (
            <View style={[styles.adImage, { backgroundColor: colors.background.secondary, justifyContent: 'center', alignItems: 'center' }]}>
              <ImageIcon size={32} color={colors.text.tertiary} />
            </View>
          )}
          <View style={styles.adContent}>
            <Text style={styles.adTitle}>{ad.title}</Text>
            <Text style={styles.adDescription} numberOfLines={2}>
              {ad.description}
            </Text>
            {ad.linkUrl && (
              <View style={styles.adLinkButton}>
                <Text style={styles.adLinkText}>Learn More</Text>
                <ExternalLink size={16} color={colors.text.white} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderBannerCardAdOverlay = (reelId: string, ad: Advertisement) => {
    if (!activeBannerCardAd || activeBannerCardAd.reelId !== reelId || activeBannerCardAd.ad.id !== ad.id) {
      return null;
    }

    // Record impression for banner/card ad when overlay is shown
    if (!recordedImpressions.current.has(ad.id)) {
      recordAdImpression(ad.id);
      recordedImpressions.current.add(ad.id);
    }

    const isBanner = ad.type === 'banner';

    return (
      <Animated.View 
        style={[
          styles.bannerCardAdOverlay,
          { transform: [{ translateY: bannerCardAdSlideAnim }] }
        ]}
      >
        <View style={[styles.bannerCardAdContainer, isBanner && styles.bannerCardAdBanner]}>
          {/* Ad Badge */}
          <View style={styles.bannerCardAdBadge}>
            <Text style={styles.bannerCardAdBadgeText}>Ad</Text>
          </View>

          {/* Skip Button - Always visible with countdown */}
          <View style={styles.bannerCardSkipButtonContainer}>
            <TouchableOpacity
              style={[
                styles.bannerCardSkipButton,
                !activeBannerCardAd.canSkip && styles.bannerCardSkipButtonDisabled
              ]}
              onPress={handleSkipBannerCardAd}
              activeOpacity={activeBannerCardAd.canSkip ? 0.8 : 1}
              disabled={!activeBannerCardAd.canSkip}
            >
              <Text style={styles.bannerCardSkipButtonText}>
                {activeBannerCardAd.canSkip 
                  ? 'Skip' 
                  : `Skip in ${bannerCardSkipCountdown}s`
                }
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ad Content */}
          <TouchableOpacity
            style={styles.bannerCardAdContent}
            onPress={() => handleAdPress(ad)}
            activeOpacity={0.9}
          >
            {isBanner ? (
              // Banner Ad Layout
              <>
                {!failedAdImages.current.has(ad.id) ? (
                  <Image 
                    source={{ uri: ad.imageUrl }} 
                    style={styles.bannerCardAdImage} 
                    contentFit="cover"
                    onError={() => {
                      failedAdImages.current.add(ad.id);
                      console.warn('Failed to load banner ad image:', ad.id);
                    }}
                  />
                ) : (
                  <View style={[styles.bannerCardAdImage, { backgroundColor: colors.background.secondary, justifyContent: 'center', alignItems: 'center' }]}>
                    <ImageIcon size={32} color={colors.text.tertiary} />
                  </View>
                )}
                <View style={styles.bannerCardAdTextContainer}>
                  <Text style={styles.bannerCardAdTitle} numberOfLines={1}>{ad.title}</Text>
                  {ad.linkUrl && (
                    <View style={styles.bannerCardAdLinkButton}>
                      <Text style={styles.bannerCardAdLinkText}>Learn More</Text>
                      <ExternalLink size={14} color={colors.primary} />
                    </View>
                  )}
                </View>
              </>
            ) : (
              // Card Ad Layout
              <>
                {!failedAdImages.current.has(ad.id) ? (
                  <Image 
                    source={{ uri: ad.imageUrl }} 
                    style={styles.bannerCardAdCardImage} 
                    contentFit="cover"
                    onError={() => {
                      failedAdImages.current.add(ad.id);
                      console.warn('Failed to load card ad image:', ad.id);
                    }}
                  />
                ) : (
                  <View style={[styles.bannerCardAdCardImage, { backgroundColor: colors.background.secondary, justifyContent: 'center', alignItems: 'center' }]}>
                    <ImageIcon size={32} color={colors.text.tertiary} />
                  </View>
                )}
                <View style={styles.bannerCardAdCardTextContainer}>
                  <Text style={styles.bannerCardAdTitle} numberOfLines={1}>{ad.title}</Text>
                  <Text style={styles.bannerCardAdDescription} numberOfLines={2}>
                    {ad.description}
                  </Text>
                  {ad.linkUrl && (
                    <View style={styles.bannerCardAdLinkButton}>
                      <Text style={styles.bannerCardAdLinkText}>Learn More</Text>
                      <ExternalLink size={14} color={colors.primary} />
                    </View>
                  )}
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderVideoAdOverlay = (reelId: string, ad: Advertisement) => {
    if (!activeVideoAd || activeVideoAd.reelId !== reelId || activeVideoAd.ad.id !== ad.id) {
      return null;
    }

    // Record impression for video ad when overlay is shown
    if (!recordedImpressions.current.has(ad.id)) {
      recordAdImpression(ad.id);
      recordedImpressions.current.add(ad.id);
    }

    return (
      <View style={styles.videoAdOverlay}>
        <View style={styles.videoAdContainer}>
          <View style={styles.videoAdHeader}>
            <View style={styles.adBadge}>
              <Text style={styles.adBadgeText}>Ad</Text>
            </View>
            <View style={styles.skipButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.skipButton,
                  !activeVideoAd.canSkip && styles.skipButtonDisabled
                ]}
                onPress={handleSkipAd}
                activeOpacity={activeVideoAd.canSkip ? 0.8 : 1}
                disabled={!activeVideoAd.canSkip}
              >
                <Text style={styles.skipButtonText}>
                  {activeVideoAd.canSkip 
                    ? 'Skip Ad' 
                    : `Skip in ${skipCountdown}s`
                  }
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.videoAdContent}
            onPress={() => handleAdPress(ad)}
            activeOpacity={0.9}
          >
            <Video
              ref={(ref: any) => {
                adVideoRefs.current[ad.id] = ref;
              }}
              source={{ uri: ad.imageUrl }}
              style={styles.videoAdVideo}
              resizeMode={ResizeMode.COVER}
              shouldPlay={true}
              isMuted={false}
              onError={(error: any) => {
                console.error('Failed to load video ad:', ad.id, error);
                Alert.alert('Error', 'Failed to load video advertisement. Skipping ad.');
                handleSkipAd();
              }}
              onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
                if (status.isLoaded) {
                  const currentTime = status.positionMillis || 0;
                  const duration = status.durationMillis || 0;
                  setVideoAdPlaybackTime(currentTime);
                  
                  // Countdown is handled by useEffect, which controls button visibility
                  // The skip button opacity is animated when countdown completes
                  
                  // Auto-close when video ends
                  if (status.didJustFinish) {
                    handleVideoAdEnd();
                  }
                }
              }}
            />
            <View style={styles.videoAdInfo}>
              <Text style={styles.videoAdTitle}>{ad.title}</Text>
              <Text style={styles.videoAdDescription} numberOfLines={1}>
                {ad.description}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAd = (ad: Advertisement, reelId?: string) => {
    // For video ads in reels, show as full overlay (pauses video)
    if (ad.type === 'video' && reelId) {
      // Trigger video ad overlay
      if (!activeVideoAd || activeVideoAd.reelId !== reelId) {
        // Pause the reel video
        const reelVideoRef = videoRefs.current[reelId];
        if (reelVideoRef) {
          reelVideoRef.pauseAsync().catch(() => {});
        }
        // Show ad overlay with skip delay
        setActiveVideoAd({ 
          reelId, 
          ad, 
          canSkip: false,
          skipDelay: SKIP_DELAY_SECONDS 
        });
        setVideoAdPlaybackTime(0);
        setSkipCountdown(SKIP_DELAY_SECONDS);
        skipButtonOpacity.setValue(0);
      }
      return null; // Video ads are rendered as overlay, not as separate items
    }
    
    // For banner/card ads in reels, show as bottom overlay (video continues)
    if ((ad.type === 'banner' || ad.type === 'card') && reelId) {
      // Banner/card ads are handled by useEffect and rendered as overlay
      // Don't render as separate items
      return null;
    }
    
    // For other ad types or when not in reels context (fallback)
    switch (ad.type) {
      case 'banner':
        return renderBannerAd(ad);
      case 'video':
        return renderCardAd(ad); // Fallback to card for video ads outside reels
      case 'card':
      default:
        return renderCardAd(ad);
    }
  };

  const renderReel = (reel: Reel, index: number) => {
    const isLiked = reel.likes.includes(currentUser.id);
    const isOwner = reel.userId === currentUser.id;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'moderator';
    
    // Check if there's a video ad for this reel
    const hasVideoAd = activeVideoAd?.reelId === reel.id;
    const shouldPlayReel = isScreenFocused && index === currentIndex && reel.id === currentReelId && !hasVideoAd;

    return (
      <View key={reel.id} style={styles.reelContainer}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => handleVideoPress(reel.id)}
          style={styles.videoTouchable}
        >
          <Video
            ref={(ref: any) => {
              videoRefs.current[reel.id] = ref;
            }}
            source={{ uri: reel.videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={shouldPlayReel}
            isMuted={isMuted}
            onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
              if (status.isLoaded) {
                // If screen is not focused, pause all videos
                if (!isScreenFocused && status.isPlaying) {
                  videoRefs.current[reel.id]?.stopAsync().catch(() => {});
                  videoRefs.current[reel.id]?.pauseAsync().catch(() => {});
                  return;
                }
                
                // Only auto-play if screen is focused, this is the current reel, not playing, and no video ad
                if (shouldPlayReel && !status.isPlaying) {
                  videoRefs.current[reel.id]?.playAsync().catch(() => {});
                }
                // Pause if this is not the current reel, screen is not focused, or video ad is showing
                if ((reel.id !== currentReelId || !isScreenFocused || hasVideoAd) && status.isPlaying) {
                  videoRefs.current[reel.id]?.pauseAsync().catch(() => {});
                }
              }
            }}
          />
          {/* Video Ad Overlay */}
          {hasVideoAd && activeVideoAd && renderVideoAdOverlay(reel.id, activeVideoAd.ad)}
          
          {/* Banner/Card Ad Overlay - Bottom of video, doesn't pause */}
          {activeBannerCardAd && activeBannerCardAd.reelId === reel.id && 
           renderBannerCardAdOverlay(reel.id, activeBannerCardAd.ad)}
        </TouchableOpacity>

        <View style={styles.overlay}>
          {/* Left side - User info and caption */}
          <View style={styles.leftSide}>
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <TouchableOpacity 
                  onPress={() => router.push(`/profile/${reel.userId}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatarContainer}>
                    {reel.userAvatar ? (
                      <Image
                        source={{ uri: reel.userAvatar }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarPlaceholderText}>
                          {reel.userName.charAt(0)}
                        </Text>
                      </View>
                    )}
                    {userStatuses[reel.userId] && (
                      <StatusIndicator 
                        status={userStatuses[reel.userId].statusType} 
                        size="small" 
                        showBorder={true}
                      />
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.userNameContainer}>
                  <View style={styles.userNameRow}>
                  <TouchableOpacity 
                    onPress={() => router.push(`/profile/${reel.userId}` as any)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.userName}>@{reel.userName.replace(/\s+/g, '').toLowerCase()}</Text>
                  </TouchableOpacity>
                  {!isOwner && currentUser && (
                    <TouchableOpacity
                        style={[styles.followButton, checkIsFollowing(reel.userId) && styles.followButtonActive]}
                      onPress={() => handleFollow(reel.userId)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.followButtonText}>
                          {checkIsFollowing(reel.userId) ? 'Unfollow' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>
              
              {editingReel === reel.id ? (
                <View style={styles.editCaptionContainer}>
                  <TextInput
                    style={styles.editCaptionInput}
                    value={editCaption}
                    onChangeText={setEditCaption}
                    multiline
                    placeholder="Edit caption..."
                    placeholderTextColor={colors.text.tertiary}
                  />
                  <View style={styles.editCaptionActions}>
                    <TouchableOpacity
                      style={styles.editCaptionButton}
                      onPress={() => {
                        setEditingReel(null);
                        setEditCaption('');
                      }}
                    >
                      <X size={16} color={colors.text.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editCaptionButton}
                      onPress={() => handleSaveEdit(reel.id)}
                    >
                      <Text style={styles.editCaptionSaveText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.caption} numberOfLines={3}>
                  {reel.caption}
                </Text>
              )}
                </View>
              </View>
            </View>
          </View>

          {/* Right side - Action buttons */}
          <View style={styles.rightSide}>

          {showReelMenu === reel.id && (
            <View style={styles.reelMenu}>
              {isOwner && (
                <>
                  <TouchableOpacity
                    style={styles.reelMenuItem}
                    onPress={() => handleEditReel(reel)}
                  >
                    <Edit2 size={18} color={colors.text.white} />
                    <Text style={styles.reelMenuItemText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reelMenuItem}
                    onPress={() => handleDeleteReel(reel.id)}
                  >
                    <Trash2 size={18} color={colors.danger} />
                    <Text style={[styles.reelMenuItemText, styles.reelMenuItemDelete]}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
              {isAdmin && !isOwner && (
                <>
                  <TouchableOpacity
                    style={styles.reelMenuItem}
                    onPress={() => handleAdminDeleteReel(reel.id)}
                  >
                    <Trash2 size={18} color={colors.danger} />
                    <Text style={[styles.reelMenuItemText, styles.reelMenuItemDelete]}>Delete (Admin)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reelMenuItem}
                    onPress={() => handleAdminRejectReel(reel.id)}
                  >
                    <X size={18} color={colors.danger} />
                    <Text style={[styles.reelMenuItemText, styles.reelMenuItemDelete]}>Reject (Admin)</Text>
                  </TouchableOpacity>
                </>
              )}
              {!isOwner && (
                <TouchableOpacity
                  style={styles.reelMenuItem}
                  onPress={() => {
                    setShowReelMenu(null);
                    setReportingReel({ id: reel.id, userId: reel.userId });
                  }}
                >
                  <Flag size={18} color={colors.danger} />
                  <Text style={[styles.reelMenuItemText, styles.reelMenuItemDelete]}>Report</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => toggleReelLike(reel.id)}
            >
              <View style={[styles.actionIconContainer, isLiked && styles.actionIconContainerActive]}>
                <Heart
                  size={32}
                  color={colors.text.white}
                  fill={isLiked ? colors.text.white : 'transparent'}
                  strokeWidth={isLiked ? 0 : 2.5}
                />
              </View>
              <Text style={styles.actionCount}>{formatCount(reel.likes.length)}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowComments(reel.id)}
            >
              <View style={styles.actionIconContainer}>
                <MessageCircle size={32} color={colors.text.white} strokeWidth={2.5} />
              </View>
              <Text style={styles.actionCount}>{formatCount(getReelComments(reel.id).length || reel.commentCount || 0)}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => shareReel(reel.id)}
            >
              <View style={styles.actionIconContainer}>
                <Share2 size={32} color={colors.text.white} strokeWidth={2.5} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setIsMuted(!isMuted)}
            >
              <View style={styles.actionIconContainer}>
                {isMuted ? (
                  <VolumeX size={30} color={colors.text.white} strokeWidth={2.5} />
                ) : (
                  <Volume2 size={30} color={colors.text.white} strokeWidth={2.5} />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowReelMenu(showReelMenu === reel.id ? null : reel.id)}
            >
              <View style={styles.actionIconContainer}>
                <MoreVertical size={28} color={colors.text.white} strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {showComments === reel.id && (
          <ReelCommentsModal
            reelId={reel.id}
            visible={showComments === reel.id}
            onClose={() => setShowComments(null)}
            comments={getReelComments(reel.id)}
            colors={colors}
            styles={styles}
            addComment={addReelComment}
            editComment={editReelComment}
            deleteComment={deleteReelComment}
            toggleCommentLike={toggleReelCommentLike}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {reels.length === 0 ? (
        <>
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <Film size={80} color={colors.text.tertiary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Reels Yet</Text>
            <Text style={styles.emptyText}>
              Create and share short video moments from your relationship journey!
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/reel/create' as any)}
            >
              <Plus size={20} color={colors.text.white} />
              <Text style={styles.emptyButtonText}>Create Your First Reel</Text>
            </TouchableOpacity>
            <Text style={styles.emptyNote}>
              💡 Tip: Run the seed-sample-data.sql script in Supabase to see sample reels
            </Text>
          </Animated.View>
          <View style={styles.emptyHeader}>
            <Text style={[styles.headerTitle, styles.emptyHeaderTitle]}>Reels</Text>
            <TouchableOpacity
              style={styles.emptyCreateButton}
              onPress={() => router.push('/reel/create' as any)}
            >
              <Plus size={24} color={colors.text.white} />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <ScrollView
            ref={scrollViewRef}
            pagingEnabled
            snapToInterval={height}
            snapToAlignment="start"
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            scrollEventThrottle={16}
            style={styles.scrollView}
          >
            {reels.map((reel: any, index: number) => {
              // Show ad every 5 reels (after the 4th, 9th, 14th, etc.)
              const shouldShowAdAfter = (index + 1) % 5 === 0 && smartAds.length > 0;
              let adToShow: Advertisement | null = null;
              if (shouldShowAdAfter) {
                const adIndex = Math.floor((index + 1) / 5 - 1) % smartAds.length;
                adToShow = smartAds[adIndex] || null;
              }
              
              return (
                <React.Fragment key={`fragment-${reel.id}`}>
                  {renderReel(reel, index)}
                  {adToShow && adToShow.type !== 'video' && renderAd(adToShow)}
                </React.Fragment>
              );
            })}
          </ScrollView>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Reels</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/reel/create' as any)}
            >
              <Plus size={24} color={colors.text.white} />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Report Reel Modal */}
      <ReportContentModal
        visible={!!reportingReel}
        onClose={() => setReportingReel(null)}
        contentType="reel"
        contentId={reportingReel?.id}
        reportedUserId={reportingReel?.userId}
        onReport={reportContent}
        colors={colors}
      />
    </View>
  );
}

const createStyles = (colors: any, overlayBottomPadding: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  reelContainer: {
    width,
    height,
    position: 'relative',
  },
  videoTouchable: {
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: overlayBottomPadding,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  leftSide: {
    flex: 1,
    paddingRight: 16,
    maxWidth: width * 0.7, // Limit width so it doesn't cover too much
  },
  rightSide: {
    alignItems: 'center',
    gap: 24,
    paddingLeft: 8,
  },
  userInfo: {
    // Removed flex: 1 to prevent vertical centering
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  userNameContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  avatarContainer: {
    position: 'relative',
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholderText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.text.white,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  followButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  followButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  followButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.text.white,
    letterSpacing: 0.5,
  },
  caption: {
    fontSize: 14,
    color: colors.text.white,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginTop: 8,
    paddingRight: 8,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  actionIconContainerActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  actionCount: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.text.white,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 2,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.white,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  createButton: {
    position: 'absolute',
    right: 20,
    top: 56,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    backgroundColor: colors.background.secondary,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.text.primary,
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  emptyNote: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
    fontStyle: 'italic' as const,
  },
  emptyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  emptyHeaderTitle: {
    color: colors.text.primary,
    textShadowColor: 'transparent',
  },
  emptyCreateButton: {
    position: 'absolute',
    right: 20,
    top: 56,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  reelMenuButton: {
    marginLeft: 8,
    padding: 4,
  },
  reelMenu: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    padding: 8,
    minWidth: 150,
    zIndex: 10,
  },
  reelMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  reelMenuItemText: {
    fontSize: 15,
    color: colors.text.white,
    fontWeight: '500' as const,
  },
  reelMenuItemDelete: {
    color: colors.danger,
  },
  editCaptionContainer: {
    marginTop: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    padding: 8,
  },
  editCaptionInput: {
    color: colors.text.white,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  editCaptionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editCaptionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  editCaptionSaveText: {
    color: colors.text.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  commentsList: {
    flex: 1,
  },
  emptyCommentsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyCommentsText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  comment: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  commentHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarPlaceholderText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  commentContent: {
    flex: 1,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUserName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  commentText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
    marginBottom: 4,
  },
  commentStickerContainer: {
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  commentSticker: {
    width: 120,
    height: 120,
  },
  commentTime: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  commentActionText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '600' as const,
  },
  commentActionSave: {
    color: colors.primary,
  },
  commentEditInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: colors.text.primary,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 4,
  },
  commentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 6,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionCount: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '600' as const,
  },
  commentActionCountActive: {
    color: colors.danger,
  },
  viewRepliesButton: {
    marginTop: 8,
    marginLeft: 44,
  },
  viewRepliesText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  reply: {
    marginTop: 12,
    marginLeft: 44,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.border.light,
  },
  replyHeader: {
    flexDirection: 'row',
    gap: 10,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  replyAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyAvatarPlaceholderText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  replyContent: {
    flex: 1,
  },
  replyInputContainer: {
    marginTop: 12,
    marginLeft: 44,
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    gap: 8,
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: colors.text.primary,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  replyInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  commentActionTextDisabled: {
    opacity: 0.5,
  },
  commentInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  stickerPreview: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewSticker: {
    width: 100,
    height: 100,
  },
  removeStickerButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  stickerButton: {
    padding: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: colors.text.primary,
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: colors.background.secondary,
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  sendButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  adContainer: {
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  adCard: {
    width: width * 0.9,
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  adBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 1,
  },
  adBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  adImage: {
    width: '100%',
    height: 200,
  },
  adContent: {
    padding: 16,
  },
  adTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  adDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  adLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  adLinkText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  bannerAdContainer: {
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 16,
  },
  bannerAd: {
    width: '100%',
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerAdImage: {
    width: '100%',
    height: 120,
  },
  bannerAdContent: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerAdTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.primary,
    flex: 1,
  },
  bannerAdLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary + '20',
    borderRadius: 6,
  },
  bannerAdLinkText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  videoAdOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  videoAdContainer: {
    width: width * 0.9,
    maxHeight: height * 0.7,
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoAdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  videoAdContent: {
    width: '100%',
  },
  videoAdVideo: {
    width: '100%',
    height: (height * 0.7) - 100,
    backgroundColor: '#000',
  },
  videoAdInfo: {
    padding: 16,
    backgroundColor: colors.background.primary,
  },
  videoAdTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  videoAdDescription: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  skipButtonContainer: {
    marginLeft: 'auto',
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    minWidth: 100,
    alignItems: 'center',
  },
  skipButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    opacity: 0.8,
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.text.white,
    letterSpacing: 0.3,
  },
  // Banner/Card Ad Overlay Styles
  bannerCardAdOverlay: {
    position: 'absolute',
    bottom: overlayBottomPadding + 160, // Position above tab bar + overlay content (description/profile/actions)
    left: 0,
    right: 0,
    zIndex: 60, // Higher than overlay content (which is at default zIndex)
    paddingHorizontal: 12,
    maxWidth: width * 0.85, // Don't cover the entire width, leave some space
    alignSelf: 'center', // Center the ad
  },
  bannerCardAdContainer: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    position: 'relative',
  },
  bannerCardAdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerCardAdBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 2,
  },
  bannerCardAdBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: colors.text.white,
    letterSpacing: 0.5,
  },
  bannerCardSkipButtonContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
  },
  bannerCardSkipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    minWidth: 80,
    alignItems: 'center',
  },
  bannerCardSkipButtonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    opacity: 0.8,
  },
  bannerCardSkipButtonText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.text.white,
    letterSpacing: 0.3,
  },
  bannerCardAdContent: {
    width: '100%',
  },
  bannerCardAdImage: {
    width: '100%',
    height: 100,
  },
  bannerCardAdCardImage: {
    width: '100%',
    height: 150,
  },
  bannerCardAdTextContainer: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerCardAdCardTextContainer: {
    padding: 12,
  },
  bannerCardAdTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  bannerCardAdDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  bannerCardAdLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.primary + '20',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  bannerCardAdLinkText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.primary,
  },
});

function ReelCommentsModal({
  reelId,
  visible,
  onClose,
  comments,
  colors,
  styles,
  addComment,
  editComment,
  deleteComment,
  toggleCommentLike,
}: {
  reelId: string;
  visible: boolean;
  onClose: () => void;
  comments: any[];
  colors: any;
  styles: any;
  addComment: (reelId: string, content: string, parentCommentId?: string, stickerId?: string, messageType?: 'text' | 'sticker') => Promise<any>;
  editComment: (commentId: string, content: string) => Promise<any>;
  deleteComment: (commentId: string) => Promise<boolean>;
  toggleCommentLike: (commentId: string, reelId: string) => Promise<boolean>;
}) {
  const { currentUser, reportContent } = useApp();
  const [reportingComment, setReportingComment] = useState<{ id: string; userId: string } | null>(null);
  const [commentText, setCommentText] = useState<string>('');
  const [selectedSticker, setSelectedSticker] = useState<{ id: string; imageUrl: string } | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState<string>('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const handleSubmit = async () => {
    if (replyingTo && (replyText.trim() || selectedSticker)) {
      await addComment(
        reelId, 
        replyText.trim(), 
        replyingTo,
        selectedSticker?.id,
        selectedSticker ? 'sticker' : 'text'
      );
      setReplyText('');
      setSelectedSticker(null);
      setReplyingTo(null);
      setExpandedReplies((prev: Set<string>) => new Set([...prev, replyingTo]));
    } else if (commentText.trim() || selectedSticker) {
      await addComment(
        reelId, 
        commentText.trim(),
        undefined,
        selectedSticker?.id,
        selectedSticker ? 'sticker' : 'text'
      );
      setCommentText('');
      setSelectedSticker(null);
    }
  };

  const handleEditComment = (comment: any) => {
    // Prevent editing sticker comments
    if (comment.messageType === 'sticker') {
      Alert.alert('Cannot Edit', 'Sticker comments cannot be edited. You can delete them instead.');
      return;
    }
    setEditingComment(comment.id);
    setEditCommentText(comment.content);
  };

  const handleSaveEdit = async (commentId: string) => {
    const success = await editComment(commentId, editCommentText);
    if (success) {
      setEditingComment(null);
      setEditCommentText('');
    } else {
      Alert.alert('Error', 'Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteComment(commentId);
            if (!success) {
              Alert.alert('Error', 'Failed to delete comment');
            }
          },
        },
      ]
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.commentsList}>
          {comments.length === 0 ? (
            <View style={styles.emptyCommentsContainer}>
              <Text style={styles.emptyCommentsText}>No comments yet</Text>
              <Text style={styles.emptyCommentsSubtext}>Be the first to comment!</Text>
            </View>
          ) : (
            comments.map((comment) => {
              const isOwner = comment.userId === currentUser?.id;
              const isLiked = comment.likes?.includes(currentUser?.id || '') || false;
              const hasReplies = comment.replies && comment.replies.length > 0;
              const showReplies = expandedReplies.has(comment.id);
              
              return (
                <View key={comment.id} style={styles.comment}>
                  <View style={styles.commentHeader}>
                    {comment.userAvatar ? (
                      <Image
                        source={{ uri: comment.userAvatar }}
                        style={styles.commentAvatar}
                      />
                    ) : (
                      <View style={styles.commentAvatarPlaceholder}>
                        <Text style={styles.commentAvatarPlaceholderText}>
                          {comment.userName.charAt(0)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeaderRow}>
                        <Text style={styles.commentUserName}>{comment.userName}</Text>
                        {isOwner && (
                          <View style={styles.commentActions}>
                            {editingComment === comment.id ? (
                              <>
                                <TouchableOpacity
                                  onPress={() => {
                                    setEditingComment(null);
                                    setEditCommentText('');
                                  }}
                                >
                                  <Text style={styles.commentActionText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleSaveEdit(comment.id)}
                                >
                                  <Text style={[styles.commentActionText, styles.commentActionSave]}>Save</Text>
                                </TouchableOpacity>
                              </>
                            ) : (
                              <>
                                <TouchableOpacity
                                  onPress={() => handleEditComment(comment)}
                                >
                                  <Edit2 size={14} color={colors.text.secondary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleDeleteComment(comment.id)}
                                >
                                  <Trash2 size={14} color={colors.danger} />
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                      {editingComment === comment.id ? (
                        <TextInput
                          style={styles.commentEditInput}
                          value={editCommentText}
                          onChangeText={setEditCommentText}
                          multiline
                          placeholderTextColor={colors.text.tertiary}
                        />
                    ) : (
                      <>
                        {comment.messageType === 'sticker' && comment.stickerImageUrl ? (
                          <View style={styles.commentStickerContainer}>
                            <Image
                              source={{ uri: comment.stickerImageUrl }}
                              style={styles.commentSticker}
                              contentFit="contain"
                            />
                          </View>
                        ) : (
                          <Text style={styles.commentText}>{comment.content}</Text>
                        )}
                      </>
                    )}
                      <View style={styles.commentActionsRow}>
                        <TouchableOpacity
                          style={styles.commentActionButton}
                          onPress={() => toggleCommentLike(comment.id, reelId)}
                        >
                          <Heart
                            size={16}
                            color={isLiked ? colors.danger : colors.text.secondary}
                            fill={isLiked ? colors.danger : 'transparent'}
                          />
                          <Text style={[styles.commentActionCount, isLiked && styles.commentActionCountActive]}>
                            {comment.likes?.length || 0}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.commentActionButton}
                          onPress={() => {
                            setReplyingTo(replyingTo === comment.id ? null : comment.id);
                            setReplyText('');
                          }}
                        >
                          <MessageCircle size={16} color={colors.text.secondary} />
                          <Text style={styles.commentActionText}>Reply</Text>
                        </TouchableOpacity>
                        {!isOwner && (
                          <TouchableOpacity
                            style={styles.commentActionButton}
                            onPress={() => setReportingComment({ id: comment.id, userId: comment.userId })}
                          >
                            <Flag size={14} color={colors.danger} />
                          </TouchableOpacity>
                        )}
                        <Text style={styles.commentTime}>{formatTimeAgo(comment.createdAt)}</Text>
                      </View>
                      
                      {/* Replies */}
                      {hasReplies && (
                        <TouchableOpacity
                          style={styles.viewRepliesButton}
                          onPress={() => {
                            const newExpanded = new Set(expandedReplies);
                            if (showReplies) {
                              newExpanded.delete(comment.id);
                            } else {
                              newExpanded.add(comment.id);
                            }
                            setExpandedReplies(newExpanded);
                          }}
                        >
                          <Text style={styles.viewRepliesText}>
                            {showReplies ? 'Hide' : 'View'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      
                      {showReplies && comment.replies && comment.replies.map((reply: any) => {
                        const isReplyOwner = reply.userId === currentUser?.id;
                        const isReplyLiked = reply.likes?.includes(currentUser?.id || '') || false;
                        return (
                          <View key={reply.id} style={styles.reply}>
                            <View style={styles.replyHeader}>
                              {reply.userAvatar ? (
                                <Image
                                  source={{ uri: reply.userAvatar }}
                                  style={styles.replyAvatar}
                                />
                              ) : (
                                <View style={styles.replyAvatarPlaceholder}>
                                  <Text style={styles.replyAvatarPlaceholderText}>
                                    {reply.userName.charAt(0)}
                                  </Text>
                                </View>
                              )}
                              <View style={styles.replyContent}>
                                <View style={styles.commentHeaderRow}>
                                  <Text style={styles.commentUserName}>{reply.userName}</Text>
                                  {isReplyOwner && (
                                    <View style={styles.commentActions}>
                                      {editingComment === reply.id ? (
                                        <>
                                          <TouchableOpacity
                                            onPress={() => {
                                              setEditingComment(null);
                                              setEditCommentText('');
                                            }}
                                          >
                                            <Text style={styles.commentActionText}>Cancel</Text>
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            onPress={() => handleSaveEdit(reply.id)}
                                          >
                                            <Text style={[styles.commentActionText, styles.commentActionSave]}>Save</Text>
                                          </TouchableOpacity>
                                        </>
                                      ) : (
                                        <>
                                          <TouchableOpacity
                                            onPress={() => {
                                            // Prevent editing sticker comments
                                            if (reply.messageType === 'sticker') {
                                              Alert.alert('Cannot Edit', 'Sticker comments cannot be edited. You can delete them instead.');
                                              return;
                                            }
                                            setEditingComment(reply.id);
                                            setEditCommentText(reply.content);
                                            }}
                                          >
                                            <Edit2 size={12} color={colors.text.secondary} />
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            onPress={() => handleDeleteComment(reply.id)}
                                          >
                                            <Trash2 size={12} color={colors.danger} />
                                          </TouchableOpacity>
                                        </>
                                      )}
                                    </View>
                                  )}
                                </View>
                                {editingComment === reply.id ? (
                                  <TextInput
                                    style={styles.commentEditInput}
                                    value={editCommentText}
                                    onChangeText={setEditCommentText}
                                    multiline
                                    placeholderTextColor={colors.text.tertiary}
                                  />
                                ) : (
                                  <>
                                    {reply.messageType === 'sticker' && reply.stickerImageUrl ? (
                                      <View style={styles.commentStickerContainer}>
                                        <Image
                                          source={{ uri: reply.stickerImageUrl }}
                                          style={styles.commentSticker}
                                          contentFit="contain"
                                        />
                                      </View>
                                    ) : (
                                      <Text style={styles.commentText}>{reply.content}</Text>
                                    )}
                                  </>
                                )}
                                <View style={styles.commentActionsRow}>
                                  <TouchableOpacity
                                    style={styles.commentActionButton}
                                    onPress={() => toggleCommentLike(reply.id, reelId)}
                                  >
                                    <Heart
                                      size={14}
                                      color={isReplyLiked ? colors.danger : colors.text.secondary}
                                      fill={isReplyLiked ? colors.danger : 'transparent'}
                                    />
                                    <Text style={[styles.commentActionCount, isReplyLiked && styles.commentActionCountActive]}>
                                      {reply.likes?.length || 0}
                                    </Text>
                                  </TouchableOpacity>
                                  <Text style={styles.commentTime}>{formatTimeAgo(reply.createdAt)}</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                      
                      {/* Reply Input */}
                      {replyingTo === comment.id && (
                        <View style={styles.replyInputContainer}>
                          {selectedSticker && (
                            <View style={styles.stickerPreview}>
                              <Image source={{ uri: selectedSticker.imageUrl }} style={styles.previewSticker} />
                              <TouchableOpacity
                                style={styles.removeStickerButton}
                                onPress={() => setSelectedSticker(null)}
                              >
                                <X size={16} color={colors.text.white} />
                              </TouchableOpacity>
                            </View>
                          )}
                          <View style={styles.replyInputRow}>
                            <TouchableOpacity
                              style={styles.stickerButton}
                              onPress={() => setShowStickerPicker(true)}
                              activeOpacity={0.7}
                            >
                              <Smile size={20} color={colors.text.secondary} />
                            </TouchableOpacity>
                            <TextInput
                              style={styles.replyInput}
                              placeholder={`Reply to ${comment.userName}...`}
                              placeholderTextColor={colors.text.tertiary}
                              value={replyText}
                              onChangeText={setReplyText}
                              multiline
                            />
                          </View>
                          <View style={styles.replyInputActions}>
                            <TouchableOpacity
                              onPress={() => {
                                setReplyingTo(null);
                                setReplyText('');
                                setSelectedSticker(null);
                              }}
                            >
                              <Text style={styles.commentActionText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={handleSubmit}
                              disabled={!replyText.trim() && !selectedSticker}
                            >
                              <Text style={[styles.commentActionText, (!replyText.trim() && !selectedSticker) && styles.commentActionTextDisabled]}>
                                Reply
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {!replyingTo && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.commentInputContainer}
          >
            {selectedSticker && (
              <View style={styles.stickerPreview}>
                <Image source={{ uri: selectedSticker.imageUrl }} style={styles.previewSticker} />
                <TouchableOpacity
                  style={styles.removeStickerButton}
                  onPress={() => setSelectedSticker(null)}
                >
                  <X size={16} color={colors.text.white} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.commentInputRow}>
              <TouchableOpacity
                style={styles.stickerButton}
                onPress={() => setShowStickerPicker(true)}
                activeOpacity={0.7}
              >
                <Smile size={24} color={colors.text.secondary} />
              </TouchableOpacity>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor={colors.text.tertiary}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!commentText.trim() && !selectedSticker) && styles.sendButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!commentText.trim() && !selectedSticker}
              >
                <Text
                  style={[
                    styles.sendButtonText,
                    (!commentText.trim() && !selectedSticker) && styles.sendButtonTextDisabled,
                  ]}
                >
                  Send
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>

      {/* Report Comment Modal */}
      <ReportContentModal
        visible={!!reportingComment}
        onClose={() => setReportingComment(null)}
        contentType="comment"
        contentId={reportingComment?.id}
        reportedUserId={reportingComment?.userId}
        onReport={reportContent}
        colors={colors}
      />

      {/* Sticker Picker */}
      <StickerPicker
        visible={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelectSticker={(sticker: Sticker) => {
          setSelectedSticker({ id: sticker.id, imageUrl: sticker.imageUrl });
          setCommentText(''); // Clear text when sticker is selected
          setReplyText(''); // Clear reply text when sticker is selected
          setShowStickerPicker(false);
        }}
      />
    </Modal>
  );
}
