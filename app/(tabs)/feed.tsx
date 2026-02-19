import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { useRouter , useNavigation } from 'expo-router';
import { Heart, MessageCircle, Share2, Plus, X, ExternalLink, MoreVertical, Edit2, Trash2, Image as ImageIcon, Flag, Smile, Camera, FileText, Video as VideoIcon } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Post, Advertisement, Sticker, Comment as PostComment, ReelComment } from '@/types';
import StickerPicker from '@/components/StickerPicker';
import StatusIndicator from '@/components/StatusIndicator';
import StatusStoriesBar from '@/components/StatusStoriesBar';
import FacebookStyleStoriesBar from '@/components/FacebookStyleStoriesBar';
import * as WebBrowser from 'expo-web-browser';
import ReportContentModal from '@/components/ReportContentModal';
import LinkifiedText from '@/components/LinkifiedText';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore - legacy path works at runtime, TypeScript definitions may not include it
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

export default function FeedScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { currentUser, posts, toggleLike, getComments, getActiveAds, getPersonalizedFeed, getSmartAds, recordAdImpression, recordAdClick, recordAdEngagement, addComment, editComment, deleteComment, toggleCommentLike, editPost, deletePost, sharePost, adminDeletePost, adminRejectPost, reportContent, getUserStatus, userStatuses, getReelComments, toggleReelLike, addReelComment, shareReel } = useApp();
  const { colors } = useTheme();
  const [showComments, setShowComments] = useState<string | null>(null);
  const [smartAds, setSmartAds] = useState<Advertisement[]>([]);
  const [personalizedPosts, setPersonalizedPosts] = useState<Post[]>([]);
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [editMediaUrls, setEditMediaUrls] = useState<string[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const [viewingImages, setViewingImages] = useState<{ urls: string[]; index: number } | null>(null);
  const [postImageIndices, setPostImageIndices] = useState<Record<string, number>>({});
  const imageViewerScrollRef = useRef<ScrollView>(null);
  const postScrollRefs = useRef<Record<string, ScrollView | null>>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [reportingPost, setReportingPost] = useState<{ id: string; userId: string } | null>(null);
  const [postStatuses, setPostStatuses] = useState<Record<string, any>>({});
  const recordedImpressions = useRef<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const failedAdImages = useRef<Set<string>>(new Set());
  const [boostedPostIds, setBoostedPostIds] = useState<Set<string>>(new Set());
  const [adUserPhotos, setAdUserPhotos] = useState<Record<string, string>>({});
  const [adOriginalPosts, setAdOriginalPosts] = useState<Record<string, Post | null>>({});
  const [adOriginalReels, setAdOriginalReels] = useState<Record<string, any>>({});
  const [adLikes, setAdLikes] = useState<Record<string, string[]>>({});
  const [adComments, setAdComments] = useState<Record<string, (PostComment | ReelComment)[]>>({});
  const [expandedAdDescriptions, setExpandedAdDescriptions] = useState<Set<string>>(new Set());
  const [showAdComments, setShowAdComments] = useState<string | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Reset recorded impressions when ads change
  useEffect(() => {
    recordedImpressions.current.clear();
  }, [smartAds]);

  // Track which of the current user's posts have a boost (so we can show "Boost again")
  useEffect(() => {
    const loadBoosted = async () => {
      if (!currentUser) return;
      try {
        const nowIso = new Date().toISOString();
        const { data } = await supabase
          .from('advertisements')
          .select('promoted_post_id, status, end_date')
          .eq('user_id', currentUser.id)
          .not('promoted_post_id', 'is', null)
          .in('status', ['pending', 'approved', 'paused'])
          .or(`end_date.is.null,end_date.gte.${nowIso}`);

        const ids = new Set<string>();
        (data || []).forEach((row: any) => {
          if (row.promoted_post_id) ids.add(row.promoted_post_id);
        });
        setBoostedPostIds(ids);
      } catch (e) {
        console.error('Failed to load boosted post ids:', e);
      }
    };
    loadBoosted();
  }, [currentUser]);

  // Load feed sorted by date/time (newest first) - like Facebook
  useEffect(() => {
    if (posts.length > 0) {
      // Sort posts by createdAt (newest first) - simple chronological order
      const sortedPosts = [...posts].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setPersonalizedPosts(sortedPosts);
      
      // Load statuses for all post authors
      let isMounted = true;
      const loadPostStatuses = async () => {
        if (!isMounted) return;
        const statusMap: Record<string, any> = {};
        for (const post of sortedPosts) {
          if (!isMounted) return;
          if (post.userId && getUserStatus && !postStatuses[post.userId]) {
            const status = await getUserStatus(post.userId);
            if (status && isMounted) {
              statusMap[post.userId] = status;
            }
          } else if (postStatuses[post.userId]) {
            statusMap[post.userId] = postStatuses[post.userId];
          }
        }
        if (isMounted) {
          setPostStatuses((prev: Record<string, any>) => ({ ...prev, ...statusMap }));
        }
      };
      loadPostStatuses();
      
      return () => {
        isMounted = false;
      };
    } else {
      setPersonalizedPosts([]);
    }
  }, [posts, getUserStatus]);

  useEffect(() => {
    const loadSmartAds = async () => {
      try {
        // Don't exclude ads - let the smart rotation algorithm handle it
        // The algorithm will naturally rotate ads based on recent impressions
        const ads = await getSmartAds('feed', [], 20);
        setSmartAds(ads);
        
        // Load profile photos for ad sponsors
        const userIds = ads.filter(ad => ad.userId).map(ad => ad.userId!);
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, profile_picture')
            .in('id', userIds);
          
          if (users) {
            const photoMap: Record<string, string> = {};
            users.forEach(user => {
              if (user.profile_picture) {
                photoMap[user.id] = user.profile_picture;
              }
            });
            setAdUserPhotos(photoMap);
          }
        }

        // Load original posts/reels for boosted content
        const postMap: Record<string, Post | null> = {};
        const reelMap: Record<string, any> = {};
        const likesMap: Record<string, string[]> = {};
        const commentsMap: Record<string, (PostComment | ReelComment)[]> = {};

        for (const ad of ads) {
          if (ad.promotedPostId) {
            const originalPost = posts.find(p => p.id === ad.promotedPostId);
            if (originalPost) {
              postMap[ad.id] = originalPost;
              likesMap[ad.id] = originalPost.likes;
              commentsMap[ad.id] = getComments(originalPost.id);
            }
          } else if (ad.promotedReelId) {
            const { data: reelData } = await supabase
              .from('reels')
              .select('id, user_id, caption, video_url, thumbnail_url, created_at')
              .eq('id', ad.promotedReelId)
              .single();
            if (reelData) {
              reelMap[ad.id] = reelData;
              // Get reel likes
              const { data: reelLikes } = await supabase
                .from('reel_likes')
                .select('user_id')
                .eq('reel_id', ad.promotedReelId);
              likesMap[ad.id] = (reelLikes || []).map((l: any) => l.user_id);
              // Get reel comments
              const reelCommentsList = getReelComments(ad.promotedReelId) || [];
              commentsMap[ad.id] = reelCommentsList;
            }
          }
        }

        setAdOriginalPosts(postMap);
        setAdOriginalReels(reelMap);
        setAdLikes(likesMap);
        setAdComments(commentsMap);
      } catch (error) {
        console.error('Error loading smart ads:', error);
        // Fallback to regular ads
        const fallbackAds = getActiveAds('feed');
        setSmartAds(fallbackAds.slice(0, 20));
      }
    };
    if (currentUser) {
      loadSmartAds();
    }
  }, [getSmartAds, getActiveAds, currentUser, posts, getComments, getReelComments]);

  // Refresh ad engagement when posts/comments change
  useEffect(() => {
    const updateAdEngagement = () => {
      const newLikes: Record<string, string[]> = {};
      const newComments: Record<string, (PostComment | ReelComment)[]> = {};
      
      smartAds.forEach(ad => {
        if (ad.promotedPostId) {
          const originalPost = posts.find(p => p.id === ad.promotedPostId);
          if (originalPost) {
            newLikes[ad.id] = originalPost.likes;
            newComments[ad.id] = getComments(originalPost.id);
          }
        } else if (ad.promotedReelId) {
          const reelCommentsList = getReelComments(ad.promotedReelId) || [];
          newComments[ad.id] = reelCommentsList;
          // Get reel likes from database
          supabase
            .from('reel_likes')
            .select('user_id')
            .eq('reel_id', ad.promotedReelId)
            .then(({ data }) => {
              if (data) {
                const likes = data.map((l: any) => l.user_id);
                setAdLikes(prev => ({ ...prev, [ad.id]: likes }));
              }
            });
        }
      });
      
      setAdLikes(prev => ({ ...prev, ...newLikes }));
      setAdComments(prev => ({ ...prev, ...newComments }));
    };
    
    if (smartAds.length > 0) {
      updateAdEngagement();
    }
  }, [posts, smartAds, getComments, getReelComments]);
  
  // Reload ads periodically to ensure rotation (every 30 seconds or when posts change)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (currentUser && smartAds.length > 0) {
        try {
          const ads = await getSmartAds('feed', [], 20);
          setSmartAds(ads);
        } catch (error) {
          console.error('Error refreshing smart ads:', error);
        }
      }
    }, 30000); // Refresh every 30 seconds for better rotation
    
    return () => clearInterval(interval);
  }, [currentUser, getSmartAds, smartAds.length]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.background.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    appLogoImage: {
      width: 32,
      height: 32,
      borderRadius: 8,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: '700' as const,
      color: colors.text.primary,
      letterSpacing: -0.5,
    },
    headerIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerIconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    notificationBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: '#E41E3F',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      borderWidth: 2,
      borderColor: colors.background.primary,
    },
    notificationBadgeText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: '#FFFFFF',
    },
    scrollContent: {
      paddingBottom: 100,
    },
    post: {
      backgroundColor: colors.background.primary,
      marginBottom: 12,
      paddingTop: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    postHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    postUserInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    postAvatarContainer: {
      position: 'relative',
      width: 44,
      height: 44,
    },
    postAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    postAvatarPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    postAvatarPlaceholderText: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: colors.text.white,
    },
    postUserName: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: colors.text.primary,
    },
    postTime: {
      fontSize: 13,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    postContent: {
      fontSize: 15,
      color: colors.text.primary,
      lineHeight: 22,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    postContentLink: {
      color: '#1877F2',
      textDecorationLine: 'underline',
    },
    mediaWrapper: {
      position: 'relative',
      marginBottom: 12,
    },
    mediaContainer: {
      width: '100%',
    },
    postImageTouchable: {
      width,
      height: width,
    },
    postImage: {
      width,
      height: width,
    },
    dotsContainer: {
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    dotActive: {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    postActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 24,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionText: {
      fontSize: 15,
      color: colors.text.secondary,
      fontWeight: '600' as const,
    },
    actionTextActive: {
      color: colors.danger,
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
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentsList: {
      flex: 1,
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
      width: 60,
      height: 60,
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
      fontSize: 15,
      color: colors.text.primary,
      maxHeight: 100,
    },
    sendButton: {
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.primary,
    },
    sendButtonDisabled: {
      backgroundColor: colors.background.secondary,
    },
    sendButtonText: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: colors.text.white,
    },
    sendButtonTextDisabled: {
      color: colors.text.tertiary,
    },
    adCard: {
      backgroundColor: colors.background.primary,
      marginBottom: 12,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 0,
      borderWidth: 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
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
    adHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    adSponsorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    adAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    adAvatarText: {
      color: colors.text.primary,
      fontWeight: '800' as const,
      fontSize: 16,
    },
    adSponsorMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    adSponsorName: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: colors.text.primary,
    },
    adVerifiedTick: {
      fontSize: 14,
      color: '#1877F2',
      marginLeft: 4,
    },
    verifiedBadge: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#1877F2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    verifiedTick: {
      fontSize: 10,
      color: colors.text.white,
      fontWeight: '800' as const,
    },
    adSponsoredText: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    seeMoreText: {
      fontSize: 14,
      color: colors.text.secondary,
      fontWeight: '600' as const,
      marginTop: 4,
    },
    adEngagementRow: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    adEngagementCounts: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    adEngagementItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    adEngagementCountText: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    adActionButtons: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      paddingHorizontal: 8,
    },
    adActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    adActionButtonText: {
      fontSize: 14,
      color: colors.text.secondary,
      fontWeight: '600' as const,
    },
    adLinkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.background.secondary,
      borderRadius: 8,
    },
    adLinkText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600' as const,
    },
    adButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    adCTAButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 8,
    },
    adCTAButtonText: {
      color: colors.text.white,
      fontWeight: '700' as const,
      fontSize: 14,
    },
    adContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
    },
    adTitle: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: colors.text.primary,
      marginBottom: 4,
    },
    adDescription: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    adDescriptionLink: {
      color: '#1877F2',
      textDecorationLine: 'underline',
    },
    adActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    adInsightsButton: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adInsightsButtonText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.text.primary,
    },
    bannerAdCard: {
      backgroundColor: colors.background.primary,
      marginBottom: 12,
      position: 'relative',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      borderRadius: 8,
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
      marginRight: 12,
    },
    bannerAdDescription: {
      fontSize: 13,
      color: colors.text.secondary,
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
    videoAdCard: {
      backgroundColor: colors.background.primary,
      marginBottom: 12,
      position: 'relative',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    videoAdImage: {
      width: '100%',
      height: 300,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 100,
      paddingHorizontal: 40,
    },
    emptyStateTitle: {
      fontSize: 28,
      fontWeight: '800' as const,
      color: colors.text.primary,
      marginTop: 32,
      marginBottom: 12,
      textAlign: 'center',
    },
    emptyStateText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    emptyStateButton: {
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
    emptyStateButtonText: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: colors.text.white,
    },
    emptyStateNote: {
      fontSize: 13,
      color: colors.text.tertiary,
      textAlign: 'center',
      lineHeight: 18,
      fontStyle: 'italic' as const,
    },
    menuButton: {
      padding: 8,
    },
    postMenu: {
      backgroundColor: colors.background.secondary,
      borderRadius: 8,
      padding: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 8,
    },
    menuItemText: {
      fontSize: 15,
      color: colors.text.primary,
      fontWeight: '500' as const,
    },
    deleteText: {
      color: colors.danger,
    },
    editContainer: {
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    editInput: {
      backgroundColor: colors.background.secondary,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text.primary,
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: 12,
    },
    editActions: {
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'flex-end',
    },
    editButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    cancelButton: {
      backgroundColor: colors.background.secondary,
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    editButtonText: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: colors.text.secondary,
    },
    saveButtonText: {
      color: colors.text.white,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    editMediaContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    editMediaWrapper: {
      position: 'relative',
      width: 80,
      height: 80,
    },
    editMediaImage: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
    },
    editRemoveButton: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: 12,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addMediaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.background.secondary,
      borderRadius: 8,
      alignSelf: 'flex-start',
      marginBottom: 12,
    },
    addMediaText: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.primary,
    },
    imageViewerContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageViewerCloseButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      zIndex: 10,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 20,
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageViewerScroll: {
      flex: 1,
    },
    imageViewerItem: {
      width: Dimensions.get('window').width,
      height: Dimensions.get('window').height,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageViewerImage: {
      width: Dimensions.get('window').width,
      height: Dimensions.get('window').height,
    },
    imageViewerIndicator: {
      position: 'absolute',
      bottom: 50,
      alignSelf: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    imageViewerIndicatorText: {
      color: colors.text.white,
      fontSize: 14,
      fontWeight: '600' as const,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    createModalContent: {
      backgroundColor: colors.background.primary,
      borderRadius: 20,
      padding: 20,
      width: '85%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
    },
    createOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      backgroundColor: colors.background.secondary,
    },
    createOptionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    createOptionText: {
      flex: 1,
    },
    createOptionTitle: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: colors.text.primary,
      marginBottom: 4,
    },
    createOptionSubtitle: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    createModalCancel: {
      marginTop: 8,
      padding: 16,
      alignItems: 'center',
    },
    createModalCancelText: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.text.secondary,
    },
    boostRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderColor: colors.border.light,
      backgroundColor: colors.background.primary,
    },
    boostSecondaryBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    boostSecondaryText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: colors.text.primary,
    },
    boostPrimaryBtn: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    boostPrimaryText: {
      fontSize: 13,
      fontWeight: '800' as const,
      color: colors.text.white,
    },
  }), [colors]);

  if (!currentUser) {
    return null;
  }

  const formatTimeAgo = (dateString: string) => {
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
    return date.toLocaleDateString();
  };

  const isVideo = (url: string) => {
    return url.includes('.mp4') || url.includes('.mov') || url.includes('video');
  };

  const handleImagePress = (post: Post, index: number) => {
    // Filter out videos, only show images in viewer
    const imageUrls = post.mediaUrls.filter(url => !isVideo(url));
    if (imageUrls.length > 0) {
      // Find the index in the filtered array
      const imageIndex = post.mediaUrls.slice(0, index + 1).filter(url => !isVideo(url)).length - 1;
      setViewingImages({ urls: imageUrls, index: Math.max(0, imageIndex) });
    }
  };

  const renderPostMedia = (post: Post) => {
    if (post.mediaUrls.length === 0) return null;

    const currentIndex = postImageIndices[post.id] || 0;
    const imageCount = post.mediaUrls.length;

    return (
      <View style={styles.mediaWrapper}>
        <ScrollView
          ref={(ref: any) => {
            postScrollRefs.current[post.id] = ref;
          }}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.mediaContainer}
          onMomentumScrollEnd={(event: any) => {
            const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
            setPostImageIndices((prev: Record<string, number>) => ({
              ...prev,
              [post.id]: newIndex,
            }));
          }}
          onScrollBeginDrag={() => {
            // Initialize index if not set
            if (postImageIndices[post.id] === undefined) {
              setPostImageIndices((prev: Record<string, number>) => ({
                ...prev,
                [post.id]: 0,
              }));
            }
          }}
        >
          {post.mediaUrls.map((url, index) => {
            if (isVideo(url)) {
              return (
                <Video
                  key={index}
                  source={{ uri: url }}
                  style={styles.postImage}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                />
              );
            }
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.9}
                onPress={() => handleImagePress(post, index)}
                style={styles.postImageTouchable}
              >
                <Image
                  source={{ uri: url }}
                  style={styles.postImage}
                  contentFit="cover"
                  onError={(error) => {
                    console.error('Error loading feed image:', error);
                  }}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        
        {/* Dot Indicators */}
        {imageCount > 1 && (
          <View style={styles.dotsContainer}>
            {post.mediaUrls.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  const buildAdCta = (ad: Advertisement) => {
    const label = ad.ctaType === 'whatsapp'
      ? 'Message on WhatsApp'
      : ad.ctaType === 'messenger'
      ? 'Message on Messenger'
      : 'Learn More';

    if (ad.ctaType === 'whatsapp' && ad.ctaPhone) {
      const msg = encodeURIComponent(ad.ctaMessage || '');
      return {
        url: `https://wa.me/${ad.ctaPhone}${msg ? `?text=${msg}` : ''}`,
        label: 'WhatsApp',
        icon: 'whatsapp',
      };
    }
    if (ad.ctaType === 'messenger' && ad.ctaMessengerId) {
      return {
        url: `https://m.me/${ad.ctaMessengerId}`,
        label: 'Message',
        icon: 'messenger',
      };
    }
    const url = ad.ctaUrl || ad.linkUrl;
    return { url, label, icon: 'link' };
  };

  const handleAdPress = async (ad: Advertisement) => {
    await recordAdClick(ad.id);
    const cta = buildAdCta(ad);
    if (cta.url) {
      await WebBrowser.openBrowserAsync(cta.url);
    }
  };

  const renderBannerAd = (ad: Advertisement) => {
    const cta = buildAdCta(ad);
    // Prevent duplicate impressions
    if (!recordedImpressions.current.has(ad.id)) {
      recordAdImpression(ad.id);
      recordedImpressions.current.add(ad.id);
    }
    return (
      <TouchableOpacity
        key={`ad-banner-${ad.id}`}
        style={styles.bannerAdCard}
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
          {ad.description && (
            <Text style={styles.bannerAdDescription} numberOfLines={1}>
              {ad.description}
            </Text>
          )}
          {cta.url && (
            <View style={styles.bannerAdLinkButton}>
              <Text style={styles.bannerAdLinkText}>{cta.label || 'Learn More'}</Text>
              <ExternalLink size={14} color={colors.primary} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCardAd = (ad: Advertisement) => {
    const cta = buildAdCta(ad);
    // Prevent duplicate impressions
    if (!recordedImpressions.current.has(ad.id)) {
      recordAdImpression(ad.id);
      recordedImpressions.current.add(ad.id);
    }
    const sponsorInitial = (ad.sponsorName || 'Sponsored').charAt(0).toUpperCase();
    const sponsorPhoto = ad.userId ? adUserPhotos[ad.userId] : null;
    const isAdOwner = ad.userId === currentUser?.id;
    
    // Get original post/reel for engagement
    const originalPost = ad.promotedPostId ? adOriginalPosts[ad.id] : null;
    const originalReel = ad.promotedReelId ? adOriginalReels[ad.id] : null;
    
    // Get likes and comments from original content
    const adLikesList = adLikes[ad.id] || [];
    const adCommentsList = adComments[ad.id] || [];
    const isLiked = currentUser ? adLikesList.includes(currentUser.id) : false;
    const isDescriptionExpanded = expandedAdDescriptions.has(ad.id);
    const descriptionLines = 3;
    const shouldShowSeeMore = ad.description && ad.description.length > 150;

    const renderDescriptionWithLinks = (value: string) => {
      const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
      const parts: { text: string; isLink: boolean }[] = [];
      let lastIndex = 0;

      value.replace(urlRegex, (match, _p1, _p2, offset) => {
        if (typeof offset === 'number' && offset > lastIndex) {
          parts.push({ text: value.slice(lastIndex, offset), isLink: false });
        }
        parts.push({ text: match, isLink: true });
        lastIndex = (offset as number) + match.length;
        return match;
      });

      if (lastIndex < value.length) {
        parts.push({ text: value.slice(lastIndex), isLink: false });
      }

      const handleOpenUrl = async (rawUrl: string) => {
        const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
        try {
          await WebBrowser.openBrowserAsync(url);
        } catch (e) {
          console.warn('Failed to open ad description url', e);
        }
      };

      return (
        <Text
          style={styles.adDescription}
          numberOfLines={isDescriptionExpanded ? undefined : descriptionLines}
        >
          {parts.map((part, idx) =>
            part.isLink ? (
              <Text
                key={`link-${idx}`}
                style={styles.adDescriptionLink}
                onPress={() => handleOpenUrl(part.text)}
              >
                {part.text}
              </Text>
            ) : (
              <Text key={`text-${idx}`}>{part.text}</Text>
            ),
          )}
        </Text>
      );
    };
    
    // Handle ad engagement - link to original post/reel
    const handleAdLike = async () => {
      try {
        if (originalPost) {
          await toggleLike(originalPost.id);
          // Record engagement if it's a new like
          if (!isLiked) {
            await recordAdEngagement(ad.id, 'like', originalPost.id, undefined);
          }
          // Update local state
          const newLikes = isLiked 
            ? adLikesList.filter(id => id !== currentUser.id)
            : [...adLikesList, currentUser.id];
          setAdLikes(prev => ({ ...prev, [ad.id]: newLikes }));
        } else if (originalReel && toggleReelLike) {
          await toggleReelLike(originalReel.id);
          // Record engagement if it's a new like
          if (!isLiked) {
            await recordAdEngagement(ad.id, 'like', undefined, originalReel.id);
          }
          // Update local state
          const newLikes = isLiked 
            ? adLikesList.filter(id => id !== currentUser.id)
            : [...adLikesList, currentUser.id];
          setAdLikes(prev => ({ ...prev, [ad.id]: newLikes }));
        } else {
          Alert.alert('Error', 'This ad is not linked to a post or reel. Engagement is not available for standalone ads.');
        }
      } catch (error: any) {
        console.error('Error liking ad:', error);
        Alert.alert('Error', error?.message || 'Failed to like. Please try again.');
      }
    };

    const handleAdComment = () => {
      if (!originalPost && !originalReel) {
        Alert.alert('Error', 'This ad is not linked to a post or reel. Comments are not available for standalone ads.');
        return;
      }
      setShowAdComments(ad.id);
    };

    const handleAdShare = async () => {
      try {
        if (originalPost) {
          await sharePost(originalPost.id);
          // Record engagement
          await recordAdEngagement(ad.id, 'share', originalPost.id, undefined);
        } else if (originalReel && shareReel) {
          await shareReel(originalReel.id);
          // Record engagement
          await recordAdEngagement(ad.id, 'share', undefined, originalReel.id);
        } else {
          Alert.alert('Error', 'This ad is not linked to a post or reel. Sharing is not available for standalone ads.');
        }
      } catch (error: any) {
        console.error('Error sharing ad:', error);
        Alert.alert('Error', error?.message || 'Failed to share. Please try again.');
      }
    };

    const handleAdAddComment = async (postId: string, content: string, parentCommentId?: string, stickerId?: string, messageType?: 'text' | 'sticker') => {
      try {
        console.log('handleAdAddComment called:', { postId, content, adId: ad.id, originalPost: originalPost?.id, originalReel: originalReel?.id });
        
        // Determine if this is a post or reel based on what we have
        const targetPostId = originalPost?.id;
        const targetReelId = originalReel?.id;
        
        // Check if postId matches our original post
        if (targetPostId && postId === targetPostId) {
          console.log('Adding comment to post:', targetPostId);
          const result = await addComment(targetPostId, content, parentCommentId, stickerId, messageType);
          if (result === null) {
            console.log('Comment add returned null (user restricted or error)');
            return;
          }
          // Record engagement (only for top-level comments, not replies)
          if (!parentCommentId) {
            await recordAdEngagement(ad.id, 'comment', targetPostId, undefined);
          }
          // Refresh comments after a short delay to allow state to update
          setTimeout(() => {
            const updatedComments = getComments(targetPostId);
            console.log('Refreshed post comments:', updatedComments.length);
            setAdComments(prev => ({ ...prev, [ad.id]: updatedComments }));
          }, 300);
        } 
        // Check if postId matches our original reel
        else if (targetReelId && postId === targetReelId && addReelComment) {
          console.log('Adding comment to reel:', targetReelId);
          const result = await addReelComment(targetReelId, content, parentCommentId, stickerId, messageType);
          if (result === null) {
            console.log('Reel comment add returned null (user restricted or error)');
            return;
          }
          // Record engagement (only for top-level comments, not replies)
          if (!parentCommentId) {
            await recordAdEngagement(ad.id, 'comment', undefined, targetReelId);
          }
          // Refresh comments - wait a bit for state to update
          setTimeout(() => {
            const updatedComments = getReelComments(targetReelId) || [];
            console.log('Refreshed reel comments:', updatedComments.length);
            setAdComments(prev => ({ ...prev, [ad.id]: updatedComments }));
          }, 500);
        } 
        // Fallback: try to determine from postId directly
        else if (originalPost && postId === originalPost.id) {
          console.log('Fallback: Adding comment to post:', postId);
          const result = await addComment(postId, content, parentCommentId, stickerId, messageType);
          if (result === null) return;
          if (!parentCommentId) {
            await recordAdEngagement(ad.id, 'comment', postId, undefined);
          }
          setTimeout(() => {
            const updatedComments = getComments(postId);
            setAdComments(prev => ({ ...prev, [ad.id]: updatedComments }));
          }, 300);
        } 
        else if (originalReel && postId === originalReel.id && addReelComment) {
          console.log('Fallback: Adding comment to reel:', postId);
          const result = await addReelComment(postId, content, parentCommentId, stickerId, messageType);
          if (result === null) return;
          if (!parentCommentId) {
            await recordAdEngagement(ad.id, 'comment', undefined, postId);
          }
          setTimeout(() => {
            const updatedComments = getReelComments(postId) || [];
            setAdComments(prev => ({ ...prev, [ad.id]: updatedComments }));
          }, 500);
        } 
        else {
          console.error('Ad comment error: No matching post or reel found', { postId, adId: ad.id, originalPost: originalPost?.id, originalReel: originalReel?.id });
          Alert.alert('Error', 'This ad is not linked to a post or reel. Comments are not available for standalone ads.');
          throw new Error('Ad not linked to post or reel');
        }
      } catch (error: any) {
        console.error('Add comment error:', error);
        const errorMessage = extractErrorMessage(error);
        Alert.alert('Add comment error', errorMessage);
        // Re-throw so CommentsModal can handle it
        throw error;
      }
    };
    
    return (
      <View key={`ad-card-${ad.id}`} style={styles.adCard}>
        {/* Facebook-style header: Profile photo, name, Sponsored tag */}
        <View style={styles.adHeader}>
          <TouchableOpacity
            style={styles.adSponsorInfo}
            onPress={() => ad.userId && router.push(`/profile/${ad.userId}` as any)}
            disabled={!ad.userId}
          >
            {sponsorPhoto ? (
              <Image
                source={{ uri: sponsorPhoto }}
                style={styles.adAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.adAvatar}>
                <Text style={styles.adAvatarText}>{sponsorInitial}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.adSponsorName}>{ad.sponsorName || 'Sponsored'}</Text>
                {!!ad.sponsorVerified && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedTick}>✓</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.adSponsoredText}>Sponsored</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Facebook-style description with "See more" - ABOVE the image */}
        <View style={styles.adContent}>
          {ad.title && (
            <Text style={styles.adTitle}>{ad.title}</Text>
          )}
          {ad.description && (
            <View>
              {renderDescriptionWithLinks(ad.description)}
              {shouldShowSeeMore && (
                <TouchableOpacity
                  onPress={() => {
                    if (isDescriptionExpanded) {
                      setExpandedAdDescriptions(prev => {
                        const next = new Set(prev);
                        next.delete(ad.id);
                        return next;
                      });
                    } else {
                      setExpandedAdDescriptions(prev => new Set([...prev, ad.id]));
                    }
                  }}
                >
                  <Text style={styles.seeMoreText}>
                    {isDescriptionExpanded ? 'See less' : 'See more'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Ad image */}
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => handleAdPress(ad)}
        >
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
        </TouchableOpacity>

        {/* Button row: See insights on left, CTA on right */}
        <View style={styles.adButtonRow}>
          {isAdOwner && (
            <TouchableOpacity
              style={styles.adInsightsButton}
              onPress={() => router.push('/ads' as any)}
            >
              <Text style={styles.adInsightsButtonText}>See insights & ads</Text>
            </TouchableOpacity>
          )}
          {cta.url && (
            <TouchableOpacity
              style={styles.adCTAButton}
              onPress={() => handleAdPress(ad)}
            >
              <Text style={styles.adCTAButtonText}>{cta.label || 'Learn More'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Facebook-style engagement: Likes, Comments, Shares */}
        <View style={styles.adEngagementRow}>
          <View style={styles.adEngagementCounts}>
            {adLikesList.length > 0 && (
              <View style={styles.adEngagementItem}>
                <Heart size={16} color={colors.primary} fill={colors.primary} />
                <Text style={styles.adEngagementCountText}>{adLikesList.length}</Text>
              </View>
            )}
            {adCommentsList.length > 0 && (
              <TouchableOpacity 
                style={styles.adEngagementItem}
                onPress={() => setShowAdComments(ad.id)}
              >
                <Text style={styles.adEngagementCountText}>
                  {adCommentsList.length} {adCommentsList.length === 1 ? 'comment' : 'comments'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Facebook-style action buttons: Like, Comment, Share */}
        <View style={styles.adActionButtons}>
          <TouchableOpacity
            style={styles.adActionButton}
            onPress={handleAdLike}
          >
            <Heart
              size={20}
              color={isLiked ? colors.primary : colors.text.secondary}
              fill={isLiked ? colors.primary : 'transparent'}
            />
            <Text style={[styles.adActionButtonText, isLiked && { color: colors.primary }]}>
              Like
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adActionButton}
            onPress={handleAdComment}
          >
            <MessageCircle size={20} color={colors.text.secondary} />
            <Text style={styles.adActionButtonText}>Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adActionButton}
            onPress={handleAdShare}
          >
            <Share2 size={20} color={colors.text.secondary} />
            <Text style={styles.adActionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Comments Modal for Ad */}
        {showAdComments === ad.id && (originalPost || originalReel) && (
          <CommentsModal
            postId={originalPost?.id || originalReel?.id || ''}
            visible={true}
            onClose={() => setShowAdComments(null)}
            comments={adCommentsList}
            colors={colors}
            styles={styles}
            addComment={handleAdAddComment}
            editComment={originalPost ? editComment : async () => false}
            deleteComment={originalPost ? deleteComment : async () => false}
            toggleCommentLike={originalPost ? toggleCommentLike : async () => false}
          />
        )}
      </View>
    );
  };

  const renderVideoAd = (ad: Advertisement) => {
    // Prevent duplicate impressions
    if (!recordedImpressions.current.has(ad.id)) {
      recordAdImpression(ad.id);
      recordedImpressions.current.add(ad.id);
    }
    return (
      <View key={`ad-video-${ad.id}`} style={styles.videoAdCard}>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>Sponsored</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleAdPress(ad)}
          activeOpacity={0.9}
        >
          <Video
            source={{ uri: ad.imageUrl }}
            style={styles.videoAdImage}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            onError={(error: any) => {
              console.error('Failed to load video ad:', ad.id, error);
              Alert.alert('Error', 'Failed to load video advertisement');
            }}
          />
        </TouchableOpacity>
        <View style={styles.adContent}>
          <Text style={styles.adTitle}>{ad.title}</Text>
          <Text style={styles.adDescription} numberOfLines={2}>
            {ad.description}
          </Text>
          {ad.linkUrl && (
            <View style={styles.adLinkButton}>
              <Text style={styles.adLinkText}>Learn More</Text>
              <ExternalLink size={16} color={colors.primary} />
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderAd = (ad: Advertisement) => {
    // Record impression when ad is rendered (for analytics and rotation)
    // This will be used by getSmartAds to rotate ads naturally
    switch (ad.type) {
      case 'banner':
        return renderBannerAd(ad);
      case 'video':
        return renderVideoAd(ad);
      case 'card':
      default:
        return renderCardAd(ad);
    }
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deletePost(postId);
            if (success) {
              Alert.alert('Success', 'Post deleted successfully');
            } else {
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
    setShowPostMenu(null);
  };

  const uploadMedia = async (uris: string[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const uri of uris) {
      try {
        // Check if it's already a URL (existing media) or a local URI (new media)
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          uploadedUrls.push(uri);
          continue;
        }

        // Determine file type
        const isVideo = uri.includes('video') || uri.includes('.mp4') || uri.includes('.mov');
        const fileName = isVideo 
          ? `post_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`
          : `post_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        
        // Convert URI to Uint8Array using legacy API (no deprecation warnings)
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        const uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }
        
        const { error } = await supabase.storage
          .from('media')
          .upload(fileName, uint8Array, {
            contentType: isVideo ? 'video/mp4' : 'image/jpeg',
            upsert: false,
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.error('Failed to upload media:', error);
        throw error;
      }
    }
    
    return uploadedUrls;
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post.id);
    setEditContent(post.content);
    setEditMediaUrls([...post.mediaUrls]);
    setShowPostMenu(null);
  };

  const handlePickMedia = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'You need to allow access to your photos and videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets) {
      const urls = result.assets.map((asset: any) => asset.uri);
      setEditMediaUrls([...editMediaUrls, ...urls]);
    }
  };

  const handleRemoveMedia = (index: number) => {
    setEditMediaUrls(editMediaUrls.filter((_: any, i: number) => i !== index));
  };

  const handleSaveEdit = async (postId: string) => {
    const post = posts.find((p: any) => p.id === postId);
    if (!post) return;
    
    setIsUploadingMedia(true);
    try {
      // Upload new media (local URIs) and keep existing media (URLs)
      const uploadedMediaUrls = await uploadMedia(editMediaUrls);
      
      // Determine media type
      const hasVideo = uploadedMediaUrls.some(url => url.includes('video') || url.includes('.mp4') || url.includes('.mov'));
      const hasImage = uploadedMediaUrls.some(url => !url.includes('video') && !url.includes('.mp4') && !url.includes('.mov'));
      let mediaType: 'image' | 'video' | 'mixed' = 'image';
      if (hasVideo && hasImage) {
        mediaType = 'mixed';
      } else if (hasVideo) {
        mediaType = 'video';
      }
      
      const success = await editPost(postId, editContent, uploadedMediaUrls, mediaType);
      if (success) {
        setEditingPost(null);
        setEditContent('');
        setEditMediaUrls([]);
        Alert.alert('Success', 'Post updated successfully');
      } else {
        Alert.alert('Error', 'Failed to update post');
      }
    } catch (error) {
      console.error('Failed to save edit:', error);
      Alert.alert('Error', 'Failed to upload media. Please try again.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleAdminDeletePost = async (postId: string) => {
    Alert.alert(
      'Delete Post (Admin)',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await adminDeletePost(postId);
            if (success) {
              Alert.alert('Success', 'Post deleted successfully');
            } else {
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
    setShowPostMenu(null);
  };

  const handleAdminRejectPost = async (postId: string) => {
    Alert.alert(
      'Reject Post (Admin)',
      'Are you sure you want to reject this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            const success = await adminRejectPost(postId, 'Rejected by admin');
            if (success) {
              Alert.alert('Success', 'Post rejected successfully');
            } else {
              Alert.alert('Error', 'Failed to reject post');
            }
          },
        },
      ]
    );
    setShowPostMenu(null);
  };

  const renderPost = (post: Post) => {
    const isLiked = post.likes.includes(currentUser.id);
    const postComments = getComments(post.id);
    const isOwner = post.userId === currentUser.id;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'moderator';
    const isBoosted = boostedPostIds.has(post.id);

    return (
      <View key={post.id} style={styles.post}>
        <View style={styles.postHeader}>
          <TouchableOpacity 
            style={styles.postUserInfo}
            onPress={() => router.push(`/profile/${post.userId}` as any)}
          >
            <View style={styles.postAvatarContainer}>
              {post.userAvatar ? (
                <Image
                  source={{ uri: post.userAvatar }}
                  style={styles.postAvatar}
                />
              ) : (
                <View style={styles.postAvatarPlaceholder}>
                  <Text style={styles.postAvatarPlaceholderText}>
                    {post.userName?.charAt(0) || '?'}
                  </Text>
                </View>
              )}
              {postStatuses[post.userId] && (
                <StatusIndicator 
                  status={postStatuses[post.userId].statusType} 
                  size="small" 
                  showBorder={true}
                />
              )}
            </View>
            <View>
              <Text style={styles.postUserName}>{post.userName}</Text>
              <Text style={styles.postTime}>{formatTimeAgo(post.createdAt)}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowPostMenu(showPostMenu === post.id ? null : post.id)}
          >
            <MoreVertical size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {showPostMenu === post.id && (
          <View style={styles.postMenu}>
            {isOwner && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleEditPost(post)}
                >
                  <Edit2 size={18} color={colors.text.primary} />
                  <Text style={styles.menuItemText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleDeletePost(post.id)}
                >
                  <Trash2 size={18} color={colors.danger} />
                  <Text style={[styles.menuItemText, styles.deleteText]}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowPostMenu(null);
                    router.push({ pathname: '/ads/promote', params: { postId: post.id } });
                  }}
                >
                  <ExternalLink size={18} color={colors.primary} />
                  <Text style={styles.menuItemText}>Boost post</Text>
                </TouchableOpacity>
              </>
            )}
            {isAdmin && !isOwner && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleAdminDeletePost(post.id)}
                >
                  <Trash2 size={18} color={colors.danger} />
                  <Text style={[styles.menuItemText, styles.deleteText]}>Delete (Admin)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleAdminRejectPost(post.id)}
                >
                  <X size={18} color={colors.danger} />
                  <Text style={[styles.menuItemText, styles.deleteText]}>Reject (Admin)</Text>
                </TouchableOpacity>
              </>
            )}
            {!isOwner && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowPostMenu(null);
                  setReportingPost({ id: post.id, userId: post.userId });
                }}
              >
                <Flag size={18} color={colors.danger} />
                <Text style={[styles.menuItemText, styles.deleteText]}>Report</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {editingPost === post.id ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              placeholder="Edit your post..."
              placeholderTextColor={colors.text.tertiary}
            />
            
            {editMediaUrls.length > 0 && (
              <View style={styles.editMediaContainer}>
                {editMediaUrls.map((url: string, index: number) => (
                  <View key={index} style={styles.editMediaWrapper}>
                    <Image
                      source={{ uri: url }}
                      style={styles.editMediaImage}
                      contentFit="cover"
                    />
                    <TouchableOpacity
                      style={styles.editRemoveButton}
                      onPress={() => handleRemoveMedia(index)}
                    >
                      <X size={16} color={colors.text.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity 
              style={styles.addMediaButton}
              onPress={handlePickMedia}
              disabled={isUploadingMedia}
            >
              <ImageIcon size={20} color={colors.primary} />
              <Text style={styles.addMediaText}>Add/Change Media</Text>
            </TouchableOpacity>

            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editButton, styles.cancelButton]}
                onPress={() => {
                  setEditingPost(null);
                  setEditContent('');
                  setEditMediaUrls([]);
                }}
                disabled={isUploadingMedia}
              >
                <Text style={styles.editButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, styles.saveButton, isUploadingMedia && styles.saveButtonDisabled]}
                onPress={() => handleSaveEdit(post.id)}
                disabled={isUploadingMedia}
              >
                {isUploadingMedia ? (
                  <ActivityIndicator size="small" color={colors.text.white} />
                ) : (
                  <Text style={[styles.editButtonText, styles.saveButtonText]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {post.content.length > 0 && (
              <LinkifiedText style={styles.postContent} linkStyle={styles.postContentLink}>
                {post.content}
              </LinkifiedText>
            )}
            {renderPostMedia(post)}
          </>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => toggleLike(post.id)}
          >
            <Heart
              size={24}
              color={isLiked ? colors.danger : colors.text.secondary}
              fill={isLiked ? colors.danger : 'transparent'}
            />
            <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
              {post.likes.length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowComments(post.id)}
          >
            <MessageCircle size={24} color={colors.text.secondary} />
            <Text style={styles.actionText}>{postComments.length || post.commentCount || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => sharePost(post.id)}
          >
            <Share2 size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Facebook-style boost row under the post (owner only) */}
        {isOwner && (
          <View style={styles.boostRow}>
            <TouchableOpacity style={styles.boostSecondaryBtn} onPress={() => router.push('/ads' as any)}>
              <Text style={styles.boostSecondaryText}>
                {isBoosted ? 'See insights & ads' : 'See ads'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.boostPrimaryBtn}
              onPress={() => router.push({ pathname: '/ads/promote', params: { postId: post.id } })}
            >
              <Text style={styles.boostPrimaryText}>
                {isBoosted ? 'Boost again' : 'Boost post'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showComments === post.id && (
          <CommentsModal
            postId={post.id}
            visible={showComments === post.id}
            onClose={() => setShowComments(null)}
            comments={postComments}
            colors={colors}
            styles={styles}
            addComment={addComment}
            editComment={editComment}
            deleteComment={deleteComment}
            toggleCommentLike={toggleCommentLike}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Facebook-style Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            // @ts-ignore - require is available in React Native
            source={require('@/assets/images/icon.png')}
            style={styles.appLogoImage}
            contentFit="contain"
          />
          <Text style={styles.headerTitle}>Committed</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Plus size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => router.push('/(tabs)/messages' as any)}
          >
            <MessageCircle size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Create Content Modal */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCreateModal(false)}
        >
          <View style={styles.createModalContent}>
            <TouchableOpacity
              style={styles.createOption}
              onPress={() => {
                setShowCreateModal(false);
                router.push('/status/create' as any);
              }}
            >
              <View style={[styles.createOptionIcon, { backgroundColor: colors.primary + '20' }]}>
                <Camera size={24} color={colors.primary} />
              </View>
              <View style={styles.createOptionText}>
                <Text style={styles.createOptionTitle}>Create Status</Text>
                <Text style={styles.createOptionSubtitle}>Share a photo or video story</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.createOption}
              onPress={() => {
                setShowCreateModal(false);
                router.push('/post/create' as any);
              }}
            >
              <View style={[styles.createOptionIcon, { backgroundColor: colors.secondary + '20' }]}>
                <FileText size={24} color={colors.secondary} />
              </View>
              <View style={styles.createOptionText}>
                <Text style={styles.createOptionTitle}>Create Post</Text>
                <Text style={styles.createOptionSubtitle}>Share a post with text and media</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.createOption}
              onPress={() => {
                setShowCreateModal(false);
                router.push('/reel/create' as any);
              }}
            >
              <View style={[styles.createOptionIcon, { backgroundColor: '#E41E3F' + '20' }]}>
                <VideoIcon size={24} color="#E41E3F" />
              </View>
              <View style={styles.createOptionText}>
                <Text style={styles.createOptionTitle}>Create Reel</Text>
                <Text style={styles.createOptionSubtitle}>Share a short video reel</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.createModalCancel}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.createModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Facebook-Style Stories Bar with "What's on your mind?" - Inside ScrollView (static, scrolls with content) */}
        <FacebookStyleStoriesBar context="feed" />
        {posts.length === 0 ? (
          <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
            <Heart size={80} color={colors.text.tertiary} strokeWidth={1.5} />
            <Text style={styles.emptyStateTitle}>No Posts Yet</Text>
            <Text style={styles.emptyStateText}>
              Be the first to share your relationship journey!
              Create a post to get started.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => router.push('/post/create' as any)}
            >
              <Plus size={20} color={colors.text.white} />
              <Text style={styles.emptyStateButtonText}>Create Your First Post</Text>
            </TouchableOpacity>
            <Text style={styles.emptyStateNote}>
              💡 Tip: Run the seed-sample-data.sql script in Supabase to see sample posts
            </Text>
          </Animated.View>
        ) : (
          personalizedPosts.map((post: any, index: number) => {
            // Smart ad distribution: show ad every 3 posts using smart algorithm
            // Algorithm ensures rotation - ads that were shown recently will have lower scores
            // and different ads will be selected, but ads can still appear again later
            const shouldShowAd = (index + 1) % 3 === 0 && smartAds.length > 0;
            // Use modulo to cycle through ads, ensuring rotation
            const adIndex = Math.floor(index / 3) % smartAds.length;
            const ad = shouldShowAd ? smartAds[adIndex] : null;
            
            return (
              <React.Fragment key={post.id}>
                {renderPost(post)}
                {ad && renderAd(ad)}
              </React.Fragment>
            );
          })
        )}
      </ScrollView>

      {/* Full-screen Image Viewer Modal */}
      {viewingImages && (
        <Modal
          visible={!!viewingImages}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setViewingImages(null)}
        >
          <View style={styles.imageViewerContainer}>
            <TouchableOpacity
              style={styles.imageViewerCloseButton}
              onPress={() => setViewingImages(null)}
            >
              <X size={24} color={colors.text.white} />
            </TouchableOpacity>
            
            <ScrollView
              ref={imageViewerScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event: any) => {
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                setViewingImages((prev: any) => prev ? { ...prev, index: newIndex } : null);
              }}
              style={styles.imageViewerScroll}
              contentOffset={{ x: viewingImages.index * Dimensions.get('window').width, y: 0 }}
            >
              {viewingImages.urls.map((url: string, index: number) => (
                <View key={index} style={styles.imageViewerItem}>
                  <Image
                    source={{ uri: url }}
                    style={styles.imageViewerImage}
                    contentFit="contain"
                  />
                </View>
              ))}
            </ScrollView>
            
            {viewingImages.urls.length > 1 && (
              <View style={styles.imageViewerIndicator}>
                <Text style={styles.imageViewerIndicatorText}>
                  {viewingImages.index + 1} / {viewingImages.urls.length}
                </Text>
              </View>
            )}
            </View>
          </Modal>
        )}

        {/* Report Content Modal */}
        <ReportContentModal
          visible={!!reportingPost}
          onClose={() => setReportingPost(null)}
          contentType="post"
          contentId={reportingPost?.id}
          reportedUserId={reportingPost?.userId}
          onReport={reportContent}
          colors={colors}
        />
      </SafeAreaView>
    );
  }

// Helper function to extract readable error messages
const extractErrorMessage = (error: any): string => {
  if (!error) return 'An unknown error occurred.';
  
  // Check for Supabase error format
  if (error.message) return error.message;
  if (error.error?.message) return error.error.message;
  if (error.details) return error.details;
  if (error.hint) return error.hint;
  if (error.code) return `Error ${error.code}: ${error.message || 'Unknown error'}`;
  
  // Check for string errors
  if (typeof error === 'string') return error;
  
  // Try to extract from object
  if (typeof error === 'object') {
    try {
      // Check common error properties
      if (error.toString && error.toString() !== '[object Object]') {
        const str = error.toString();
        if (str.startsWith('Error:') || str.startsWith('TypeError:') || str.startsWith('ReferenceError:')) {
          return str;
        }
      }
      
      // Try JSON stringify
      const errorStr = JSON.stringify(error);
      if (errorStr && errorStr !== '{}' && errorStr !== 'null') {
        const parsed = JSON.parse(errorStr);
        return parsed.message || parsed.error || parsed.details || parsed.hint || `Error: ${errorStr.substring(0, 100)}`;
      }
    } catch {
      // If all else fails, return generic message
    }
  }
  
  return 'Failed to add comment. Please try again.';
};

function CommentsModal({
  postId,
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
  postId: string;
  visible: boolean;
  onClose: () => void;
  comments: any[];
  colors: any;
  styles: any;
  addComment: (postId: string, content: string, parentCommentId?: string, stickerId?: string, messageType?: 'text' | 'sticker') => Promise<any>;
  editComment: (commentId: string, content: string) => Promise<any>;
  deleteComment: (commentId: string) => Promise<boolean>;
  toggleCommentLike: (commentId: string, postId: string) => Promise<boolean>;
}) {
  const { currentUser, reportContent } = useApp();
  const [commentText, setCommentText] = useState<string>('');
  const [selectedSticker, setSelectedSticker] = useState<{ id: string; imageUrl: string } | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [reportingComment, setReportingComment] = useState<{ id: string; userId: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState<string>('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const handleSubmit = async () => {
    try {
      if (replyingTo && (replyText.trim() || selectedSticker)) {
        await addComment(
          postId, 
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
          postId, 
          commentText.trim(),
          undefined,
          selectedSticker?.id,
          selectedSticker ? 'sticker' : 'text'
        );
        setCommentText('');
        setSelectedSticker(null);
      }
    } catch (error: any) {
      console.error('Error submitting comment:', error);
      const errorMessage = extractErrorMessage(error);
      Alert.alert('Add comment error', errorMessage);
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
          {comments.map((comment) => {
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
                        {comment.userName?.charAt(0) || '?'}
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
                        onPress={() => toggleCommentLike(comment.id, postId)}
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
                                  {reply.userName?.charAt(0) || '?'}
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
                                  onPress={() => toggleCommentLike(reply.id, postId)}
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
          })}
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
