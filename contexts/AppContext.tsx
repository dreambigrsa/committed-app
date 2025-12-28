import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { User, Relationship, RelationshipRequest, Post, Reel, Comment, Conversation, Message, Advertisement, Notification, CheatingAlert, Follow, Dispute, CoupleCertificate, Anniversary, ReportedContent, ReelComment, NotificationType, MessageWarning, InfidelityReport, TriggerWord, LegalDocument, UserStatus, UserStatusType, StatusVisibility } from '@/types';
import { supabase } from '@/lib/supabase';
import { Session, RealtimeChannel } from '@supabase/supabase-js';
import { checkUserLegalAcceptances } from '@/lib/legal-enforcement';
import { registerForPushNotificationsAsync, showLocalNotification } from '@/lib/push-notifications';
import { setNotificationPreferences } from '@/lib/notification-preferences';
import { normalizePhoneNumber, comparePhoneNumbers } from '@/lib/phone-normalization';
import { queueRelationshipChange, syncOfflineQueue, getOfflineQueue, RelationshipConflict } from '@/lib/relationship-sync';

export const [AppContext, useApp] = createContextHook(() => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [relationshipRequests, setRelationshipRequests] = useState<RelationshipRequest[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cheatingAlerts, setCheatingAlerts] = useState<CheatingAlert[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [certificates, setCertificates] = useState<CoupleCertificate[]>([]);
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [coupleLevel, setCoupleLevel] = useState<any>(null);
  const [reelComments, setReelComments] = useState<Record<string, ReelComment[]>>({});
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]); // Array of blocked user IDs
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const subscriptionsRef = useRef<RealtimeChannel[]>([]);
  const notificationPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [userStatuses, setUserStatuses] = useState<Record<string, UserStatus>>({}); // userId -> UserStatus
  const statusUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [statusRealtimeChannels, setStatusRealtimeChannels] = useState<RealtimeChannel[]>([]);
  const isLoggingOutRef = useRef<boolean>(false); // Track if logout is in progress
  
  // Ban modal state
  const [banModalVisible, setBanModalVisible] = useState(false);
  const [banModalData, setBanModalData] = useState<{
    reason: string;
    restrictionType: 'full_ban' | 'feature_restriction';
    restrictedFeature?: string;
    restrictionId?: string;
  } | null>(null);

  // Legal acceptance state
  const [legalAcceptanceStatus, setLegalAcceptanceStatus] = useState<{
    hasAllRequired: boolean;
    missingDocuments: LegalDocument[];
    needsReAcceptance: LegalDocument[];
  } | null>(null);

  // Onboarding state
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  
  // Helper function to show ban modal
  const showBanModal = useCallback((restriction: {
    restricted: boolean;
    reason?: string;
    restrictionType?: 'full_ban' | 'feature_restriction';
    restrictedFeature?: string;
    restrictionId?: string;
  }) => {
    if (restriction.restricted) {
      setBanModalData({
        reason: restriction.reason || 'Your account has been restricted',
        restrictionType: restriction.restrictionType || 'feature_restriction',
        restrictedFeature: restriction.restrictedFeature,
        restrictionId: restriction.restrictionId,
      });
      setBanModalVisible(true);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadUserData(session.user.id);
    } else if (session === null) {
      // Session cleared (logout)
      setCurrentUser(null);
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const initializeAuth = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        setSession(newSession);
        
        // Handle email confirmation
        if (event === 'SIGNED_IN' && newSession?.user) {
          const emailConfirmed = !!newSession.user.email_confirmed_at;
          if (emailConfirmed) {
            // Email was just confirmed, reload user data
            await loadUserData(newSession.user.id);
          }
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      setIsLoading(true);
      console.log('Loading user data for:', userId);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError && userError.code === 'PGRST116') {
        console.log('User not found in database. Creating user record...');
        await createUserRecord(userId);
        return;
      }

      if (userError) {
        console.error('User data error:', JSON.stringify(userError, null, 2));
        throw userError;
      }
      
      if (userData) {
        const user: User = {
          id: userData.id,
          fullName: userData.full_name,
          username: userData.username,
          email: userData.email,
          phoneNumber: userData.phone_number,
          profilePicture: userData.profile_picture,
          role: userData.role,
          verifications: {
            phone: userData.phone_verified,
            email: userData.email_verified,
            id: userData.id_verified,
          },
          createdAt: userData.created_at,
        };
        setCurrentUser(user);

        // Load notification prefs early so foreground notifications respect sound settings.
        hydrateNotificationPreferences(user.id).catch(() => {});

        // Register for OS-level notifications and store the Expo push token for backend delivery.
        // (No-op on simulators/emulators.)
        registerForPushNotificationsAsync(user.id).catch(() => {
          // Errors are already logged in the helper; avoid breaking login flow.
        });

        // Load user status
        await loadUserStatus(user.id);
        
        // Set status to online immediately on login
        const now = new Date().toISOString();
        const { error: statusError } = await supabase
          .from('user_status')
          .update({
            status_type: 'online',
            last_active_at: now,
            updated_at: now,
          })
          .eq('user_id', user.id);

        if (!statusError) {
          setUserStatuses(prev => ({
            ...prev,
            [user.id]: {
              userId: user.id,
              statusType: 'online',
              lastActiveAt: now,
              statusVisibility: 'everyone',
              lastSeenVisibility: 'everyone',
              updatedAt: now,
            } as UserStatus,
          }));
        }
        
        // Start status tracking
        startStatusTracking();

        // Check legal acceptances after user is loaded
        try {
          const acceptanceStatus = await checkUserLegalAcceptances(user.id);
          setLegalAcceptanceStatus(acceptanceStatus);
        } catch (error) {
          console.error('Failed to check legal acceptances:', error);
        }

        // Check onboarding status
        try {
          const { data: onboardingData } = await supabase
            .from('user_onboarding_data')
            .select('has_completed_onboarding')
            .eq('user_id', user.id)
            .maybeSingle();
          
          setHasCompletedOnboarding(onboardingData?.has_completed_onboarding ?? false);
        } catch (error) {
          console.error('Failed to check onboarding status:', error);
          setHasCompletedOnboarding(false);
        }

        // Check and link any relationships where this user's phone number was registered
        // This handles cases where user was created via trigger or if linking failed during signup
        await checkAndLinkRelationships(user.id, user.phoneNumber);

        // Sync any pending offline relationship changes
        try {
          const queue = await getOfflineQueue();
          if (queue.length > 0) {
            console.log(`Syncing ${queue.length} pending relationship changes...`);
            const result = await syncOfflineQueue();
            console.log(`Sync complete: ${result.synced} synced, ${result.conflicts} conflicts, ${result.errors} errors`);
          }
        } catch (syncError) {
          console.error('Error syncing offline queue:', syncError);
        }
      }

      const { data: postsData } = await supabase
        .from('posts')
        .select(`
          *,
          users!posts_user_id_fkey(full_name, profile_picture)
        `)
        .or(`moderation_status.eq.approved,user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);
      
      // Deduplicate posts by ID (in case the OR query returns duplicates)
      const uniquePostsData = postsData ? Array.from(
        new Map(postsData.map((p: any) => [p.id, p])).values()
      ) : [];

      const { data: postLikesData } = await supabase
        .from('post_likes')
        .select('post_id, user_id');

      if (uniquePostsData) {
        const formattedPosts: Post[] = uniquePostsData.map((p: any) => {
          const likes = postLikesData
            ?.filter((like: any) => like.post_id === p.id)
            .map((like: any) => like.user_id) || [];
          return {
            id: p.id,
            userId: p.user_id,
            userName: p.users.full_name,
            userAvatar: p.users.profile_picture,
            content: p.content,
            mediaUrls: p.media_urls || [],
            mediaType: p.media_type,
            likes,
            commentCount: p.comment_count,
            createdAt: p.created_at,
          };
        });
        
        // Sort posts by createdAt (newest first) - chronological order like Facebook
        const sortedPosts = formattedPosts.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        setPosts(sortedPosts);
      }

      // Load reels: show approved reels or user's own reels (regardless of status)
      // Try 'status' column first (from migration), then try 'moderation_status', then show all
      let { data: reelsData, error: reelsError } = await supabase
        .from('reels')
        .select(`
          *,
          users!reels_user_id_fkey(full_name, profile_picture)
        `)
        .or(`status.eq.approved,user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);
      
      // If status column doesn't exist, try moderation_status
      if (reelsError) {
        const { data: reelsDataModStatus } = await supabase
          .from('reels')
          .select(`
            *,
            users!reels_user_id_fkey(full_name, profile_picture)
          `)
          .or(`moderation_status.eq.approved,user_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (reelsDataModStatus) {
          reelsData = reelsDataModStatus;
        } else {
          // If neither column exists, show all reels
          const { data: allReels } = await supabase
            .from('reels')
            .select(`
              *,
              users!reels_user_id_fkey(full_name, profile_picture)
            `)
            .order('created_at', { ascending: false })
            .limit(50);
          reelsData = allReels;
        }
      }

      const { data: reelLikesData } = await supabase
        .from('reel_likes')
        .select('reel_id, user_id');

      if (reelsData) {
        const formattedReels: Reel[] = reelsData.map((r: any) => {
          const likes = reelLikesData
            ?.filter((like: any) => like.reel_id === r.id)
            .map((like: any) => like.user_id) || [];
          return {
            id: r.id,
            userId: r.user_id,
            userName: r.users.full_name,
            userAvatar: r.users.profile_picture,
            videoUrl: r.video_url,
            thumbnailUrl: r.thumbnail_url,
            caption: r.caption,
            likes,
            commentCount: r.comment_count,
            viewCount: r.view_count,
            createdAt: r.created_at,
          };
        });
        setReels(formattedReels);
      }

      const { data: adsData } = await supabase
        .from('advertisements')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (adsData) {
        const formattedAds: Advertisement[] = adsData.map((ad: any) => ({
          id: ad.id,
          title: ad.title,
          description: ad.description,
          imageUrl: ad.image_url,
          linkUrl: ad.link_url,
          type: ad.type,
          placement: ad.placement,
          active: ad.active,
          impressions: ad.impressions,
          clicks: ad.clicks,
          createdBy: ad.created_by,
          createdAt: ad.created_at,
          updatedAt: ad.updated_at,
        }));
        setAdvertisements(formattedAds);
      }

      const { data: relationshipsData } = await supabase
        .from('relationships')
        .select('*')
        .or(`user_id.eq.${userId},partner_user_id.eq.${userId}`)
        .in('status', ['pending', 'verified']);

      if (relationshipsData) {
        const formattedRelationships: Relationship[] = relationshipsData.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          partnerName: r.partner_name,
          partnerPhone: r.partner_phone,
          partnerUserId: r.partner_user_id,
          type: r.type,
          status: r.status,
          startDate: r.start_date,
          verifiedDate: r.verified_date,
          endDate: r.end_date,
          privacyLevel: r.privacy_level,
          partnerFacePhoto: r.partner_face_photo,
          partnerDateOfBirthMonth: r.partner_date_of_birth_month,
          partnerDateOfBirthYear: r.partner_date_of_birth_year,
          partnerCity: r.partner_city,
        }));
        setRelationships(formattedRelationships);
      }

      const { data: requestsData } = await supabase
        .from('relationship_requests')
        .select('*')
        .eq('to_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (requestsData) {
        const formattedRequests: RelationshipRequest[] = requestsData.map((req: any) => ({
          id: req.id,
          fromUserId: req.from_user_id,
          fromUserName: req.from_user_name,
          toUserId: req.to_user_id,
          relationshipType: req.relationship_type,
          status: req.status,
          createdAt: req.created_at,
        }));
        setRelationshipRequests(formattedRequests);
      }

      const { data: conversationsData } = await supabase
        .from('conversations')
        .select(`
          *,
          participant_users:participant_ids
        `)
        .contains('participant_ids', [userId])
        .order('last_message_at', { ascending: false });

      if (conversationsData && conversationsData.length > 0) {
        // Load messages to calculate accurate last messages
        // Limit to recent messages for performance (last 100 messages per conversation max)
        const conversationIds = conversationsData.map((c: any) => c.id);
        const { data: messagesData } = await supabase
          .from('messages')
          .select('*')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })
          .limit(conversationIds.length * 100); // Limit initial load for performance
        
        // Reverse to get chronological order after limiting
        const sortedMessages = messagesData ? [...messagesData].reverse() : [];

        const messagesByConversation: Record<string, Message[]> = {};
        if (sortedMessages && sortedMessages.length > 0) {
          sortedMessages.forEach((m: any) => {
            // Filter out messages deleted for current user
            const isSender = m.sender_id === userId;
            const isReceiver = m.receiver_id === userId;
            const deletedForMe = (isSender && m.deleted_for_sender) || (isReceiver && m.deleted_for_receiver);
            
            if (deletedForMe) return; // Skip messages deleted for this user

            const message: Message = {
              id: m.id,
              conversationId: m.conversation_id,
              senderId: m.sender_id,
              receiverId: m.receiver_id,
              content: m.content,
              mediaUrl: m.media_url,
              documentUrl: m.document_url,
              documentName: m.document_name,
              messageType: (m.message_type || 'text') as 'text' | 'image' | 'document',
              deletedForSender: m.deleted_for_sender || false,
              deletedForReceiver: m.deleted_for_receiver || false,
              read: m.read,
              createdAt: m.created_at,
              statusId: m.status_id,
              statusPreviewUrl: m.status_preview_url,
            };
            if (!messagesByConversation[m.conversation_id]) {
              messagesByConversation[m.conversation_id] = [];
            }
            messagesByConversation[m.conversation_id].push(message);
          });
          setMessages(messagesByConversation);
        }

        // Deduplicate conversations: keep only the most recent one for each set of participants
        const conversationMap = new Map<string, any>();
        conversationsData.forEach((conv: any) => {
          const participants = conv.participant_ids || [];
          const key = [...participants].sort().join(',');
          
          const existing = conversationMap.get(key);
          if (!existing || new Date(conv.last_message_at || conv.created_at).getTime() > 
                          new Date(existing.last_message_at || existing.created_at).getTime()) {
            conversationMap.set(key, conv);
          }
        });
        const deduplicatedConversations = Array.from(conversationMap.values());

        // Now format conversations with accurate last message from non-deleted messages
        // Filter out conversations with no messages
        const formattedConversations: Conversation[] = (await Promise.all(
          deduplicatedConversations.map(async (conv: any) => {
            const participantIds = conv.participant_ids;
            const { data: participantsData } = await supabase
              .from('users')
              .select('id, full_name, profile_picture')
              .in('id', participantIds);

            // Create a map for quick lookup
            const participantsMap = new Map(
              participantsData?.map((p: any) => [p.id, { name: p.full_name, avatar: p.profile_picture }]) || []
            );

            // Ensure arrays are in the same order as participantIds
            const participantNames = participantIds.map((id: string) => participantsMap.get(id)?.name || 'Unknown');
            const participantAvatars = participantIds.map((id: string) => participantsMap.get(id)?.avatar);

            // Calculate last message from non-deleted messages
            const convMessages = messagesByConversation[conv.id] || [];
            let lastMessage = '';
            let lastMessageAt = conv.last_message_at;
            
            if (convMessages.length > 0) {
              // Get the most recent message
              const lastMsg = convMessages[convMessages.length - 1];
              lastMessageAt = lastMsg.createdAt;
              lastMessage = lastMsg.messageType === 'image' 
                ? '📷 Image' 
                : lastMsg.messageType === 'document' 
                ? `📄 ${lastMsg.documentName || 'Document'}`
                : lastMsg.content;
            }

            return {
              id: conv.id,
              participants: participantIds,
              participantNames,
              participantAvatars,
              lastMessage: lastMessage || conv.last_message || '',
              lastMessageAt: lastMessageAt || conv.last_message_at,
              unreadCount: 0,
            };
          })
        )).filter(conv => {
          // Filter out conversations with no messages
          const convMessages = messagesByConversation[conv.id] || [];
          return convMessages.length > 0;
        });
        setConversations(formattedConversations);
      }

      const { data: commentsData } = await supabase
        .from('comments')
        .select(`
          *,
          users!comments_user_id_fkey(full_name, profile_picture),
          stickers!comments_sticker_id_fkey(image_url, is_animated)
        `)
        .order('created_at', { ascending: true });

      const { data: commentLikesData } = await supabase
        .from('comment_likes')
        .select('comment_id, user_id');

      if (commentsData) {
        // Create a map of comment likes
        const likesByComment: Record<string, string[]> = {};
        if (commentLikesData) {
          commentLikesData.forEach((like: any) => {
            if (!likesByComment[like.comment_id]) {
              likesByComment[like.comment_id] = [];
            }
            likesByComment[like.comment_id].push(like.user_id);
          });
        }

        const commentsByPost: Record<string, Comment[]> = {};
        const allComments: Comment[] = [];
        
        // First, create all comments
        commentsData.forEach((c: any) => {
          const comment: Comment = {
            id: c.id,
            postId: c.post_id,
            userId: c.user_id,
            userName: c.users.full_name,
            userAvatar: c.users.profile_picture,
            content: c.content,
            stickerId: c.sticker_id || undefined,
            stickerImageUrl: c.stickers?.image_url || undefined, // Include sticker image URL
            messageType: (c.message_type || 'text') as 'text' | 'sticker',
            likes: likesByComment[c.id] || [],
            createdAt: c.created_at,
            parentCommentId: c.parent_comment_id || undefined,
            replies: [],
          };
          allComments.push(comment);
        });

        // Organize comments into top-level and replies
        allComments.forEach((comment) => {
          if (!comment.parentCommentId) {
            // Top-level comment
            if (!commentsByPost[comment.postId]) {
              commentsByPost[comment.postId] = [];
            }
            commentsByPost[comment.postId].push(comment);
          } else {
            // Reply - find parent and add to replies
            const parent = allComments.find(c => c.id === comment.parentCommentId);
            if (parent) {
              if (!parent.replies) {
                parent.replies = [];
              }
              parent.replies.push(comment);
            }
          }
        });
        
        setComments(commentsByPost);
      }

      const { data: notificationsData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notificationsData) {
        const formattedNotifications: Notification[] = notificationsData.map((n: any) => ({
          id: n.id,
          userId: n.user_id,
          type: n.type,
          title: n.title,
          message: n.message,
          data: n.data,
          read: n.read,
          createdAt: n.created_at,
        }));
        setNotifications(formattedNotifications);
      }

      const { data: cheatingAlertsData } = await supabase
        .from('cheating_alerts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (cheatingAlertsData) {
        const formattedAlerts: CheatingAlert[] = cheatingAlertsData.map((a: any) => ({
          id: a.id,
          userId: a.user_id,
          partnerUserId: a.partner_user_id,
          alertType: a.alert_type,
          description: a.description,
          read: a.read,
          createdAt: a.created_at,
        }));
        setCheatingAlerts(formattedAlerts);
      }

      // Load blocked users
      const { data: blockedUsersData } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', userId);

      if (blockedUsersData) {
        setBlockedUsers(blockedUsersData.map((b: any) => b.blocked_id));
      }

      const { data: followsData } = await supabase
        .from('follows')
        .select('*')
        .or(`follower_id.eq.${userId},following_id.eq.${userId}`);

      if (followsData) {
        const formattedFollows: Follow[] = followsData.map((f: any) => ({
          id: f.id,
          followerId: f.follower_id,
          followingId: f.following_id,
          createdAt: f.created_at,
        }));
        setFollows(formattedFollows);
      }

      const { data: disputesData } = await supabase
        .from('disputes')
        .select('*')
        .eq('initiated_by', userId)
        .order('created_at', { ascending: false });

      if (disputesData) {
        const formattedDisputes: Dispute[] = disputesData.map((d: any) => ({
          id: d.id,
          relationshipId: d.relationship_id,
          initiatedBy: d.initiated_by,
          disputeType: d.dispute_type,
          description: d.description,
          status: d.status,
          resolution: d.resolution,
          autoResolveAt: d.auto_resolve_at,
          resolvedAt: d.resolved_at,
          resolvedBy: d.resolved_by,
          createdAt: d.created_at,
        }));
        setDisputes(formattedDisputes);
      }

      const { data: reelCommentsData } = await supabase
        .from('reel_comments')
        .select(`
          *,
          users!reel_comments_user_id_fkey(full_name, profile_picture),
          stickers!reel_comments_sticker_id_fkey(image_url, is_animated)
        `)
        .order('created_at', { ascending: true });

      const { data: reelCommentLikesData } = await supabase
        .from('reel_comment_likes')
        .select('comment_id, user_id');

      if (reelCommentsData) {
        // Create a map of comment likes
        const likesByComment: Record<string, string[]> = {};
        if (reelCommentLikesData) {
          reelCommentLikesData.forEach((like: any) => {
            if (!likesByComment[like.comment_id]) {
              likesByComment[like.comment_id] = [];
            }
            likesByComment[like.comment_id].push(like.user_id);
          });
        }

        const commentsByReel: Record<string, ReelComment[]> = {};
        const allComments: ReelComment[] = [];
        
        // First, create all comments
        reelCommentsData.forEach((c: any) => {
          const comment: ReelComment = {
            id: c.id,
            reelId: c.reel_id,
            userId: c.user_id,
            userName: c.users.full_name,
            userAvatar: c.users.profile_picture,
            content: c.content,
            stickerId: c.sticker_id || undefined,
            stickerImageUrl: c.stickers?.image_url || undefined, // Include sticker image URL
            messageType: (c.message_type || 'text') as 'text' | 'sticker',
            likes: likesByComment[c.id] || [],
            createdAt: c.created_at,
            parentCommentId: c.parent_comment_id || undefined,
            replies: [],
          };
          allComments.push(comment);
        });

        // Organize comments into top-level and replies
        allComments.forEach((comment) => {
          if (!comment.parentCommentId) {
            // Top-level comment
            if (!commentsByReel[comment.reelId]) {
              commentsByReel[comment.reelId] = [];
            }
            commentsByReel[comment.reelId].push(comment);
          } else {
            // Reply - find parent and add to replies
            const parent = allComments.find(c => c.id === comment.parentCommentId);
            if (parent) {
              if (!parent.replies) {
                parent.replies = [];
              }
              parent.replies.push(comment);
            }
          }
        });
        
        setReelComments(commentsByReel);
      }

      setupRealtimeSubscriptions(userId);


    } catch (error: any) {
      console.error('Failed to load user data:', error?.message || error);
    } finally {
      setIsLoading(false);
    }
  };

  const createUserRecord = async (userId: string) => {
    try {
      if (!session?.user) {
        console.error('No session available to create user record');
        return;
      }

      console.log('Creating user record for:', userId);
      console.log('Session user data:', JSON.stringify(session.user, null, 2));

      const { data: insertData, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          phone_number: session.user.user_metadata?.phone_number || session.user.phone || '',
          role: session.user.email === 'nashiezw@gmail.com' ? 'super_admin' : 'user',
          phone_verified: false,
          email_verified: !!session.user.email_confirmed_at,
          id_verified: false,
        })
        .select()
        .single();

      if (insertError) {
        // Handle duplicate key error (user already exists)
        if (insertError.code === '23505') {
          console.log('User already exists (duplicate email or ID), loading existing user...');
          await loadUserData(userId);
          return;
        }
        
        // Handle RLS policy error
        if (insertError.code === '42501') {
          console.error('RLS policy error: User cannot insert their own record');
          console.error('Please run the supabase-fix-rls.sql script in your Supabase SQL editor');
          throw insertError;
        }
        
        // Log and throw other errors
        console.error('Failed to create user record:', JSON.stringify(insertError, null, 2));
        throw insertError;
      }

      console.log('User record created successfully:', insertData);
      await loadUserData(userId);
    } catch (error: any) {
      console.error('Create user record error:', error?.message || JSON.stringify(error));
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      return data.user;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  const signup = useCallback(async (fullName: string, email: string, phoneNumber: string, password: string) => {
    try {
      // Normalize phone number before storing
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) {
        throw new Error('Invalid phone number format. Please enter a valid phone number.');
      }

      console.log('Signing up user:', { fullName, email, phoneNumber: normalizedPhone });
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: normalizedPhone,
          }
        }
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        throw authError;
      }
      
      if (!authData.user) {
        console.error('No user returned from signup');
        throw new Error('No user returned');
      }

      console.log('Auth user created:', authData.user.id);

      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', authData.user.id)
          .single();

        if (!existingUser) {
          console.log('Creating user profile record...');
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              full_name: fullName,
              email,
              phone_number: normalizedPhone,
              role: email === 'nashiezw@gmail.com' ? 'super_admin' : 'user',
              phone_verified: false,
              email_verified: false,
              id_verified: false,
            });

          if (profileError) {
            // Handle duplicate key error (user already exists)
            if (profileError.code === '23505') {
              console.log('User profile already exists, continuing...');
            } else if (profileError.code === '42501') {
              console.error('RLS policy error. Please run supabase-fix-rls.sql in your Supabase SQL editor');
              throw profileError;
            } else {
              console.error('Profile creation error:', JSON.stringify(profileError, null, 2));
              throw profileError;
            }
          } else {
            console.log('User profile created successfully');
          }
        } else {
          console.log('User profile already exists');
        }

        // Check and link any relationships where this user's phone number was registered
        await checkAndLinkRelationships(authData.user.id, normalizedPhone);
      } catch (profileError: any) {
        console.log('Profile check/creation error (may be handled by trigger):', profileError);
        // Still try to link relationships even if profile creation had issues
        // (it might have been created by trigger)
        try {
          await checkAndLinkRelationships(authData.user.id, normalizedPhone);
        } catch (linkError) {
          console.error('Error linking relationships after signup:', linkError);
        }
      }

      return authData.user;
    } catch (error: any) {
      console.error('Signup error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      console.log('Starting logout process...');
      
      // Set logout flag to prevent subscription callbacks from updating state
      isLoggingOutRef.current = true;
      
      // Step 1: Clean up all real-time subscriptions FIRST (before clearing state)
      console.log('Cleaning up real-time subscriptions...');
      try {
        // Remove all message/notification/post/reel subscriptions
        subscriptionsRef.current.forEach(channel => {
          try {
            supabase.removeChannel(channel);
          } catch (err) {
            console.warn('Error removing subscription channel:', err);
          }
        });
        subscriptionsRef.current = [];
        
        // Remove status update channels
        statusRealtimeChannels.forEach(channel => {
          try {
            supabase.removeChannel(channel);
          } catch (err) {
            console.warn('Error removing status channel:', err);
          }
        });
        setStatusRealtimeChannels([]);
        
        // Clear notification polling interval
        if (notificationPollIntervalRef.current) {
          clearInterval(notificationPollIntervalRef.current);
          notificationPollIntervalRef.current = null;
        }
        
        // Clear status update interval
        if (statusUpdateIntervalRef.current) {
          clearInterval(statusUpdateIntervalRef.current);
          statusUpdateIntervalRef.current = null;
        }
        
        console.log('All subscriptions cleaned up');
      } catch (cleanupError) {
        console.error('Error during subscription cleanup:', cleanupError);
      }
      
      // Step 2: Sign out from Supabase (this properly clears the session)
      try {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error('Supabase signOut error:', signOutError);
        } else {
          console.log('Supabase session cleared successfully');
        }
      } catch (signOutErr) {
        console.error('Error during Supabase signOut:', signOutErr);
      }
      
      // Step 3: Clear local AsyncStorage session (comprehensive cleanup)
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const storageKeys = await AsyncStorage.getAllKeys();
        
        // More comprehensive key matching for Supabase
        const supabaseKeys = storageKeys.filter((key: string) => 
          key.startsWith('sb-') || 
          key.includes('supabase') || 
          key.includes('supabase.auth') ||
          key.startsWith('@supabase')
        );
        
        console.log(`Found ${supabaseKeys.length} Supabase keys to clear:`, supabaseKeys);
        
        await Promise.all(supabaseKeys.map((key: string) => AsyncStorage.removeItem(key)));
        
        // Also try to clear by the known Supabase storage key pattern
        const supabaseAuth = supabase.auth as any;
        const supabaseUrl = supabaseAuth._storageKey || 'supabase.auth.token';
        try {
          await AsyncStorage.removeItem(supabaseUrl);
        } catch (e) {
          // Ignore if key doesn't exist
        }
        
        console.log('AsyncStorage cleared successfully');
      } catch (storageError) {
        console.error('Error clearing AsyncStorage:', storageError);
      }
      
      // Step 4: Set user status to offline BEFORE clearing state
      try {
        const userId = currentUser?.id;
        if (userId) {
          const now = new Date().toISOString();
          await supabase
            .from('user_status')
            .update({
              status_type: 'offline',
              last_active_at: now,
              updated_at: now,
            })
            .eq('user_id', userId);
        }
      } catch (statusError) {
        console.error('Error setting offline status:', statusError);
      }
      
      // Step 5: Clear local state AFTER all cleanup is done
      // This prevents components from trying to access subscriptions that are being cleaned up
      setCurrentUser(null);
      setSession(null);
      setRelationships([]);
      setRelationshipRequests([]);
      setPosts([]);
      setReels([]);
      setComments({});
      setConversations([]);
      setMessages({});
      setNotifications([]);
      setCheatingAlerts([]);
      setFollows([]);
      setDisputes([]);
      setCertificates([]);
      setAnniversaries([]);
      setReelComments({});
      setLegalAcceptanceStatus(null);
      setHasCompletedOnboarding(null);
      setUserStatuses({});
      
      // Reset logout flag after cleanup
      isLoggingOutRef.current = false;
      
      console.log('Logout completed successfully');
    } catch (error) {
      console.error('Logout error:', error);
      
      // Ensure cleanup happens even on error
      try {
        subscriptionsRef.current.forEach(channel => {
          try {
            supabase.removeChannel(channel);
          } catch (err) {
            // Ignore cleanup errors
          }
        });
        subscriptionsRef.current = [];
        
        if (notificationPollIntervalRef.current) {
          clearInterval(notificationPollIntervalRef.current);
          notificationPollIntervalRef.current = null;
        }
        
        if (statusUpdateIntervalRef.current) {
          clearInterval(statusUpdateIntervalRef.current);
          statusUpdateIntervalRef.current = null;
        }
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }
      
      // Ensure we still clear state even if there's an error
      setCurrentUser(null);
      setSession(null);
      
      // Final fallback: Force sign out
      try {
        await supabase.auth.signOut();
      } catch (fallbackError) {
        console.error('Fallback logout error:', fallbackError);
      }
      
      // Reset logout flag even on error
      isLoggingOutRef.current = false;
    }
  }, [statusRealtimeChannels]);

  const deleteAccount = useCallback(async () => {
    if (!currentUser) {
      throw new Error('No user logged in');
    }

    try {
      // Call the database function to delete the account
      // This will delete the auth user, which cascades to delete all related data
      // due to ON DELETE CASCADE constraints in the schema
      const { error } = await supabase.rpc('delete_user_account');

      if (error) {
        console.error('Delete account error:', error);
        throw error;
      }

      // Clear local state
      setCurrentUser(null);
      setSession(null);
      setRelationships([]);
      setRelationshipRequests([]);
      setPosts([]);
      setReels([]);
      setComments({});
      setConversations([]);
      setMessages({});
      setNotifications([]);
      setCheatingAlerts([]);
      setFollows([]);
      setDisputes([]);
      setCertificates([]);
      setAnniversaries([]);
      setReelComments({});

      // Sign out to clear auth session
      await supabase.auth.signOut();

      return true;
    } catch (error: any) {
      console.error('Delete account error:', error);
      throw error;
    }
  }, [currentUser]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'committed://auth-callback',
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw error;
    }
  }, []);

  const updateUserProfile = useCallback(async (updates: Partial<User>) => {
    if (!currentUser) return;
    
    try {
      // Normalize phone number if provided
      const normalizedPhone = updates.phoneNumber ? normalizePhoneNumber(updates.phoneNumber) : undefined;
      if (updates.phoneNumber && !normalizedPhone) {
        throw new Error('Invalid phone number format. Please enter a valid phone number.');
      }

      const { error } = await supabase
        .from('users')
        .update({
          full_name: updates.fullName,
          phone_number: normalizedPhone || updates.phoneNumber,
          profile_picture: updates.profilePicture,
          phone_verified: updates.verifications?.phone,
          email_verified: updates.verifications?.email,
          id_verified: updates.verifications?.id,
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      const updatedUser = { ...currentUser, ...updates };
      setCurrentUser(updatedUser);
    } catch (error) {
      console.error('Update profile error:', error);
    }
  }, [currentUser]);

  // Helper function to check if a notification type is enabled for a user
  const isNotificationEnabled = useCallback(async (
    userId: string,
    type: NotificationType
  ): Promise<boolean> => {
    try {
      // Map notification types to preference keys
      // Note: 'message' notifications are always enabled - they're too important to block
      const notificationTypeToPreferenceKey: Partial<Record<NotificationType, string>> = {
        'relationship_request': 'relationshipUpdates',
        'relationship_verified': 'relationshipUpdates',
        'relationship_ended': 'relationshipUpdates',
        'relationship_end_request': 'relationshipUpdates',
        'cheating_alert': 'cheatingAlerts',
        'verification_attempt': 'verificationAttempts',
        'anniversary_reminder': 'anniversaryReminders',
        'post_like': 'marketingPromotions', // Social interactions could be considered marketing
        'post_comment': 'marketingPromotions',
        // 'message' is intentionally not mapped - messages are always enabled
        'follow': 'marketingPromotions', // Follow notifications are social/marketing
      };

      // Messages are always enabled - they're critical notifications
      if (type === 'message') {
        return true;
      }

      const preferenceKey = notificationTypeToPreferenceKey[type];
      
      // If no mapping exists, allow the notification (default to enabled)
      if (!preferenceKey) {
        return true;
      }

      // Fetch user's notification settings
      const { data, error } = await supabase
        .from('user_settings')
        .select('notification_settings')
        .eq('user_id', userId)
        .single();

      if (error || !data || !data.notification_settings) {
        // If no settings found, default to enabled
        return true;
      }

      const settings = data.notification_settings;
      
      // Helper to convert JSONB value to boolean
      const toBoolean = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return value !== false && value !== 'false' && value !== null && value !== undefined;
      };
      
      // Check if the preference is enabled (default to true if not set)
      const preferenceValue = settings[preferenceKey];
      if (preferenceValue === undefined || preferenceValue === null) {
        return true; // Default to enabled if not set
      }
      return toBoolean(preferenceValue);
    } catch (error) {
      console.error('Error checking notification preference:', error);
      // Default to enabled on error
      return true;
    }
  }, []);

  const hydrateNotificationPreferences = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('notification_settings')
        .eq('user_id', userId)
        .single();
      if (error || !data?.notification_settings) return;

      const soundEnabledRaw = (data.notification_settings as any)?.soundEnabled;
      const soundEnabled =
        typeof soundEnabledRaw === 'boolean'
          ? soundEnabledRaw
          : typeof soundEnabledRaw === 'string'
            ? soundEnabledRaw.toLowerCase() === 'true'
            : soundEnabledRaw !== false && soundEnabledRaw !== 'false' && soundEnabledRaw != null;

      setNotificationPreferences({ soundEnabled });
    } catch {
      // ignore
    }
  }, []);

  const createNotification = useCallback(async (
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ) => {
    try {
      // Safety check: Never send notifications to the current user for their own actions
      if (!currentUser || userId === currentUser.id) {
        console.log(`⏭️ Skipping notification: Cannot notify user for their own action (userId: ${userId}, currentUser: ${currentUser?.id})`);
        return;
      }
      
      console.log('📨 Creating notification:', {
        recipientUserId: userId,
        type,
        title,
        currentUserId: currentUser.id
      });

      // Check if this notification type is enabled for the user
      const isEnabled = await isNotificationEnabled(userId, type);
      
      if (!isEnabled) {
        console.log(`Notification ${type} is disabled for user ${userId}`);
        return;
      }

      // ALWAYS use the database function (SECURITY DEFINER bypasses RLS)
      // This is the only reliable way to create notifications for other users
      const { data: functionData, error: functionError } = await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_type: type,
        p_title: title,
        p_message: message,
        p_data: data || null
      });

      if (functionError) {
        // Check if function doesn't exist (42883 = function does not exist)
        if (functionError.code === '42883' || functionError.message?.includes('function') || functionError.message?.includes('does not exist')) {
          const errorMessage = `Database function 'create_notification' not found. Please run the migration: migrations/add-notifications-insert-policy.sql in Supabase SQL Editor.`;
          console.error('❌', errorMessage);
          throw new Error(errorMessage);
        }
        
        // Check if it's an RLS error (42501)
        if (functionError.code === '42501') {
          const errorMessage = `RLS policy error. The create_notification function exists but is blocked. Please ensure the migration migrations/add-notifications-insert-policy.sql has been run correctly in Supabase SQL Editor.`;
          console.error('❌', errorMessage);
          throw new Error(errorMessage);
        }
        
        // Other errors
        console.error('❌ Failed to create notification via RPC function:', JSON.stringify(functionError, null, 2));
        throw functionError;
      }

      if (!functionData) {
        // Function returned null/undefined - this shouldn't happen but handle it
        console.warn('⚠️ create_notification function returned no data, but no error. Notification may not have been created.');
        return;
      }

      // Function worked and returned the notification ID
      // Construct notification object from what we know (we can't SELECT due to RLS)
      const notificationData = {
        id: functionData,
        user_id: userId,
        type: type,
        title: title,
        message: message,
        data: data || null,
        read: false,
        created_at: new Date().toISOString()
      };

      // Only add to local state if this notification is for the current user
      // Otherwise, let the real-time subscription handle it for the correct recipient
      if (notificationData && notificationData.user_id === currentUser.id) {
        console.log('✅ Adding notification to local state immediately:', notificationData.id);
        const newNotification: Notification = {
          id: notificationData.id,
          userId: notificationData.user_id,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          data: notificationData.data,
          read: notificationData.read,
          createdAt: notificationData.created_at,
        };
        setNotifications(prev => {
          // Check for duplicates
          const exists = prev.some(n => n.id === newNotification.id);
          if (exists) {
            return prev;
          }
          return [newNotification, ...prev];
        });
      } else if (notificationData) {
        console.log('📤 Notification created for another user, waiting for real-time subscription:', {
          notificationId: notificationData.id,
          recipientUserId: notificationData.user_id,
          currentUserId: currentUser.id
        });
      }
    } catch (error) {
      console.error('Create notification error:', error);
    }
  }, [currentUser, isNotificationEnabled]);

  const refreshRelationships = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const { data: relationshipsData } = await supabase
        .from('relationships')
        .select('*')
        .or(`user_id.eq.${currentUser.id},partner_user_id.eq.${currentUser.id}`)
        .in('status', ['pending', 'verified']);

      if (relationshipsData) {
        const formattedRelationships: Relationship[] = relationshipsData.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          partnerName: r.partner_name,
          partnerPhone: r.partner_phone,
          partnerUserId: r.partner_user_id,
          type: r.type,
          status: r.status,
          startDate: r.start_date,
          verifiedDate: r.verified_date,
          endDate: r.end_date,
          privacyLevel: r.privacy_level,
          partnerFacePhoto: r.partner_face_photo,
          partnerDateOfBirthMonth: r.partner_date_of_birth_month,
          partnerDateOfBirthYear: r.partner_date_of_birth_year,
          partnerCity: r.partner_city,
        }));
        setRelationships(formattedRelationships);
      }

      // Also refresh relationship requests
      const { data: requestsData } = await supabase
        .from('relationship_requests')
        .select('*')
        .eq('to_user_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (requestsData) {
        const formattedRequests: RelationshipRequest[] = requestsData.map((req: any) => ({
          id: req.id,
          fromUserId: req.from_user_id,
          fromUserName: req.from_user_name,
          toUserId: req.to_user_id,
          relationshipType: req.relationship_type,
          status: req.status,
          createdAt: req.created_at,
        }));
        setRelationshipRequests(formattedRequests);
      }
    } catch (error) {
      console.error('Failed to refresh relationships:', error);
    }
  }, [currentUser]);

  // Check and link relationships when a new user signs up
  // This must be defined after refreshRelationships and createNotification
  const checkAndLinkRelationships = useCallback(async (userId: string, phoneNumber: string) => {
    try {
      // Normalize phone number for searching
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) {
        console.warn('Invalid phone number format, skipping relationship linking:', phoneNumber);
        return;
      }

      // Find relationships where this phone number is listed as partner_phone
      // Search for both normalized and original format to catch existing records
      const { data: relationships } = await supabase
        .from('relationships')
        .select('*')
        .or(`partner_phone.eq.${normalizedPhone},partner_phone.eq.${phoneNumber}`)
        .in('status', ['pending', 'verified'])
        .is('partner_user_id', null); // Only link if not already linked

      if (!relationships || relationships.length === 0) {
        return;
      }

      console.log(`Found ${relationships.length} relationship(s) to link for user ${userId}`);

      for (const relationship of relationships) {
        // Update the relationship to link the partner_user_id
        const { error: updateError } = await supabase
          .from('relationships')
          .update({ partner_user_id: userId })
          .eq('id', relationship.id);

        if (updateError) {
          console.error('Error linking relationship:', updateError);
          continue;
        }

        // Get the requester's user info
        const { data: requesterUser } = await supabase
          .from('users')
          .select('id, full_name, phone_number')
          .eq('id', relationship.user_id)
          .single();

        if (!requesterUser) {
          console.error('Requester user not found for relationship:', relationship.id);
          continue;
        }

        // If relationship is already verified, create the reverse relationship record
        if (relationship.status === 'verified') {
          // Check if reverse relationship already exists
          const { data: existingReverse } = await supabase
            .from('relationships')
            .select('*')
            .eq('user_id', userId)
            .eq('partner_user_id', relationship.user_id)
            .in('status', ['pending', 'verified'])
            .maybeSingle();

          if (!existingReverse) {
            // Create reverse relationship record
            await supabase
              .from('relationships')
              .insert({
                user_id: userId,
                partner_name: requesterUser.full_name,
                partner_phone: requesterUser.phone_number,
                partner_user_id: relationship.user_id,
                type: relationship.type,
                status: 'verified',
                verified_date: relationship.verified_date,
                start_date: relationship.start_date,
                privacy_level: relationship.privacy_level,
                partner_face_photo: relationship.partner_face_photo,
                partner_date_of_birth_month: relationship.partner_date_of_birth_month,
                partner_date_of_birth_year: relationship.partner_date_of_birth_year,
                partner_city: relationship.partner_city,
              });

            // Send notification to the new user
            await createNotification(
              userId,
              'relationship_linked',
              'Relationship Linked',
              `You've been linked to a verified ${relationship.type} relationship with ${requesterUser.full_name}`,
              { relationshipId: relationship.id }
            );
          }
        } else {
          // Relationship is pending - create a relationship request
          const { data: existingRequest } = await supabase
            .from('relationship_requests')
            .select('*')
            .eq('from_user_id', relationship.user_id)
            .eq('to_user_id', userId)
            .eq('status', 'pending')
            .maybeSingle();

          if (!existingRequest) {
            await supabase
              .from('relationship_requests')
              .insert({
                from_user_id: relationship.user_id,
                from_user_name: requesterUser.full_name,
                to_user_id: userId,
                relationship_type: relationship.type,
                status: 'pending',
              });

            // Send notification to the new user
            await createNotification(
              userId,
              'relationship_request',
              'New Relationship Request',
              `${requesterUser.full_name} sent you a ${relationship.type} relationship request`,
              { relationshipId: relationship.id, fromUserId: relationship.user_id }
            );
          }
        }

        // Send notification to the requester that their partner has joined
        await createNotification(
          relationship.user_id,
          'partner_registered',
          'Partner Registered',
          `Your partner has registered and the relationship has been linked`,
          { relationshipId: relationship.id, partnerUserId: userId }
        );
      }

      // Refresh relationships if current user is loaded
      if (currentUser && currentUser.id === userId) {
        await refreshRelationships();
      }
    } catch (error) {
      console.error('Error checking and linking relationships:', error);
    }
  }, [currentUser, refreshRelationships, createNotification]);

  const createRelationship = useCallback(async (
    partnerName: string,
    partnerPhone: string,
    type: Relationship['type'],
    partnerUserId?: string,
    partnerFacePhoto?: string,
    partnerDateOfBirthMonth?: number,
    partnerDateOfBirthYear?: number,
    partnerCity?: string
  ) => {
    if (!currentUser) return null;
    
    try {
      // Normalize partner phone number
      const normalizedPartnerPhone = normalizePhoneNumber(partnerPhone);
      if (!normalizedPartnerPhone) {
        throw new Error('Invalid phone number format. Please enter a valid phone number.');
      }

      const { data: existingRelationships } = await supabase
        .from('relationships')
        .select('*')
        .eq('user_id', currentUser.id)
        .in('status', ['pending', 'verified']);

      if (existingRelationships && existingRelationships.length > 0) {
        const existingRel = existingRelationships[0];
        if (existingRel.partner_user_id) {
          await supabase
            .from('cheating_alerts')
            .insert({
              user_id: existingRel.partner_user_id,
              partner_user_id: currentUser.id,
              alert_type: 'duplicate_registration',
              description: `${currentUser.fullName} attempted to register a new relationship while already in a ${existingRel.status} relationship.`,
            });

          await createNotification(
            existingRel.partner_user_id,
            'cheating_alert',
            'Suspicious Activity Detected',
            `${currentUser.fullName} attempted to register another relationship. Please review.`,
            { relationshipId: existingRel.id }
          );
        }
      }

      let partnerData = null;
      if (partnerUserId) {
        // If partnerUserId is provided, verify the phone number matches
        const { data } = await supabase
          .from('users')
          .select('id, phone_number, full_name')
          .eq('id', partnerUserId)
          .single();
        
        if (data) {
          // Verify phone number matches (using normalized comparison)
          const normalizedUserPhone = normalizePhoneNumber(data.phone_number);
          if (!comparePhoneNumbers(normalizedUserPhone, normalizedPartnerPhone)) {
            throw new Error(`Phone number mismatch: The selected user's phone number (${data.phone_number}) does not match the provided phone number (${partnerPhone}). Please verify you selected the correct person.`);
          }
          partnerData = data;
        }
      } else {
        // Search by phone number - search for both normalized and original format
        const { data: usersByPhone } = await supabase
          .from('users')
          .select('id, phone_number, full_name')
          .or(`phone_number.eq.${normalizedPartnerPhone},phone_number.eq.${partnerPhone}`);
        
        if (usersByPhone && usersByPhone.length > 0) {
          if (usersByPhone.length > 1) {
            // Multiple users with same phone - this shouldn't happen but handle it
            console.warn(`Multiple users found with phone number ${partnerPhone}`);
          }
          
          // Check if any user matches the name (additional verification)
          const nameMatch = usersByPhone.find(u => 
            u.full_name.toLowerCase().trim() === partnerName.toLowerCase().trim()
          );
          
          if (nameMatch) {
            partnerData = nameMatch;
          } else if (usersByPhone.length === 1) {
            // Only one user with this phone, use it but warn if name doesn't match
            partnerData = usersByPhone[0];
            if (partnerData.full_name.toLowerCase().trim() !== partnerName.toLowerCase().trim()) {
              console.warn(`Name mismatch: Found user "${partnerData.full_name}" with phone ${partnerPhone}, but relationship registered with name "${partnerName}"`);
            }
          } else {
            // Multiple users with same phone and none match the name - this is a problem
            throw new Error(`Multiple users found with phone number ${partnerPhone} but none match the name "${partnerName}". Please verify the phone number and name are correct.`);
          }
        }
      }

      if (partnerData) {
        const { data: partnerExistingRels } = await supabase
          .from('relationships')
          .select('*')
          .eq('user_id', partnerData.id)
          .in('status', ['pending', 'verified']);

        if (partnerExistingRels && partnerExistingRels.length > 0) {
          const partnerExistingRel = partnerExistingRels[0];
          if (partnerExistingRel.partner_user_id) {
            await supabase
              .from('cheating_alerts')
              .insert({
                user_id: partnerExistingRel.partner_user_id,
                partner_user_id: partnerData.id,
                alert_type: 'duplicate_registration',
                description: `${partnerName} was registered in a new relationship by ${currentUser.fullName} while already in a ${partnerExistingRel.status} relationship.`,
              });

            await createNotification(
              partnerExistingRel.partner_user_id,
              'cheating_alert',
              'Suspicious Activity Detected',
              `Someone attempted to register ${partnerName} in a new relationship. Please review.`,
              { relationshipId: partnerExistingRel.id }
            );
          }
        }
      }

      const relationshipPayload = {
        user_id: currentUser.id,
        partner_name: partnerName,
        partner_phone: normalizedPartnerPhone, // Store normalized phone number
        partner_user_id: partnerData?.id,
        type,
        status: 'pending',
        privacy_level: 'public',
        partner_face_photo: partnerFacePhoto,
        partner_date_of_birth_month: partnerDateOfBirthMonth,
        partner_date_of_birth_year: partnerDateOfBirthYear,
        partner_city: partnerCity,
      };

      const { data: relationshipData, error: relError } = await supabase
        .from('relationships')
        .insert(relationshipPayload)
        .select()
        .single();

      if (relError) {
        // If offline or network error, queue for later sync
        if (relError.message?.includes('network') || relError.message?.includes('fetch')) {
          await queueRelationshipChange({
            type: 'create',
            relationshipId: undefined,
            data: relationshipPayload,
          });
          throw new Error('Relationship queued for sync. Will be created when connection is restored.');
        }
        throw relError;
      }

      if (partnerData) {
        const { error: requestError } = await supabase
          .from('relationship_requests')
          .insert({
            from_user_id: currentUser.id,
            from_user_name: currentUser.fullName,
            to_user_id: partnerData.id,
            relationship_type: type,
            status: 'pending',
          });

        if (requestError) throw requestError;

        // Send notification to the partner about the relationship request
        await createNotification(
          partnerData.id,
          'relationship_request',
          'New Relationship Request',
          `${currentUser.fullName} sent you a ${type} relationship request`,
          { relationshipId: relationshipData.id, fromUserId: currentUser.id }
        );
      }

      const newRelationship: Relationship = {
        id: relationshipData.id,
        userId: currentUser.id,
        partnerName,
        partnerPhone,
        type,
        status: 'pending',
        startDate: relationshipData.start_date,
        privacyLevel: 'public',
        partnerFacePhoto: relationshipData.partner_face_photo,
        partnerDateOfBirthMonth: relationshipData.partner_date_of_birth_month,
        partnerDateOfBirthYear: relationshipData.partner_date_of_birth_year,
        partnerCity: relationshipData.partner_city,
      };

      // Store face embedding for face matching if face photo is provided
      if (partnerFacePhoto && relationshipData.id) {
        try {
          const { storeFaceEmbedding } = await import('@/lib/faceSearch');
          await storeFaceEmbedding(relationshipData.id, partnerFacePhoto);
        } catch (error) {
          // Don't fail relationship creation if face matching fails
          console.warn('Failed to store face embedding:', error);
        }
      }

      // Refresh relationships from database to get latest data
      await refreshRelationships();
      
      return newRelationship;
    } catch (error) {
      console.error('Create relationship error:', error);
      return null;
    }
  }, [currentUser, refreshRelationships, createNotification]);

  const acceptRelationshipRequest = useCallback(async (requestId: string) => {
    if (!currentUser) return;
    
    try {
      const { error } = await supabase
        .from('relationship_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) {
        // If offline, queue for later sync
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          await queueRelationshipChange({
            type: 'accept',
            relationshipId: requestId,
            data: { status: 'accepted' },
          });
          throw new Error('Request acceptance queued for sync. Will be processed when connection is restored.');
        }
        throw error;
      }

      const { data: request } = await supabase
        .from('relationship_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (request) {
        // Get the requester's relationship record to get all details
        const { data: requesterRelationship } = await supabase
          .from('relationships')
          .select('*')
          .eq('user_id', request.from_user_id)
          .in('status', ['pending', 'verified'])
          .single();

        // Get the requester's user info (name, phone)
        const { data: requesterUser } = await supabase
          .from('users')
          .select('id, full_name, phone_number')
          .eq('id', request.from_user_id)
          .single();

        if (requesterRelationship && requesterUser) {
          const verifiedDate = new Date().toISOString();

          // Update the requester's relationship record
          await supabase
            .from('relationships')
            .update({
              status: 'verified',
              verified_date: verifiedDate,
              partner_user_id: currentUser.id,
            })
            .eq('user_id', request.from_user_id);

          // Check if accepter already has a relationship record
          const { data: existingAccepterRelationship } = await supabase
            .from('relationships')
            .select('*')
            .eq('user_id', currentUser.id)
            .in('status', ['pending', 'verified'])
            .single();

          if (existingAccepterRelationship) {
            // Update existing relationship record for accepter
            await supabase
              .from('relationships')
              .update({
                status: 'verified',
                verified_date: verifiedDate,
                partner_user_id: request.from_user_id,
                partner_name: requesterUser.full_name,
                partner_phone: requesterUser.phone_number,
                type: request.relationship_type,
                start_date: requesterRelationship.start_date,
                privacy_level: requesterRelationship.privacy_level,
              })
              .eq('user_id', currentUser.id);
          } else {
            // Create new relationship record for accepter
            await supabase
              .from('relationships')
              .insert({
                user_id: currentUser.id,
                partner_name: requesterUser.full_name,
                partner_phone: requesterUser.phone_number,
                partner_user_id: request.from_user_id,
                type: request.relationship_type,
                status: 'verified',
                verified_date: verifiedDate,
                start_date: requesterRelationship.start_date,
                privacy_level: requesterRelationship.privacy_level,
                partner_face_photo: requesterRelationship.partner_face_photo,
                partner_date_of_birth_month: requesterRelationship.partner_date_of_birth_month,
                partner_date_of_birth_year: requesterRelationship.partner_date_of_birth_year,
                partner_city: requesterRelationship.partner_city,
              });
          }

          // Send notification to the requester that the relationship was verified
          await createNotification(
            request.from_user_id,
            'relationship_verified',
            'Relationship Verified',
            `${currentUser.fullName} accepted your ${request.relationship_type} relationship request`,
            { relationshipId: request.id }
          );
        }
      }

      // Refresh relationships to get updated status
      await refreshRelationships();
    } catch (error) {
      console.error('Accept relationship request error:', error);
    }
  }, [currentUser, refreshRelationships, createNotification]);

  const rejectRelationshipRequest = useCallback(async (requestId: string) => {
    try {
      await supabase
        .from('relationship_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      // Refresh relationships to update request list
      await refreshRelationships();
    } catch (error) {
      console.error('Reject relationship request error:', error);
    }
  }, [refreshRelationships]);

  const getCurrentUserRelationship = useCallback(() => {
    if (!currentUser) return null;
    return relationships.find(r => r.userId === currentUser.id && r.status !== 'ended');
  }, [currentUser, relationships]);

  const getUserRelationship = useCallback((userId: string) => {
    return relationships.find(r => r.userId === userId && r.status !== 'ended');
  }, [relationships]);

  const searchUsers = useCallback(async (query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return [];
    
    try {
      // Normalize query if it looks like a phone number
      const normalizedQuery = normalizePhoneNumber(query) || lowerQuery;
      const searchQuery = normalizedQuery !== lowerQuery ? normalizedQuery : lowerQuery;
      
      // Search registered users
      const { data: usersData, error: usersError } = await supabase.rpc('search_users', {
        search_query: searchQuery,
      });

      if (usersError) throw usersError;

      // Get relationship info for all users
      const usersWithRelationships = await Promise.all(
        (usersData || []).map(async (u: any) => {
          // Get user's relationship
          const { data: userRel } = await supabase
            .from('relationships')
            .select('type, status, partner_name, partner_phone, partner_user_id, partner_face_photo')
            .eq('user_id', u.id)
            .in('status', ['pending', 'verified'])
            .limit(1)
            .single();

          return {
            id: u.id,
            fullName: u.full_name,
            username: u.username,
            email: u.email || '',
            phoneNumber: u.phone_number || '',
            profilePicture: u.profile_picture,
            role: u.role || 'user',
            isRegisteredUser: true,
            relationshipType: userRel?.type,
            relationshipStatus: userRel?.status,
            partnerName: userRel?.partner_name,
            partnerPhone: userRel?.partner_phone,
            partnerUserId: userRel?.partner_user_id,
            verifications: {
              phone: u.phone_verified || false,
              email: u.email_verified || false,
              id: u.id_verified || false,
            },
            createdAt: '',
          };
        })
      );

      // Search non-registered partners (people listed as partners but not registered)
      // Search for both normalized and original query to catch all matches
      const { data: partnerData, error: partnerError } = await supabase
        .from('relationships')
        .select(`
          partner_name,
          partner_phone,
          partner_user_id,
          partner_face_photo,
          type,
          status,
          user_id,
          users!relationships_user_id_fkey(full_name, phone_number, profile_picture)
        `)
        .or(`partner_name.ilike.%${lowerQuery}%,partner_phone.ilike.%${lowerQuery}%,partner_phone.ilike.%${searchQuery}%`)
        .is('partner_user_id', null)
        .in('status', ['pending', 'verified'])
        .limit(20);

      if (!partnerError && partnerData) {
        const nonRegisteredPartners = partnerData.map((rel: any) => ({
          id: null,
          fullName: rel.partner_name,
          phoneNumber: rel.partner_phone,
          profilePicture: rel.partner_face_photo,
          isRegisteredUser: false,
          relationshipType: rel.type,
          relationshipStatus: rel.status,
          partnerName: rel.users?.full_name,
          partnerPhone: rel.users?.phone_number,
          partnerUserId: rel.user_id,
          verifications: {
            phone: false,
            email: false,
            id: false,
          },
          createdAt: '',
        }));

        // First, deduplicate non-registered partners themselves (same person might be in multiple relationships)
        // Prefer entries with relationship info (partnerName) and verified status
        const partnerMap = new Map<string, any>();
        for (const partner of nonRegisteredPartners) {
          // Use proper normalization for phone numbers
          const normalizedPhone = normalizePhoneNumber(partner.phoneNumber) || partner.phoneNumber?.toLowerCase().trim().replace(/\D/g, '') || '';
          const normalizedName = partner.fullName?.toLowerCase().trim() || '';
          const key = normalizedPhone || normalizedName;
          
          if (!key) continue; // Skip if no identifying info
          
          const existing = partnerMap.get(key);
          if (!existing) {
            partnerMap.set(key, partner);
          } else {
            // Priority: 1) Has partnerName (relationship info), 2) Verified status
            const hasPartnerName = !!partner.partnerName;
            const existingHasPartnerName = !!existing.partnerName;
            const isVerified = partner.relationshipStatus === 'verified';
            const existingIsVerified = existing.relationshipStatus === 'verified';
            
            // Prefer entry with partnerName if the other doesn't have it
            if (hasPartnerName && !existingHasPartnerName) {
              partnerMap.set(key, partner);
            } else if (!hasPartnerName && existingHasPartnerName) {
              // Keep existing
            } else if (isVerified && !existingIsVerified) {
              // Both have or both don't have partnerName, prefer verified
              partnerMap.set(key, partner);
            }
            // Otherwise keep existing
          }
        }
        const uniqueNonRegisteredPartners = Array.from(partnerMap.values());

        // Now deduplicate: if a person appears in both registered users and non-registered partners,
        // prefer the non-registered partner entry (as it shows relationship info)
        const nonRegisteredPhoneNumbers = new Set(
          uniqueNonRegisteredPartners.map((p: any) => {
            const normalized = normalizePhoneNumber(p.phoneNumber);
            return normalized || p.phoneNumber?.toLowerCase().trim().replace(/\D/g, '');
          }).filter(Boolean)
        );
        const nonRegisteredNames = new Set(
          uniqueNonRegisteredPartners.map((p: any) => p.fullName?.toLowerCase().trim()).filter(Boolean)
        );

        // Filter out registered users that match non-registered partners by phone or name
        // (prefer non-registered partner entries as they show relationship info)
        const uniqueRegisteredUsers = usersWithRelationships.filter((user: any) => {
          const normalizedUserPhone = normalizePhoneNumber(user.phoneNumber) || user.phoneNumber?.toLowerCase().trim().replace(/\D/g, '');
          const userName = user.fullName?.toLowerCase().trim();
          
          // Check if normalized phone matches any non-registered partner
          const phoneMatch = normalizedUserPhone && Array.from(nonRegisteredPhoneNumbers).some((np: any) => 
            comparePhoneNumbers(normalizedUserPhone, np)
          );
          
          // Keep registered user only if they don't match any non-registered partner
          return !phoneMatch && !(userName && nonRegisteredNames.has(userName));
        });

        return [...uniqueRegisteredUsers, ...uniqueNonRegisteredPartners];
      }

      return usersWithRelationships;
    } catch (error) {
      console.error('Search users error:', error);
      return [];
    }
  }, []);

  const searchByFace = useCallback(async (imageUri: string) => {
    try {
      // Import face search service
      const { searchByFace: faceSearch } = await import('@/lib/faceSearch');
      
      // Convert local URI to a format the service can use
      // For now, we'll pass the URI directly (in production, you might need to upload to storage first)
      const results = await faceSearch(imageUri);
      
      // Format results for display
      return results.map((match) => ({
        relationshipId: match.relationshipId,
        id: match.partnerUserId || null, // Partner's user ID if registered
        fullName: match.partnerName,
        phoneNumber: match.partnerPhone,
        profilePicture: match.facePhotoUrl,
        facePhotoUrl: match.facePhotoUrl, // Also include explicitly for face search results
        isRegisteredUser: !!match.partnerUserId,
        relationshipType: match.relationshipType,
        relationshipStatus: match.relationshipStatus,
        partnerName: match.userName, // The person they're in a relationship with
        partnerPhone: match.userPhone,
        partnerUserId: match.userId,
        similarityScore: match.similarityScore,
        verifications: {
          phone: false,
          email: false,
          id: false,
        },
      }));
    } catch (error) {
      console.error('Face search error:', error);
      return [];
    }
  }, []);

  const getPendingRequests = useCallback(() => {
    if (!currentUser) return [];
    return relationshipRequests.filter(
      r => r.toUserId === currentUser.id && r.status === 'pending'
    );
  }, [currentUser, relationshipRequests]);

  // Helper function to check if user is restricted from a feature
  const checkUserRestriction = useCallback(async (userId: string, feature: string): Promise<{ 
    restricted: boolean; 
    reason?: string;
    restrictionType?: 'full_ban' | 'feature_restriction';
    restrictedFeature?: string;
    restrictionId?: string;
  }> => {
    try {
      // First check if user is fully banned
      const { data: userData } = await supabase
        .from('users')
        .select('banned_at, ban_reason')
        .eq('id', userId)
        .single();

      if (userData?.banned_at) {
        return { 
          restricted: true, 
          reason: userData.ban_reason || 'Your account has been suspended due to a violation of our community guidelines. If you believe this is an error, you may submit an appeal.',
          restrictionType: 'full_ban'
        };
      }

      // Check for active restrictions
      const now = new Date().toISOString();
      const { data: restrictions } = await supabase
        .from('user_restrictions')
        .select('id, restricted_feature, reason, expires_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .or(`restricted_feature.eq.${feature},restricted_feature.eq.all`)
        .limit(10);

      // Filter by expiration date (permanent or not expired)
      const activeRestrictions = restrictions?.filter(r => 
        !r.expires_at || new Date(r.expires_at) > new Date(now)
      );

      if (activeRestrictions && activeRestrictions.length > 0) {
        const restriction = activeRestrictions[0];
        const isFullBan = restriction.restricted_feature === 'all';
        const featureName = feature === 'posts' ? 'creating posts' : 
                           feature === 'comments' ? 'commenting' :
                           feature === 'messages' ? 'sending messages' :
                           feature === 'reels' ? 'creating reels' :
                           feature === 'reel_comments' ? 'commenting on reels' : feature;
        
        const defaultReason = isFullBan 
          ? 'Your account has been suspended due to a violation of our community guidelines. If you believe this is an error, you may submit an appeal.'
          : `You are currently restricted from ${featureName} due to a violation of our community guidelines. If you believe this is an error, you may submit an appeal.`;

        return { 
          restricted: true, 
          reason: restriction.reason || defaultReason,
          restrictionType: isFullBan ? 'full_ban' : 'feature_restriction',
          restrictedFeature: restriction.restricted_feature,
          restrictionId: restriction.id
        };
      }

      return { restricted: false };
    } catch (error) {
      console.error('Check restriction error:', error);
      // On error, allow the action (fail open for better UX)
      return { restricted: false };
    }
  }, []);

  const createPost = useCallback(async (content: string, mediaUrls: string[], mediaType: Post['mediaType']) => {
    if (!currentUser) return null;
    
    // Check if user is restricted from creating posts
    const restriction = await checkUserRestriction(currentUser.id, 'posts');
    if (showBanModal(restriction)) {
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: currentUser.id,
          content,
          media_urls: mediaUrls,
          media_type: mediaType,
        })
        .select(`
          *,
          users!posts_user_id_fkey(full_name, profile_picture)
        `)
        .single();

      if (error) throw error;

      const newPost: Post = {
        id: data.id,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.profilePicture,
        content,
        mediaUrls,
        mediaType,
        likes: [],
        commentCount: 0,
        createdAt: data.created_at,
      };

      setPosts([newPost, ...posts]);
      return newPost;
    } catch (error) {
      console.error('Create post error:', error);
      return null;
    }
  }, [currentUser, posts]);

  const createReel = useCallback(async (videoUrl: string, caption: string, thumbnailUrl?: string) => {
    if (!currentUser) return null;
    
    // Check if user is restricted from creating reels
    const restriction = await checkUserRestriction(currentUser.id, 'reels');
    if (showBanModal(restriction)) {
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('reels')
        .insert({
          user_id: currentUser.id,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          caption,
        })
        .select(`
          *,
          users!reels_user_id_fkey(full_name, profile_picture)
        `)
        .single();

      if (error) throw error;

      const newReel: Reel = {
        id: data.id,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.profilePicture,
        videoUrl,
        thumbnailUrl,
        caption,
        likes: [],
        commentCount: 0,
        viewCount: 0,
        createdAt: data.created_at,
      };

      setReels([newReel, ...reels]);
      return newReel;
    } catch (error) {
      console.error('Create reel error:', error);
      return null;
    }
  }, [currentUser, reels]);

  const toggleLike = useCallback(async (postId: string) => {
    if (!currentUser) return;
    
    try {
      const { data: existingLike } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .single();

      const post = posts.find(p => p.id === postId);
      
      if (existingLike) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);
      } else {
        await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: currentUser.id,
          });
        
        // Send notification to post owner (if not liking own post)
        if (post && post.userId && post.userId !== currentUser.id) {
          await createNotification(
            post.userId,
            'post_like',
            'New Like',
            `${currentUser.fullName} liked your post`,
            { postId, userId: currentUser.id }
          );
        }
      }

      const updatedPosts = posts.map(post => {
        if (post.id === postId) {
          const likes = existingLike
            ? post.likes.filter(id => id !== currentUser.id)
            : [...post.likes, currentUser.id];
          return { ...post, likes };
        }
        return post;
      });
      
      // Maintain sort order by createdAt (newest first) - don't reorder based on likes
      const sortedPosts = [...updatedPosts].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setPosts(sortedPosts);
    } catch (error) {
      console.error('Toggle like error:', error);
    }
  }, [currentUser, posts, createNotification]);

  const toggleReelLike = useCallback(async (reelId: string) => {
    if (!currentUser) return;
    
    try {
      const { data: existingLike } = await supabase
        .from('reel_likes')
        .select('id')
        .eq('reel_id', reelId)
        .eq('user_id', currentUser.id)
        .single();

      const reel = reels.find(r => r.id === reelId);
      
      if (existingLike) {
        await supabase
          .from('reel_likes')
          .delete()
          .eq('reel_id', reelId)
          .eq('user_id', currentUser.id);
      } else {
        await supabase
          .from('reel_likes')
          .insert({
            reel_id: reelId,
            user_id: currentUser.id,
          });
        
        // Send notification to reel owner (if not liking own reel)
        if (reel && reel.userId && reel.userId !== currentUser.id) {
          await createNotification(
            reel.userId,
            'post_like', // Using post_like type for reel likes too
            'New Like',
            `${currentUser.fullName} liked your reel`,
            { reelId, userId: currentUser.id }
          );
        }
      }

      const updatedReels = reels.map(reel => {
        if (reel.id === reelId) {
          const likes = existingLike
            ? reel.likes.filter(id => id !== currentUser.id)
            : [...reel.likes, currentUser.id];
          return { ...reel, likes };
        }
        return reel;
      });
      
      setReels(updatedReels);
    } catch (error) {
      console.error('Toggle reel like error:', error);
    }
  }, [currentUser, reels, createNotification]);

  const addComment = useCallback(async (
    postId: string, 
    content: string, 
    parentCommentId?: string,
    stickerId?: string,
    messageType: 'text' | 'sticker' = 'text'
  ) => {
    if (!currentUser) return null;
    
    // Check if user is restricted from commenting
    const restriction = await checkUserRestriction(currentUser.id, 'comments');
    if (showBanModal(restriction)) {
      return null;
    }
    
    try {
      const insertData: any = {
        post_id: postId,
        user_id: currentUser.id,
        content: messageType === 'sticker' ? '' : content, // Empty content for stickers
        message_type: messageType,
      };
      
      if (parentCommentId) {
        insertData.parent_comment_id = parentCommentId;
      }

      if (stickerId && messageType === 'sticker') {
        insertData.sticker_id = stickerId;
      }

      const { data, error } = await supabase
        .from('comments')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      const newComment: Comment = {
        id: data.id,
        postId,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.profilePicture,
        content: messageType === 'sticker' ? '' : content,
        stickerId: data.sticker_id || undefined,
        messageType: (data.message_type || 'text') as 'text' | 'sticker',
        likes: [],
        createdAt: data.created_at,
        parentCommentId: data.parent_comment_id || undefined,
      };
      
      // If it's a reply, add it to the parent comment's replies, otherwise add to top level
      const updatedComments = { ...comments };
      if (parentCommentId) {
        // Find parent comment and add reply
        const postComments = comments[postId] || [];
        const updatedPostComments = postComments.map(comment => {
          if (comment.id === parentCommentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newComment],
            };
          }
          return comment;
        });
        updatedComments[postId] = updatedPostComments;
      } else {
        updatedComments[postId] = [...(comments[postId] || []), newComment];
      }
      setComments(updatedComments);
      
      // Send notifications (outside of map to allow async/await)
      if (parentCommentId) {
        // Find parent comment owner
        const postComments = comments[postId] || [];
        const parentComment = postComments.find(c => c.id === parentCommentId);
        if (parentComment && parentComment.userId && parentComment.userId !== currentUser.id) {
          createNotification(
            parentComment.userId,
            'post_comment',
            'New Reply',
            `${currentUser.fullName} replied to your comment: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
            { postId, commentId: data.id, parentCommentId, userId: currentUser.id }
          ).catch(err => console.error('Failed to send reply notification:', err));
        }
      } else {
        const post = posts.find(p => p.id === postId);
        if (post && post.userId && post.userId !== currentUser.id) {
          // Send notification to post owner (if not commenting on own post)
          createNotification(
            post.userId,
            'post_comment',
            'New Comment',
            `${currentUser.fullName} commented on your post: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
            { postId, commentId: data.id, userId: currentUser.id }
          ).catch(err => console.error('Failed to send comment notification:', err));
        }
      }
      
      const updatedPosts = posts.map(post => {
        if (post.id === postId) {
          return { ...post, commentCount: post.commentCount + 1 };
        }
        return post;
      });
      
      // Maintain sort order by createdAt (newest first)
      const sortedPosts = [...updatedPosts].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setPosts(sortedPosts);
      
      return newComment;
    } catch (error) {
      console.error('Add comment error:', error);
      return null;
    }
  }, [currentUser, comments, posts, createNotification]);

  const sendMessage = useCallback(async (
    conversationId: string, 
    receiverId: string, 
    content: string,
    mediaUrl?: string,
    documentUrl?: string,
    documentName?: string,
    messageType: 'text' | 'image' | 'document' | 'sticker' = 'text',
    stickerId?: string,
    statusId?: string,
    statusPreviewUrl?: string
  ) => {
    if (!currentUser) return null;
    
    // Check if user is restricted from sending messages
    const restriction = await checkUserRestriction(currentUser.id, 'messages');
    if (showBanModal(restriction)) {
      return null;
    }

    // Check dating message limits (only for 2-participant conversations)
    try {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('participant_ids')
        .eq('id', conversationId)
        .single();

      // Only check limits for 2-participant conversations (dating conversations)
      if (conversation?.participant_ids && conversation.participant_ids.length === 2) {
        const { checkDatingMessageLimit } = await import('@/lib/dating-message-limits');
        const limitCheck = await checkDatingMessageLimit(conversationId);
        
        if (!limitCheck.allowed) {
          // Import and show premium modal if available
          const errorMessage = limitCheck.error || 'Message limit reached. Upgrade to Premium for unlimited messaging!';
          // We'll throw an error that the UI can catch and show premium modal
          throw new Error(errorMessage);
        }
      }
    } catch (limitError: any) {
      // If it's a limit error, throw it to be caught by UI
      if (limitError.message?.includes('limit') || limitError.message?.includes('Premium')) {
        throw limitError;
      }
      // Otherwise, log and continue (might be a network error, etc.)
      console.warn('Error checking message limit, allowing message:', limitError);
    }
    
    try {
      const insertData: any = {
        conversation_id: conversationId,
        sender_id: currentUser.id,
        receiver_id: receiverId,
        content: content || '',
        message_type: messageType,
      };

      if (mediaUrl) {
        insertData.media_url = mediaUrl;
      }
      if (documentUrl) {
        insertData.document_url = documentUrl;
        insertData.document_name = documentName || 'Document';
      }
      if (stickerId) {
        insertData.sticker_id = stickerId;
      }
      if (statusId) {
        insertData.status_id = statusId;
      }
      if (statusPreviewUrl) {
        insertData.status_preview_url = statusPreviewUrl;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(insertData)
        .select();

      if (error) {
        console.error('Failed to send message:', JSON.stringify(error, null, 2));
        throw error;
      }

      // Handle case where SELECT might be blocked by RLS but insert succeeded
      if (!data || data.length === 0) {
        // Insert succeeded but SELECT was blocked - real-time subscription will handle it
        console.log('Message inserted but SELECT blocked by RLS - real-time subscription will handle it');
        return null; // Return null, real-time subscription will add the message
      }

      const messageData = data[0];

      const newMessage: Message = {
        id: messageData.id,
        conversationId,
        senderId: currentUser.id,
        receiverId,
        content: content || '',
        mediaUrl: messageData.media_url,
        documentUrl: messageData.document_url,
        documentName: messageData.document_name,
        messageType: messageData.message_type || 'text',
        read: false,
        createdAt: messageData.created_at,
        statusId: messageData.status_id,
        statusPreviewUrl: messageData.status_preview_url,
      };
      
      const updatedMessages = {
        ...messages,
        [conversationId]: [...(messages[conversationId] || []), newMessage],
      };
      setMessages(updatedMessages);
      
      // Update conversation last message
      const lastMessageText = messageType === 'image' 
        ? '📷 Image' 
        : messageType === 'document' 
        ? `📄 ${documentName || 'Document'}`
        : content;
      
      const lastMessageAt = new Date().toISOString();
      
      // Update conversation in database
      await supabase
        .from('conversations')
        .update({
          last_message: lastMessageText,
          last_message_at: lastMessageAt,
        })
        .eq('id', conversationId);
      
      // Optimistically update local conversations state immediately
      setConversations(prev => {
        const existingIndex = prev.findIndex(c => c.id === conversationId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            lastMessage: lastMessageText,
            lastMessageAt: lastMessageAt,
          };
          // Sort by last_message_at descending (most recent first)
          return updated.sort((a, b) => 
            new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
          );
        }
        return prev;
      });
      
      // Send notification to receiver (only if receiver is not the sender)
      if (receiverId !== currentUser.id) {
        await createNotification(
          receiverId,
          'message',
          'New Message',
          `${currentUser.fullName}: ${lastMessageText.substring(0, 50)}${lastMessageText.length > 50 ? '...' : ''}`,
          { conversationId, senderId: currentUser.id }
        );
      }
      
      return newMessage;
    } catch (error) {
      console.error('Send message error:', error);
      return null;
    }
  }, [currentUser, messages, createNotification]);

  const getConversation = useCallback((conversationId: string) => {
    return conversations.find(c => c.id === conversationId);
  }, [conversations]);

  const getMessages = useCallback((conversationId: string) => {
    return messages[conversationId] || [];
  }, [messages]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!currentUser) return false;
    
    try {
      // First, get the conversation to find its participants
      const { data: conversationData } = await supabase
        .from('conversations')
        .select('participant_ids')
        .eq('id', conversationId)
        .single();

      if (!conversationData) {
        console.error('Conversation not found');
        // Still try to delete by ID
        const { error } = await supabase
          .from('conversations')
          .delete()
          .eq('id', conversationId);
        if (error) {
          console.error('Error deleting conversation:', error);
          return false;
        }
        // Update local state
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        setMessages(prev => {
          const updated = { ...prev };
          delete updated[conversationId];
          return updated;
        });
        return true;
      }

      const participantIds = conversationData.participant_ids || [];
      const participantIdsSorted = [...participantIds].sort();
      
      // Find ALL conversations with the same participants (to handle duplicates)
      // Query all conversations for current user, then filter for exact participant matches
      const { data: allUserConversations, error: queryError } = await supabase
        .from('conversations')
        .select('id, participant_ids')
        .contains('participant_ids', [currentUser.id]);

      if (queryError) {
        console.error('Error querying matching conversations:', queryError);
      }

      // Filter to get exact matches (order-independent) - same participants
      const exactMatches = allUserConversations?.filter((conv: any) => {
        const convParticipants = conv.participant_ids || [];
        if (convParticipants.length !== participantIds.length) return false;
        const convSorted = [...convParticipants].sort();
        return convSorted.every((id, i) => id === participantIdsSorted[i]);
      }) || [];

      const conversationIdsToDelete = exactMatches.map((c: any) => c.id);
      
      // Update local state immediately for better UX - remove ALL conversations with these participants
      setConversations(prev => {
        return prev.filter(c => {
          const cParticipants = c.participants || [];
          if (cParticipants.length !== participantIds.length) return true;
          const cSorted = [...cParticipants].sort();
          return !cSorted.every((id, i) => id === participantIdsSorted[i]);
        });
      });

      // Delete messages for all matching conversations FIRST
      if (conversationIdsToDelete.length > 0) {
        const { error: messagesError } = await supabase
          .from('messages')
          .delete()
          .in('conversation_id', conversationIdsToDelete);

        if (messagesError) {
          console.error('Error deleting messages:', messagesError);
          // Continue with conversation deletion even if messages deletion fails
        }
      }

      // Delete ALL conversations with the same participants (to handle duplicates)
      if (conversationIdsToDelete.length > 0) {
        const { error: conversationError } = await supabase
          .from('conversations')
          .delete()
          .in('id', conversationIdsToDelete);

        if (conversationError) {
          console.error('Error deleting conversations:', conversationError);
          console.error('Conversation IDs attempted:', conversationIdsToDelete);
          // Still update local state to remove from UI even if DB deletion fails
          setConversations(prev => prev.filter(c => !conversationIdsToDelete.includes(c.id)));
          setMessages(prev => {
            const updated = { ...prev };
            conversationIdsToDelete.forEach(convId => {
              delete updated[convId];
            });
            return updated;
          });
          return false;
        }
      } else {
        // Fallback: delete just this conversation
        const { error: conversationError } = await supabase
          .from('conversations')
          .delete()
          .eq('id', conversationId);

        if (conversationError) {
          console.error('Error deleting conversation:', conversationError);
          // Still update local state to remove from UI even if DB deletion fails
          setConversations(prev => prev.filter(c => c.id !== conversationId));
          setMessages(prev => {
            const updated = { ...prev };
            delete updated[conversationId];
            return updated;
          });
          return false;
        }
      }

      // Also remove messages from local state for all deleted conversations
      setMessages(prev => {
        const updated = { ...prev };
        conversationIdsToDelete.forEach(convId => {
          delete updated[convId];
        });
        return updated;
      });

      return true;
    } catch (error) {
      console.error('Delete conversation error:', error);
      return false;
    }
  }, [currentUser]);

  const deleteMessage = useCallback(async (messageId: string, conversationId: string, deleteForEveryone: boolean = false) => {
    if (!currentUser) return false;
    
    try {
      const conversationMessages = messages[conversationId] || [];
      const message = conversationMessages.find(m => m.id === messageId);
      
      if (!message) return false;

      const isSender = message.senderId === currentUser.id;
      const isReceiver = message.receiverId === currentUser.id;

      if (!isSender && !isReceiver) {
        return false; // User is not part of this message
      }

      // Helper function to get the last non-deleted message for conversation preview
      const getLastNonDeletedMessage = async (convId: string, userId: string) => {
        const { data: allMessages } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(50); // Check last 50 messages
        
        if (!allMessages || allMessages.length === 0) {
          return { lastMessage: '', lastMessageAt: new Date().toISOString() };
        }

        // Find the most recent message that is not deleted for this user
        for (const msg of allMessages) {
          const isSender = msg.sender_id === userId;
          const isReceiver = msg.receiver_id === userId;
          const deletedForMe = (isSender && msg.deleted_for_sender) || (isReceiver && msg.deleted_for_receiver);
          
          if (!deletedForMe) {
            const lastMessageText = msg.message_type === 'image' 
              ? '📷 Image' 
              : msg.message_type === 'document' 
              ? `📄 ${msg.document_name || 'Document'}`
              : msg.content;
            return { 
              lastMessage: lastMessageText, 
              lastMessageAt: msg.created_at 
            };
          }
        }
        
        // If all messages are deleted, return empty
        return { lastMessage: '', lastMessageAt: new Date().toISOString() };
      };

      if (deleteForEveryone && isSender) {
        // Delete for everyone - mark as deleted for both
        await supabase
          .from('messages')
          .update({
            deleted_for_sender: true,
            deleted_for_receiver: true,
            content: 'This message was deleted',
          })
          .eq('id', messageId);

        // Update conversation last message
        const { lastMessage, lastMessageAt } = await getLastNonDeletedMessage(conversationId, currentUser.id);
        await supabase
          .from('conversations')
          .update({
            last_message: lastMessage,
            last_message_at: lastMessageAt,
          })
          .eq('id', conversationId);

        // Update local state
        const updatedMessages = {
          ...messages,
          [conversationId]: conversationMessages.map(m => 
            m.id === messageId 
              ? { ...m, deletedForSender: true, deletedForReceiver: true, content: 'This message was deleted' }
              : m
          ),
        };
        setMessages(updatedMessages);

        // Update local conversations state
        setConversations(prev => {
          const existingIndex = prev.findIndex(c => c.id === conversationId);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              lastMessage: lastMessage,
              lastMessageAt: lastMessageAt,
            };
            // Sort by last_message_at descending (most recent first)
            return updated.sort((a, b) => 
              new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
            );
          }
          return prev;
        });
      } else {
        // Delete for me only
        if (isSender) {
          const { error: updateError } = await supabase
            .from('messages')
            .update({ deleted_for_sender: true })
            .eq('id', messageId);

          if (updateError) {
            console.error('Failed to delete message for sender:', JSON.stringify(updateError, null, 2));
            throw updateError;
          }

          // Update conversation last message if this was the last message
          const { lastMessage, lastMessageAt } = await getLastNonDeletedMessage(conversationId, currentUser.id);
          await supabase
            .from('conversations')
            .update({
              last_message: lastMessage,
              last_message_at: lastMessageAt,
            })
            .eq('id', conversationId);

          const updatedMessages = {
            ...messages,
            [conversationId]: conversationMessages.map(m => 
              m.id === messageId ? { ...m, deletedForSender: true } : m
            ),
          };
          setMessages(updatedMessages);

          // Update local conversations state
          setConversations(prev => {
            const existingIndex = prev.findIndex(c => c.id === conversationId);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                lastMessage: lastMessage,
                lastMessageAt: lastMessageAt,
              };
              // Sort by last_message_at descending (most recent first)
              return updated.sort((a, b) => 
                new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
              );
            }
            return prev;
          });
        } else if (isReceiver) {
          const { error: updateError } = await supabase
            .from('messages')
            .update({ deleted_for_receiver: true })
            .eq('id', messageId);

          if (updateError) {
            console.error('Failed to delete message for receiver:', JSON.stringify(updateError, null, 2));
            throw updateError;
          }

          // Update conversation last message if this was the last message
          const { lastMessage, lastMessageAt } = await getLastNonDeletedMessage(conversationId, currentUser.id);
          await supabase
            .from('conversations')
            .update({
              last_message: lastMessage,
              last_message_at: lastMessageAt,
            })
            .eq('id', conversationId);

          const updatedMessages = {
            ...messages,
            [conversationId]: conversationMessages.map(m => 
              m.id === messageId ? { ...m, deletedForReceiver: true } : m
            ),
          };
          setMessages(updatedMessages);

          // Update local conversations state
          setConversations(prev => {
            const existingIndex = prev.findIndex(c => c.id === conversationId);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                lastMessage: lastMessage,
                lastMessageAt: lastMessageAt,
              };
              // Sort by last_message_at descending (most recent first)
              return updated.sort((a, b) => 
                new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
              );
            }
            return prev;
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Delete message error:', error);
      return false;
    }
  }, [currentUser, messages]);

  const createOrGetConversation = useCallback(async (otherUserId: string) => {
    if (!currentUser) return null;
    
    try {
      // First, check if conversation already exists in local state
      const existingInState = conversations.find((conv) => {
        const participants = conv.participants || [];
        return participants.includes(currentUser.id) && 
               participants.includes(otherUserId) && 
               participants.length === 2;
      });

      if (existingInState) {
        return existingInState;
      }

      // Check if a conversation already exists between these two users in database
      // Query for conversations that contain the current user, then filter for the other user
      const { data: existingConversations, error: queryError } = await supabase
        .from('conversations')
        .select('*')
        .contains('participant_ids', [currentUser.id]);

      if (queryError) {
        console.error('Error querying conversations:', queryError);
      }

      // Filter to find conversation with exactly these two participants
      const existingConv = existingConversations?.find((conv: any) => {
        const participants = conv.participant_ids || [];
        const hasCurrentUser = participants.includes(currentUser.id);
        const hasOtherUser = participants.includes(otherUserId);
        const isTwoParticipants = participants.length === 2;
        
        if (hasCurrentUser && hasOtherUser && isTwoParticipants) {
          console.log('Found existing conversation:', conv.id, 'with participants:', participants);
          return true;
        }
        return false;
      });

      if (!existingConv) {
        console.log('No existing conversation found between', currentUser.id, 'and', otherUserId);
      }

      if (existingConv) {
        // Conversation exists, return it
        const { data: participantsData } = await supabase
          .from('users')
          .select('id, full_name, profile_picture')
          .in('id', existingConv.participant_ids);

        // Create a map for quick lookup
        const participantsMap = new Map(
          participantsData?.map((p: any) => [p.id, { name: p.full_name, avatar: p.profile_picture }]) || []
        );

        // Ensure arrays are in the same order as participant_ids
        const participantNames = existingConv.participant_ids.map((id: string) => participantsMap.get(id)?.name || 'Unknown');
        const participantAvatars = existingConv.participant_ids.map((id: string) => participantsMap.get(id)?.avatar);

        const conversation: Conversation = {
          id: existingConv.id,
          participants: existingConv.participant_ids,
          participantNames,
          participantAvatars,
          lastMessage: existingConv.last_message || '',
          lastMessageAt: existingConv.last_message_at,
          unreadCount: 0,
        };

        // Update conversations list - replace if exists, add if new
        setConversations(prev => {
          const existingIndex = prev.findIndex(c => c.id === conversation.id);
          if (existingIndex >= 0) {
            // Update existing conversation
            const updated = [...prev];
            updated[existingIndex] = conversation;
            return updated;
          } else {
            // Add new conversation at the beginning
            return [conversation, ...prev];
          }
        });

        return conversation;
      }

      // Create new conversation
      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          participant_ids: [currentUser.id, otherUserId],
        })
        .select()
        .single();

      if (error) throw error;

      // Get participant data
      const { data: participantsData } = await supabase
        .from('users')
        .select('id, full_name, profile_picture')
        .in('id', [currentUser.id, otherUserId]);

      // Create a map for quick lookup
      const participantsMap = new Map(
        participantsData?.map((p: any) => [p.id, { name: p.full_name, avatar: p.profile_picture }]) || []
      );

      // Ensure arrays are in the same order as participant_ids
      const participantNames = newConversation.participant_ids.map((id: string) => participantsMap.get(id)?.name || 'Unknown');
      const participantAvatars = newConversation.participant_ids.map((id: string) => participantsMap.get(id)?.avatar);

      const conversation: Conversation = {
        id: newConversation.id,
        participants: newConversation.participant_ids,
        participantNames,
        participantAvatars,
        lastMessage: '',
        lastMessageAt: newConversation.created_at,
        unreadCount: 0,
      };

      // Add to conversations list
      setConversations([conversation, ...conversations]);

      return conversation;
    } catch (error) {
      console.error('Create or get conversation error:', error);
      return null;
    }
  }, [currentUser, conversations]);

  const getComments = useCallback((postId: string) => {
    return comments[postId] || [];
  }, [comments]);

  const createAdvertisement = useCallback(async (adData: Omit<Advertisement, 'id' | 'impressions' | 'clicks' | 'createdAt' | 'updatedAt'>) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) return null;
    
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .insert({
          title: adData.title,
          description: adData.description,
          image_url: adData.imageUrl,
          link_url: adData.linkUrl,
          type: adData.type,
          placement: adData.placement,
          active: adData.active,
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newAd: Advertisement = {
        id: data.id,
        title: data.title,
        description: data.description,
        imageUrl: data.image_url,
        linkUrl: data.link_url,
        type: data.type,
        placement: data.placement,
        active: data.active,
        impressions: data.impressions,
        clicks: data.clicks,
        createdBy: data.created_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setAdvertisements([newAd, ...advertisements]);
      return newAd;
    } catch (error) {
      console.error('Create advertisement error:', error);
      return null;
    }
  }, [currentUser, advertisements]);

  const updateAdvertisement = useCallback(async (adId: string, updates: Partial<Advertisement>) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) return;
    
    try {
      const updateData: any = {};
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
      if (updates.linkUrl !== undefined) updateData.link_url = updates.linkUrl;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.placement !== undefined) updateData.placement = updates.placement;
      if (updates.active !== undefined) updateData.active = updates.active;

      const { error } = await supabase
        .from('advertisements')
        .update(updateData)
        .eq('id', adId);

      if (error) throw error;

      const updatedAds = advertisements.map(ad => 
        ad.id === adId ? { ...ad, ...updates, updatedAt: new Date().toISOString() } : ad
      );
      setAdvertisements(updatedAds);
    } catch (error) {
      console.error('Update advertisement error:', error);
    }
  }, [currentUser, advertisements]);

  const deleteAdvertisement = useCallback(async (adId: string) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) return;
    
    try {
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', adId);

      if (error) throw error;

      const updatedAds = advertisements.filter(ad => ad.id !== adId);
      setAdvertisements(updatedAds);
    } catch (error) {
      console.error('Delete advertisement error:', error);
    }
  }, [currentUser, advertisements]);

  const recordAdImpression = useCallback(async (adId: string) => {
    try {
      if (currentUser) {
        await supabase
          .from('advertisement_impressions')
          .insert({
            advertisement_id: adId,
            user_id: currentUser.id,
          });
      }
    } catch (error) {
      console.error('Record ad impression error:', error);
    }
  }, [currentUser]);

  const recordAdClick = useCallback(async (adId: string) => {
    try {
      if (currentUser) {
        await supabase
          .from('advertisement_clicks')
          .insert({
            advertisement_id: adId,
            user_id: currentUser.id,
          });
      }
    } catch (error) {
      console.error('Record ad click error:', error);
    }
  }, [currentUser]);

  const getActiveAds = useCallback((placement: Advertisement['placement']) => {
    return advertisements.filter(ad => 
      ad.active && (ad.placement === placement || ad.placement === 'all')
    );
  }, [advertisements]);

  /**
   * Feed Algorithm: Prioritizes posts from followed users
   * Algorithm:
   * 1. Posts from followed users get highest priority
   * 2. Within each group, sort by engagement score (likes + comments * 2)
   * 3. Then by recency (newer posts first)
   * 4. Falls back to other posts if not enough followed posts
   */
  const getPersonalizedFeed = useCallback((allPosts: Post[], limit: number = 50): Post[] => {
    if (!currentUser || !follows.length) {
      // If no follows, return posts sorted by engagement and recency
      return allPosts
        .sort((a, b) => {
          const engagementA = a.likes.length + (a.commentCount * 2);
          const engagementB = b.likes.length + (b.commentCount * 2);
          if (engagementB !== engagementA) {
            return engagementB - engagementA;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, limit);
    }

    // Get list of user IDs the current user follows
    const followingIds = new Set(
      follows
        .filter(f => f.followerId === currentUser.id)
        .map(f => f.followingId)
    );

    // Separate posts into followed and non-followed
    const followedPosts: Post[] = [];
    const otherPosts: Post[] = [];

    allPosts.forEach(post => {
      if (followingIds.has(post.userId)) {
        followedPosts.push(post);
      } else {
        otherPosts.push(post);
      }
    });

    // Calculate engagement score for sorting
    const getEngagementScore = (post: Post) => {
      return post.likes.length + (post.commentCount * 2);
    };

    // Sort both groups by engagement, then recency
    const sortByEngagement = (a: Post, b: Post) => {
      const engagementA = getEngagementScore(a);
      const engagementB = getEngagementScore(b);
      if (engagementB !== engagementA) {
        return engagementB - engagementA;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };

    followedPosts.sort(sortByEngagement);
    otherPosts.sort(sortByEngagement);

    // Combine: followed posts first, then other posts
    // Mix in some other posts to keep feed diverse (every 3rd post from others)
    const personalizedFeed: Post[] = [];
    let followedIndex = 0;
    let otherIndex = 0;
    let postCount = 0;

    while (postCount < limit && (followedIndex < followedPosts.length || otherIndex < otherPosts.length)) {
      // Prioritize followed posts, but mix in others every 3rd position
      if (followedIndex < followedPosts.length && (postCount % 3 !== 2 || otherIndex >= otherPosts.length)) {
        personalizedFeed.push(followedPosts[followedIndex]);
        followedIndex++;
      } else if (otherIndex < otherPosts.length) {
        personalizedFeed.push(otherPosts[otherIndex]);
        otherIndex++;
      } else {
        break;
      }
      postCount++;
    }

    return personalizedFeed;
  }, [currentUser, follows]);

  /**
   * Smart Advertisement Algorithm
   * Features:
   * 1. Admin ads: Rotate for everyone, track views to avoid repetition
   * 2. Regular ads: Personalize based on user engagement/interests
   * 3. Avoids showing same ad too frequently to same user
   */
  const getSmartAds = useCallback(async (
    placement: Advertisement['placement'],
    excludeAdIds: string[] = [],
    limit: number = 10
  ): Promise<Advertisement[]> => {
    if (!currentUser) {
      return getActiveAds(placement).slice(0, limit);
    }

    try {
      const allAds = getActiveAds(placement);
      
      // Separate admin ads from regular ads
      const adminAds: Advertisement[] = [];
      const regularAds: Advertisement[] = [];

      // Check which users are admins
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .in('role', ['admin', 'super_admin', 'moderator']);

      const adminUserIds = new Set(adminUsers?.map(u => u.id) || []);

      allAds.forEach(ad => {
        if (adminUserIds.has(ad.createdBy)) {
          adminAds.push(ad);
        } else {
          regularAds.push(ad);
        }
      });

      // Get user's ad impression history (last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      const { data: recentImpressions } = await supabase
        .from('advertisement_impressions')
        .select('advertisement_id, created_at')
        .eq('user_id', currentUser.id)
        .gte('created_at', oneDayAgo.toISOString());

      const impressionCounts = new Map<string, number>();
      recentImpressions?.forEach(imp => {
        const count = impressionCounts.get(imp.advertisement_id) || 0;
        impressionCounts.set(imp.advertisement_id, count + 1);
      });

      // Get user's engagement data for personalization
      const { data: userLikes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', currentUser.id)
        .limit(100);

      const { data: userComments } = await supabase
        .from('comments')
        .select('post_id')
        .eq('user_id', currentUser.id)
        .limit(100);

      // Get posts user engaged with to understand interests
      const engagedPostIds = new Set([
        ...(userLikes?.map(l => l.post_id) || []),
        ...(userComments?.map(c => c.post_id) || [])
      ]);

      // Score regular ads based on personalization factors
      // Rotation: Ads shown recently get lower scores but are NOT excluded
      // This ensures natural rotation like Facebook - different ads each time, but ads can reappear
      const scoredRegularAds = regularAds
        .filter(ad => !excludeAdIds.includes(ad.id))
        .map(ad => {
          let score = 50; // Base score for regular ads
          
          // Base score from ad performance (CTR)
          const ctr = ad.impressions > 0 ? ad.clicks / ad.impressions : 0;
          score += ctr * 50;

          // Penalize ads shown recently to this user (for rotation)
          // But don't exclude them - just make them less likely to be selected
          const viewCount = impressionCounts.get(ad.id) || 0;
          score -= viewCount * 15; // Reduce score for each view in last 24h

          // Add randomness for diversity and rotation
          score += Math.random() * 20;

          return { ad, score };
        })
        .sort((a, b) => b.score - a.score);

      // Select admin ads with rotation (avoid recently shown ones, but don't exclude)
      const scoredAdminAds = adminAds
        .filter(ad => !excludeAdIds.includes(ad.id))
        .map(ad => {
          let score = 100; // Base score for admin ads (higher priority)
          
          // Penalize recently shown admin ads (for rotation)
          // But they can still appear again - just less frequently
          const viewCount = impressionCounts.get(ad.id) || 0;
          score -= viewCount * 25; // Reduce score for each view in last 24h

          // Add randomness for rotation and diversity
          score += Math.random() * 20;

          return { ad, score };
        })
        .sort((a, b) => b.score - a.score);

      // Combine ads: Mix admin and regular ads
      // Admin ads get priority but we want diversity
      const selectedAds: Advertisement[] = [];
      const usedAdIds = new Set<string>();

      // Add admin ads first (up to 40% of limit)
      const adminLimit = Math.ceil(limit * 0.4);
      scoredAdminAds.slice(0, adminLimit).forEach(({ ad }) => {
        if (!usedAdIds.has(ad.id)) {
          selectedAds.push(ad);
          usedAdIds.add(ad.id);
        }
      });

      // Fill remaining with regular ads
      scoredRegularAds.forEach(({ ad }) => {
        if (selectedAds.length < limit && !usedAdIds.has(ad.id)) {
          selectedAds.push(ad);
          usedAdIds.add(ad.id);
        }
      });

      // If we still need more ads, add more admin ads
      if (selectedAds.length < limit) {
        scoredAdminAds.forEach(({ ad }) => {
          if (selectedAds.length < limit && !usedAdIds.has(ad.id)) {
            selectedAds.push(ad);
            usedAdIds.add(ad.id);
          }
        });
      }

      return selectedAds;
    } catch (error) {
      console.error('Error getting smart ads:', error);
      // Fallback to simple rotation
      return getActiveAds(placement)
        .filter(ad => !excludeAdIds.includes(ad.id))
        .slice(0, limit);
    }
  }, [currentUser, getActiveAds]);

  const setupRealtimeSubscriptions = useCallback((userId: string) => {
    const subs: RealtimeChannel[] = [];

    const messagesChannel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload: any) => {
          // Don't update state if logout is in progress
          if (isLoggingOutRef.current) return;
          
          const isSender = payload.new.sender_id === userId;
          const isReceiver = payload.new.receiver_id === userId;
          const deletedForMe = (isSender && payload.new.deleted_for_sender) || (isReceiver && payload.new.deleted_for_receiver);
          
          if (deletedForMe) return; // Skip messages deleted for this user

          const newMessage: Message = {
            id: payload.new.id,
            conversationId: payload.new.conversation_id,
            senderId: payload.new.sender_id,
            receiverId: payload.new.receiver_id,
            content: payload.new.content,
            mediaUrl: payload.new.media_url,
            documentUrl: payload.new.document_url,
            documentName: payload.new.document_name,
            messageType: (payload.new.message_type || 'text') as 'text' | 'image' | 'document',
            deletedForSender: payload.new.deleted_for_sender || false,
            deletedForReceiver: payload.new.deleted_for_receiver || false,
            read: payload.new.read,
            createdAt: payload.new.created_at,
            statusId: payload.new.status_id,
            statusPreviewUrl: payload.new.status_preview_url,
          };
          setMessages(prev => ({
            ...prev,
            [newMessage.conversationId]: [...(prev[newMessage.conversationId] || []), newMessage],
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload: any) => {
          // Don't update state if logout is in progress
          if (isLoggingOutRef.current) return;
          
          // Handle message updates (including deletions)
          const isSender = payload.new.sender_id === userId;
          const isReceiver = payload.new.receiver_id === userId;
          const deletedForMe = (isSender && payload.new.deleted_for_sender) || (isReceiver && payload.new.deleted_for_receiver);
          
          if (deletedForMe) {
            // Remove deleted message from state
            setMessages(prev => {
              const updated = { ...prev };
              const conversationId = payload.new.conversation_id;
              if (updated[conversationId]) {
                updated[conversationId] = updated[conversationId].filter(m => m.id !== payload.new.id);
              }
              return updated;
            });
          } else {
            // Update message in state
            const updatedMessage: Message = {
              id: payload.new.id,
              conversationId: payload.new.conversation_id,
              senderId: payload.new.sender_id,
              receiverId: payload.new.receiver_id,
              content: payload.new.content,
              mediaUrl: payload.new.media_url,
              documentUrl: payload.new.document_url,
              documentName: payload.new.document_name,
              messageType: (payload.new.message_type || 'text') as 'text' | 'image' | 'document',
              deletedForSender: payload.new.deleted_for_sender || false,
              deletedForReceiver: payload.new.deleted_for_receiver || false,
              read: payload.new.read,
              createdAt: payload.new.created_at,
            };
            setMessages(prev => ({
              ...prev,
              [updatedMessage.conversationId]: (prev[updatedMessage.conversationId] || []).map(m =>
                m.id === updatedMessage.id ? updatedMessage : m
              ),
            }));
          }
        }
      )
      .subscribe();
    subs.push(messagesChannel);

    // Setup notifications channel with polling fallback
    const startNotificationPolling = (pollUserId: string) => {
      if (notificationPollIntervalRef.current) return; // Already polling
      
      console.log('🔄 Starting notification polling fallback...');
      notificationPollIntervalRef.current = setInterval(async () => {
        // Don't poll if logout is in progress
        if (isLoggingOutRef.current) return;
        
        try {
          const { data: newNotifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', pollUserId)
            .order('created_at', { ascending: false })
            .limit(20); // Check more notifications
          
          if (error) {
            console.error('Error polling notifications:', error);
            return;
          }
          
          if (newNotifications && newNotifications.length > 0) {
            setNotifications(prev => {
              const existingIds = new Set(prev.map(n => n.id));
              const formatted = newNotifications
                .filter((n: any) => !existingIds.has(n.id))
                .map((n: any) => ({
                  id: n.id,
                  userId: n.user_id,
                  type: n.type,
                  title: n.title,
                  message: n.message,
                  data: n.data,
                  read: n.read,
                  createdAt: n.created_at,
                }));
              
              if (formatted.length > 0) {
                console.log(`📬 Polling found ${formatted.length} new notification(s)`);
                return [...formatted, ...prev];
              }
              return prev;
            });
          }
        } catch (error) {
          console.error('Error in notification polling:', error);
        }
      }, 2000); // Poll every 2 seconds for faster updates
      
      // Poll immediately when starting
      (async () => {
        // Don't poll if logout is in progress
        if (isLoggingOutRef.current) return;
        
        try {
          const { data: newNotifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', pollUserId)
            .order('created_at', { ascending: false })
            .limit(20);
          
          if (!error && newNotifications && newNotifications.length > 0) {
            setNotifications(prev => {
              const existingIds = new Set(prev.map(n => n.id));
              const formatted = newNotifications
                .filter((n: any) => !existingIds.has(n.id))
                .map((n: any) => ({
                  id: n.id,
                  userId: n.user_id,
                  type: n.type,
                  title: n.title,
                  message: n.message,
                  data: n.data,
                  read: n.read,
                  createdAt: n.created_at,
                }));
              
              if (formatted.length > 0) {
                console.log(`📬 Immediate poll found ${formatted.length} new notification(s)`);
                return [...formatted, ...prev];
              }
              return prev;
            });
          }
        } catch (error) {
          console.error('Error in immediate notification poll:', error);
        }
      })();
    };
    
    // Setup notifications channel
    // Use a unique channel name to avoid conflicts
    console.log('📡 Setting up notifications subscription for user:', userId);
    const notificationsChannel = supabase
      .channel(`user_notifications_${userId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload: any) => {
          // Don't update state if logout is in progress
          if (isLoggingOutRef.current) return;
          
          // Only process notifications for this user (filter in handler)
          if (!payload.new || payload.new.user_id !== userId) {
            return; // Not for this user, ignore silently
          }
          
          console.log('📬 Real-time notification received:', {
            notificationId: payload.new.id,
            userId: payload.new.user_id,
            type: payload.new.type,
          });

          // Fallback: show an OS-level notification immediately (works even without a push backend,
          // but only while the app is running). Real push delivery still requires sending to this
          // device's Expo push token from your backend.
          showLocalNotification({
            title: payload.new.title ?? 'Notification',
            body: payload.new.message ?? '',
            data: payload.new.data ?? {},
          });
          
          // Check if notification already exists (avoid duplicates)
          setNotifications(prev => {
            const exists = prev.some(n => n.id === payload.new.id);
            if (exists) {
              console.log('⚠️ Notification already exists, skipping duplicate:', payload.new.id);
              return prev;
            }
            
            console.log('✅ Adding notification to state:', payload.new.id);
            const newNotification: Notification = {
              id: payload.new.id,
              userId: payload.new.user_id,
              type: payload.new.type,
              title: payload.new.title,
              message: payload.new.message,
              data: payload.new.data,
              read: payload.new.read,
              createdAt: payload.new.created_at,
            };
            return [newNotification, ...prev];
          });
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Notifications subscription:', status);
        if (err) {
          // Handle CHANNEL_ERROR gracefully - it's often non-fatal and just means real-time isn't available
          const errorMessage = err?.message || String(err);
          if (errorMessage.includes('CHANNEL_ERROR')) {
            console.warn('Notifications subscription channel error (falling back to polling):', errorMessage);
          } else {
            console.warn('Notifications subscription error:', err);
          }
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Notifications subscription: SUBSCRIBED');
          // Stop polling if real-time is working
          if (notificationPollIntervalRef.current) {
            clearInterval(notificationPollIntervalRef.current);
            notificationPollIntervalRef.current = null;
            console.log('🛑 Stopped notification polling (real-time is working)');
          }
        } else if (status === 'CLOSED') {
          console.log('❌ Notifications subscription: CLOSED - Starting polling fallback');
          if (!notificationPollIntervalRef.current) {
            startNotificationPolling(userId);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ Notifications subscription error:', status, err ? (err.message || String(err)) : '');
          if (!notificationPollIntervalRef.current) {
            console.log('⚠️ Starting notification polling fallback');
            startNotificationPolling(userId);
          }
        }
      });
    subs.push(notificationsChannel);

    // Subscribe to conversation updates (for last_message changes) and deletions
    const conversationsChannel = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload: any) => {
          // Don't update state if logout is in progress
          if (isLoggingOutRef.current) return;
          
          const updatedConv = payload.new;
          // Check if this conversation involves the current user
          const participantIds = updatedConv.participant_ids || [];
          if (participantIds.includes(userId)) {
            setConversations(prev => {
              const existingIndex = prev.findIndex(c => c.id === updatedConv.id);
              if (existingIndex >= 0) {
                // Only update if conversation still exists - don't re-add deleted ones
                // Update existing conversation
                const updated = [...prev];
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  lastMessage: updatedConv.last_message || '',
                  lastMessageAt: updatedConv.last_message_at,
                };
                // Sort by last_message_at descending (most recent first)
                return updated.sort((a, b) => 
                  new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
                );
              }
              // Don't add new conversations via UPDATE events - only via initial load
              return prev;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'conversations',
        },
        (payload: any) => {
          // Don't update state if logout is in progress
          if (isLoggingOutRef.current) return;
          
          // Remove deleted conversation from local state
          const deletedConvId = payload.old.id;
          setConversations(prev => prev.filter(c => c.id !== deletedConvId));
          setMessages(prev => {
            const updated = { ...prev };
            delete updated[deletedConvId];
            return updated;
          });
        }
      )
      .subscribe();
    subs.push(conversationsChannel);

    const requestsChannel = supabase
      .channel('relationship_requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'relationship_requests',
          filter: `to_user_id=eq.${userId}`,
        },
        async () => {
          // Don't update state if logout is in progress
          if (isLoggingOutRef.current) return;
          
          const { data: requestsData } = await supabase
            .from('relationship_requests')
            .select('*')
            .eq('to_user_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

          if (requestsData) {
            const formattedRequests: RelationshipRequest[] = requestsData.map((req: any) => ({
              id: req.id,
              fromUserId: req.from_user_id,
              fromUserName: req.from_user_name,
              toUserId: req.to_user_id,
              relationshipType: req.relationship_type,
              status: req.status,
              createdAt: req.created_at,
            }));
            setRelationshipRequests(formattedRequests);
          }
        }
      )
      .subscribe();
    subs.push(requestsChannel);

    // Real-time subscription for relationships
    // This ensures both partners see updates immediately across all devices
    const relationshipsChannel = supabase
      .channel('relationships_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'relationships',
          filter: `user_id=eq.${userId}`,
        },
        async (payload: any) => {
          // Don't update state if logout is in progress
          if (isLoggingOutRef.current) return;
          
          console.log('Relationship updated (user_id):', payload);
          await refreshRelationships();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'relationships',
          filter: `partner_user_id=eq.${userId}`,
        },
        async (payload: any) => {
          // Don't update state if logout is in progress
          if (isLoggingOutRef.current) return;
          
          console.log('Relationship updated (partner_user_id):', payload);
          await refreshRelationships();
        }
      )
      .subscribe();
    subs.push(relationshipsChannel);

    // Real-time subscription for posts
    const postsChannel = supabase
      .channel('posts_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
        },
        async (payload: any) => {
          // Don't update state if logout is in progress
          if (isLoggingOutRef.current) return;
          
          if (payload.eventType === 'INSERT' && payload.new.moderation_status === 'approved') {
            const { data: userData } = await supabase
              .from('users')
              .select('full_name, profile_picture')
              .eq('id', payload.new.user_id)
              .single();
            
            if (userData) {
              const newPost: Post = {
                id: payload.new.id,
                userId: payload.new.user_id,
                userName: userData.full_name,
                userAvatar: userData.profile_picture,
                content: payload.new.content,
                mediaUrls: payload.new.media_urls || [],
                mediaType: payload.new.media_type,
                likes: [],
                commentCount: payload.new.comment_count || 0,
                createdAt: payload.new.created_at,
              };
              // Add new post at the beginning (newest first) and maintain chronological order
              setPosts(prev => {
                const filtered = prev.filter(p => p.id !== newPost.id);
                return [newPost, ...filtered].sort((a, b) => 
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.moderation_status === 'approved') {
              // Reload posts to get updated one
              const { data: postsData } = await supabase
                .from('posts')
                .select(`
                  *,
                  users!posts_user_id_fkey(full_name, profile_picture)
                `)
                .eq('id', payload.new.id)
                .single();
              
              if (postsData) {
                const { data: postLikesData } = await supabase
                  .from('post_likes')
                  .select('user_id')
                  .eq('post_id', postsData.id);
                
                const likes = postLikesData?.map((l: any) => l.user_id) || [];
                const updatedPost: Post = {
                  id: postsData.id,
                  userId: postsData.user_id,
                  userName: postsData.users.full_name,
                  userAvatar: postsData.users.profile_picture,
                  content: postsData.content,
                  mediaUrls: postsData.media_urls || [],
                  mediaType: postsData.media_type,
                  likes,
                  commentCount: postsData.comment_count,
                  createdAt: postsData.created_at,
                };
                // Maintain chronological order when updating post
                setPosts(prev => {
                  const filtered = prev.filter(p => p.id !== updatedPost.id);
                  return [updatedPost, ...filtered].sort((a, b) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  );
                });
              }
            } else {
              // Remove if rejected
              setPosts(prev => prev.filter(p => p.id !== payload.new.id));
            }
          } else if (payload.eventType === 'DELETE') {
            setPosts(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    subs.push(postsChannel);

    // Real-time subscription for reels
    const reelsChannel = supabase
      .channel('reels_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reels',
        },
        async (payload: any) => {
          // Don't update state if logout is in progress
          if (isLoggingOutRef.current) return;
          
          if (payload.eventType === 'INSERT' && payload.new.moderation_status === 'approved') {
            const { data: userData } = await supabase
              .from('users')
              .select('full_name, profile_picture')
              .eq('id', payload.new.user_id)
              .single();
            
            if (userData) {
              const newReel: Reel = {
                id: payload.new.id,
                userId: payload.new.user_id,
                userName: userData.full_name,
                userAvatar: userData.profile_picture,
                videoUrl: payload.new.video_url,
                thumbnailUrl: payload.new.thumbnail_url,
                caption: payload.new.caption,
                likes: [],
                commentCount: payload.new.comment_count || 0,
                viewCount: payload.new.view_count || 0,
                createdAt: payload.new.created_at,
              };
              setReels(prev => [newReel, ...prev.filter(r => r.id !== newReel.id)]);
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.moderation_status === 'approved') {
              const { data: reelsData } = await supabase
                .from('reels')
                .select(`
                  *,
                  users!reels_user_id_fkey(full_name, profile_picture)
                `)
                .eq('id', payload.new.id)
                .single();
              
              if (reelsData) {
                const { data: reelLikesData } = await supabase
                  .from('reel_likes')
                  .select('user_id')
                  .eq('reel_id', reelsData.id);
                
                const likes = reelLikesData?.map((l: any) => l.user_id) || [];
                const updatedReel: Reel = {
                  id: reelsData.id,
                  userId: reelsData.user_id,
                  userName: reelsData.users.full_name,
                  userAvatar: reelsData.users.profile_picture,
                  videoUrl: reelsData.video_url,
                  thumbnailUrl: reelsData.thumbnail_url,
                  caption: reelsData.caption,
                  likes,
                  commentCount: reelsData.comment_count,
                  viewCount: reelsData.view_count,
                  createdAt: reelsData.created_at,
                };
                setReels(prev => [updatedReel, ...prev.filter(r => r.id !== updatedReel.id)]);
              }
            } else {
              setReels(prev => prev.filter(r => r.id !== payload.new.id));
            }
          } else if (payload.eventType === 'DELETE') {
            setReels(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    subs.push(reelsChannel);

    subscriptionsRef.current = subs;

    return () => {
      subs.forEach(sub => {
        supabase.removeChannel(sub);
      });
      // Clear polling interval if it exists
      if (notificationPollIntervalRef.current) {
        clearInterval(notificationPollIntervalRef.current);
        notificationPollIntervalRef.current = null;
      }
    };
  }, []);

  const followUser = useCallback(async (followingId: string) => {
    if (!currentUser) return null;
    
    // Check if already following
    const alreadyFollowing = follows.some(f => f.followerId === currentUser.id && f.followingId === followingId);
    if (alreadyFollowing) {
      return null; // Already following, no need to do anything
    }
    
    try {
      const { data, error } = await supabase
        .from('follows')
        .insert({
          follower_id: currentUser.id,
          following_id: followingId,
        })
        .select()
        .single();

      if (error) {
        // Handle table not found error
        if (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.message?.includes('Could not find the table')) {
          console.error('❌ Follows table does not exist in database!');
          console.error('📝 Please run migrations/create-follows-table.sql in your Supabase SQL Editor to create the table.');
          throw new Error('Follows table missing. Run migrations/create-follows-table.sql in Supabase SQL Editor.');
        }
        // Handle duplicate follow error gracefully
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          // Already following, just return
          return null;
        }
        throw error;
      }

      if (data) {
        const newFollow: Follow = {
          id: data.id,
          followerId: data.follower_id,
          followingId: data.following_id,
          createdAt: data.created_at,
        };

        setFollows([...follows, newFollow]);
        
        // Send notification to the user being followed (only if not following yourself)
        if (followingId && followingId !== currentUser.id) {
          await createNotification(
            followingId,
            'follow',
            'New Follower',
            `${currentUser.fullName} started following you`,
            { followerId: currentUser.id }
          );
        }
        
        return newFollow;
      }
      return null;
    } catch (error: any) {
      console.error('Follow user error:', error?.message || error?.code || JSON.stringify(error));
      // If it's a duplicate error, that's okay - we're already following
      if (error?.code === '23505' || error?.message?.includes('duplicate') || error?.message?.includes('unique')) {
        return null;
      }
      return null;
    }
  }, [currentUser, follows]);

  const unfollowUser = useCallback(async (followingId: string) => {
    if (!currentUser) return;
    
    // Check if actually following
    const isFollowing = follows.some(f => f.followerId === currentUser.id && f.followingId === followingId);
    if (!isFollowing) {
      return; // Not following, no need to do anything
    }
    
    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', followingId);

      if (error) {
        // Handle table not found error
        if (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.message?.includes('Could not find the table')) {
          console.error('❌ Follows table does not exist in database!');
          console.error('📝 Please run migrations/create-follows-table.sql in your Supabase SQL Editor to create the table.');
          throw new Error('Follows table missing. Run migrations/create-follows-table.sql in Supabase SQL Editor.');
        }
        console.error('Unfollow user error:', error?.message || error?.code || JSON.stringify(error));
        throw error;
      }

      // Update local state
      setFollows(follows.filter(f => !(f.followerId === currentUser.id && f.followingId === followingId)));
    } catch (error: any) {
      console.error('Unfollow user error:', error?.message || error?.code || JSON.stringify(error));
      // Even if there's an error, update local state to reflect user's intent
      setFollows(follows.filter(f => !(f.followerId === currentUser.id && f.followingId === followingId)));
    }
  }, [currentUser, follows]);

  const isFollowing = useCallback((userId: string) => {
    if (!currentUser) return false;
    return follows.some(f => f.followerId === currentUser.id && f.followingId === userId);
  }, [currentUser, follows]);

  const blockUser = useCallback(async (blockedId: string) => {
    if (!currentUser) return;
    
    try {
      // Check if already blocked
      const { data: existingBlock } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', blockedId)
        .single();

      if (existingBlock) {
        return; // Already blocked
      }

      const { data, error } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: currentUser.id,
          blocked_id: blockedId,
        })
        .select()
        .single();

      if (error) {
        // Handle table not found error
        if (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.message?.includes('Could not find the table')) {
          console.error('❌ Blocked users table does not exist in database!');
          throw new Error('Blocked users table missing. Please create it in your database.');
        }
        throw error;
      }

      // Also unfollow if following
      const isFollowing = follows.some(f => f.followerId === currentUser.id && f.followingId === blockedId);
      if (isFollowing) {
        await unfollowUser(blockedId);
      }

      // Update local state
      setBlockedUsers([...blockedUsers, blockedId]);

      return data;
    } catch (error: any) {
      console.error('Block user error:', error?.message || error?.code || JSON.stringify(error));
      throw error;
    }
  }, [currentUser, follows, unfollowUser]);

  const isBlocked = useCallback((userId: string): boolean => {
    if (!currentUser) return false;
    return blockedUsers.includes(userId);
  }, [currentUser, blockedUsers]);

  const unblockUser = useCallback(async (blockedId: string) => {
    if (!currentUser) return;
    
    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', blockedId);

      if (error) {
        throw error;
      }

      // Update local state
      setBlockedUsers(blockedUsers.filter(id => id !== blockedId));
    } catch (error: any) {
      console.error('Unblock user error:', error?.message || error?.code || JSON.stringify(error));
      throw error;
    }
  }, [currentUser, blockedUsers]);

  const addReelComment = useCallback(async (
    reelId: string, 
    content: string, 
    parentCommentId?: string,
    stickerId?: string,
    messageType: 'text' | 'sticker' = 'text'
  ) => {
    if (!currentUser) return null;
    
    // Check if user is restricted from commenting on reels
    const restriction = await checkUserRestriction(currentUser.id, 'reel_comments');
    if (showBanModal(restriction)) {
      return null;
    }
    
    try {
      const insertData: any = {
        reel_id: reelId,
        user_id: currentUser.id,
        content: messageType === 'sticker' ? '' : content, // Empty content for stickers
        message_type: messageType,
      };
      
      if (parentCommentId) {
        insertData.parent_comment_id = parentCommentId;
      }

      if (stickerId && messageType === 'sticker') {
        insertData.sticker_id = stickerId;
      }

      const { data, error } = await supabase
        .from('reel_comments')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Fetch sticker image URL if it's a sticker comment
      let stickerImageUrl: string | undefined;
      if (data.sticker_id && messageType === 'sticker') {
        const { data: stickerData } = await supabase
          .from('stickers')
          .select('image_url')
          .eq('id', data.sticker_id)
          .single();
        if (stickerData) {
          stickerImageUrl = stickerData.image_url;
        }
      }

      const newComment: ReelComment = {
        id: data.id,
        reelId,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.profilePicture,
        content: messageType === 'sticker' ? '' : content,
        stickerId: data.sticker_id || undefined,
        stickerImageUrl,
        messageType: (data.message_type || 'text') as 'text' | 'sticker',
        likes: [],
        createdAt: data.created_at,
        parentCommentId: data.parent_comment_id || undefined,
      };
      
      // If it's a reply, add it to the parent comment's replies, otherwise add to top level
      const updatedComments = { ...reelComments };
      if (parentCommentId) {
        // Find parent comment and add reply
        const reelCommentsList = reelComments[reelId] || [];
        const updatedReelComments = reelCommentsList.map(comment => {
          if (comment.id === parentCommentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newComment],
            };
          }
          return comment;
        });
        updatedComments[reelId] = updatedReelComments;
      } else {
        updatedComments[reelId] = [...(reelComments[reelId] || []), newComment];
      }
      setReelComments(updatedComments);
      
      // Send notifications (outside of map to allow async/await)
      if (parentCommentId) {
        // Find parent comment owner
        const reelCommentsList = reelComments[reelId] || [];
        const parentComment = reelCommentsList.find(c => c.id === parentCommentId);
        if (parentComment && parentComment.userId && parentComment.userId !== currentUser.id) {
          createNotification(
            parentComment.userId,
            'post_comment',
            'New Reply',
            `${currentUser.fullName} replied to your comment: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
            { reelId, commentId: data.id, parentCommentId, userId: currentUser.id }
          ).catch(err => console.error('Failed to send reel reply notification:', err));
        }
      } else {
        const reel = reels.find(r => r.id === reelId);
        if (reel && reel.userId && reel.userId !== currentUser.id) {
          // Send notification to reel owner (if not commenting on own reel)
          createNotification(
            reel.userId,
            'post_comment',
            'New Comment',
            `${currentUser.fullName} commented on your reel: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
            { reelId, commentId: data.id, userId: currentUser.id }
          ).catch(err => console.error('Failed to send reel comment notification:', err));
        }
      }
      
      const updatedReels = reels.map(reel => {
        if (reel.id === reelId) {
          return { ...reel, commentCount: reel.commentCount + 1 };
        }
        return reel;
      });
      setReels(updatedReels);
      
      return newComment;
    } catch (error) {
      console.error('Add reel comment error:', error);
      return null;
    }
  }, [currentUser, reelComments, reels, createNotification]);

  const getReelComments = useCallback((reelId: string) => {
    return reelComments[reelId] || [];
  }, [reelComments]);

  const editReelComment = useCallback(async (commentId: string, content: string) => {
    if (!currentUser) return null;
    
    // Check if user is restricted from editing reel comments
    const restriction = await checkUserRestriction(currentUser.id, 'reel_comments');
    if (showBanModal(restriction)) {
      return null;
    }
    
    try {
      let foundComment: ReelComment | null = null;
      let reelId: string | null = null;

      for (const [rid, commentList] of Object.entries(reelComments)) {
        const comment = commentList.find(c => c.id === commentId);
        if (comment) {
          foundComment = comment;
          reelId = rid;
          break;
        }
        
        // Search in replies
        for (const comment of commentList) {
          if (comment.replies) {
            const reply = comment.replies.find(r => r.id === commentId);
            if (reply) {
              foundComment = reply;
              reelId = rid;
              break;
            }
          }
        }
        if (foundComment) break;
      }

      if (!foundComment || foundComment.userId !== currentUser.id || !reelId) {
        throw new Error('Unauthorized');
      }

      // Prevent editing sticker comments - they can only be deleted
      if (foundComment.messageType === 'sticker') {
        throw new Error('Sticker comments cannot be edited');
      }

      const { data, error } = await supabase
        .from('reel_comments')
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;

      const updatedComments = { ...reelComments };
      const reelCommentsList = reelComments[reelId];
      const isReply = foundComment.parentCommentId !== undefined;
      
      if (isReply) {
        const parentId = foundComment.parentCommentId!;
        updatedComments[reelId] = reelCommentsList.map(comment => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replies: (comment.replies || []).map(c => 
                c.id === commentId ? { ...c, content } : c
              ),
            };
          }
          return comment;
        });
      } else {
        updatedComments[reelId] = reelCommentsList.map(c => 
          c.id === commentId ? { ...c, content } : c
        );
      }
      setReelComments(updatedComments);
      
      return data;
    } catch (error) {
      console.error('Edit reel comment error:', error);
      return null;
    }
  }, [currentUser, reelComments]);

  const deleteReelComment = useCallback(async (commentId: string) => {
    if (!currentUser) return false;
    
    try {
      let foundComment: ReelComment | null = null;
      let reelId: string | null = null;
      let parentCommentId: string | null = null;

      // Search in top-level comments and replies
      for (const [rid, commentList] of Object.entries(reelComments)) {
        const topLevelComment = commentList.find(c => c.id === commentId);
        if (topLevelComment) {
          foundComment = topLevelComment;
          reelId = rid;
          break;
        }
        
        // Search in replies
        for (const comment of commentList) {
          if (comment.replies) {
            const reply = comment.replies.find(r => r.id === commentId);
            if (reply) {
              foundComment = reply;
              reelId = rid;
              parentCommentId = comment.id;
              break;
            }
          }
        }
        if (foundComment) break;
      }

      if (!foundComment || foundComment.userId !== currentUser.id || !reelId) {
        throw new Error('Unauthorized');
      }

      const { error } = await supabase
        .from('reel_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      const updatedComments = { ...reelComments };
      if (parentCommentId) {
        // Remove from parent's replies
        updatedComments[reelId] = reelComments[reelId].map(comment => {
          if (comment.id === parentCommentId) {
            return {
              ...comment,
              replies: (comment.replies || []).filter(r => r.id !== commentId),
            };
          }
          return comment;
        });
      } else {
        // Remove top-level comment
        updatedComments[reelId] = reelComments[reelId].filter(c => c.id !== commentId);
      }
      setReelComments(updatedComments);

      const updatedReels = reels.map(r => 
        r.id === reelId ? { ...r, commentCount: Math.max(0, r.commentCount - 1) } : r
      );
      setReels(updatedReels);
      
      return true;
    } catch (error) {
      console.error('Delete reel comment error:', error);
      return false;
    }
  }, [currentUser, reelComments, reels]);

  const toggleReelCommentLike = useCallback(async (commentId: string, reelId: string) => {
    if (!currentUser) return false;
    
    try {
      // Check if already liked
      const reelCommentsList = reelComments[reelId] || [];
      let comment: ReelComment | null = null;
      let isReply = false;
      let parentCommentId: string | null = null;

      // Search in top-level comments
      comment = reelCommentsList.find(c => c.id === commentId) || null;
      
      // If not found, search in replies
      if (!comment) {
        for (const c of reelCommentsList) {
          if (c.replies) {
            const reply = c.replies.find(r => r.id === commentId);
            if (reply) {
              comment = reply;
              isReply = true;
              parentCommentId = c.id;
              break;
            }
          }
        }
      }

      if (!comment) return false;

      const isLiked = comment.likes.includes(currentUser.id);

      if (isLiked) {
        // Unlike
        await supabase
          .from('reel_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUser.id);

        const updatedLikes = comment.likes.filter(id => id !== currentUser.id);
        
        const updatedComments = { ...reelComments };
        if (isReply && parentCommentId) {
          updatedComments[reelId] = reelCommentsList.map(c => {
            if (c.id === parentCommentId) {
              return {
                ...c,
                replies: (c.replies || []).map(r => 
                  r.id === commentId ? { ...r, likes: updatedLikes } : r
                ),
              };
            }
            return c;
          });
        } else {
          updatedComments[reelId] = reelCommentsList.map(c => 
            c.id === commentId ? { ...c, likes: updatedLikes } : c
          );
        }
        setReelComments(updatedComments);
      } else {
        // Like
        await supabase
          .from('reel_comment_likes')
          .insert({
            comment_id: commentId,
            user_id: currentUser.id,
          });

        const updatedLikes = [...comment.likes, currentUser.id];
        
        const updatedComments = { ...reelComments };
        if (isReply && parentCommentId) {
          updatedComments[reelId] = reelCommentsList.map(c => {
            if (c.id === parentCommentId) {
              return {
                ...c,
                replies: (c.replies || []).map(r => 
                  r.id === commentId ? { ...r, likes: updatedLikes } : r
                ),
              };
            }
            return c;
          });
        } else {
          updatedComments[reelId] = reelCommentsList.map(c => 
            c.id === commentId ? { ...c, likes: updatedLikes } : c
          );
        }
        setReelComments(updatedComments);
      }

      return true;
    } catch (error) {
      console.error('Toggle reel comment like error:', error);
      return false;
    }
  }, [currentUser, reelComments]);

  const reportContent = useCallback(async (
    contentType: ReportedContent['contentType'],
    contentId: string | undefined,
    reportedUserId: string | undefined,
    reason: string,
    description?: string
  ) => {
    if (!currentUser) return null;
    
    try {
      const { data, error } = await supabase
        .from('reported_content')
        .insert({
          reporter_id: currentUser.id,
          reported_user_id: reportedUserId,
          content_type: contentType,
          content_id: contentId,
          reason,
          description,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Report content error:', error);
      return null;
    }
  }, [currentUser]);

  const reportFalseRelationship = useCallback(async (
    relationshipId: string,
    reason?: string,
    evidenceUrls?: string[]
  ) => {
    if (!currentUser) return null;
    
    try {
      // Check if user has already reported this relationship
      const { data: existingReport } = await supabase
        .from('false_relationship_reports')
        .select('*')
        .eq('relationship_id', relationshipId)
        .eq('reported_by', currentUser.id)
        .maybeSingle();

      if (existingReport) {
        throw new Error('You have already reported this relationship');
      }

      const { data, error } = await supabase
        .from('false_relationship_reports')
        .insert({
          relationship_id: relationshipId,
          reported_by: currentUser.id,
          reason,
          evidence_urls: evidenceUrls,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Get relationship details for notification
      const { data: relationship } = await supabase
        .from('relationships')
        .select('user_id, partner_user_id, partner_name')
        .eq('id', relationshipId)
        .single();

      if (relationship) {
        // Notify admins
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .in('role', ['admin', 'super_admin', 'moderator']);

        if (admins) {
          for (const admin of admins) {
            await createNotification(
              admin.id,
              'false_relationship_report',
              'False Relationship Reported',
              `${currentUser.fullName} reported relationship with ${relationship.partner_name} as false`,
              { relationshipId, reportId: data.id }
            );
          }
        }
      }

      return data;
    } catch (error: any) {
      console.error('Report false relationship error:', error);
      throw error;
    }
  }, [currentUser, createNotification]);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Mark notification as read error:', error);
    }
  }, [notifications]);

  const getUnreadNotificationsCount = useCallback(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      setNotifications(notifications.filter(n => n.id !== notificationId));
      return true;
    } catch (error) {
      console.error('Delete notification error:', error);
      return false;
    }
  }, [notifications]);

  const clearAllNotifications = useCallback(async () => {
    if (!currentUser) return false;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Clear all notifications error:', error);
        return false;
      }

      setNotifications([]);
      return true;
    } catch (error) {
      console.error('Clear all notifications error:', error);
      return false;
    }
  }, [currentUser]);

  const logActivity = useCallback(async (
    action: string,
    resourceType?: string,
    resourceId?: string,
    details?: Record<string, any>
  ) => {
    if (!currentUser) return;
    
    try {
      await supabase
        .from('activity_logs')
        .insert({
          user_id: currentUser.id,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          details,
        });
    } catch (error) {
      console.error('Log activity error:', error);
    }
  }, [currentUser]);

  const endRelationship = useCallback(async (relationshipId: string, reason?: string) => {
    if (!currentUser) return null;
    
    try {
      const relationship = relationships.find(r => r.id === relationshipId);
      if (!relationship) return null;

      const disputePayload = {
        relationship_id: relationshipId,
        initiated_by: currentUser.id,
        dispute_type: 'end_relationship',
        description: reason || 'Request to end relationship',
        status: 'pending',
        auto_resolve_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const { data: dispute, error } = await supabase
        .from('disputes')
        .insert(disputePayload)
        .select()
        .single();

      if (error) {
        // If offline, queue for later sync
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          await queueRelationshipChange({
            type: 'end',
            relationshipId,
            data: { status: 'ended', end_date: new Date().toISOString() },
          });
          throw new Error('Relationship end request queued for sync. Will be processed when connection is restored.');
        }
        throw error;
      }

      const partnerId = relationship.userId === currentUser.id ? relationship.partnerUserId : relationship.userId;
      
      let notificationError: any = null;
      if (partnerId) {
        try {
          await createNotification(
            partnerId,
            'relationship_end_request',
            'End Relationship Request',
            `${currentUser.fullName} has requested to end your relationship. Please confirm or it will auto-resolve in 7 days.`,
            { relationshipId, disputeId: dispute.id }
          );
        } catch (err: any) {
          // Log notification error but don't fail the entire operation
          // The dispute was created successfully, which is the main action
          notificationError = err;
          console.error('Failed to create notification:', err);
          // If it's an RLS error, provide helpful message
          if (err?.code === '42501') {
            console.error('RLS policy error. Please run migrations/add-notifications-insert-policy.sql in Supabase SQL Editor.');
          }
        }
      }

      await logActivity('end_relationship_request', 'relationship', relationshipId);

      // Return dispute with notification error info if it failed
      // Ensure dispute is properly typed and includes error info
      return dispute ? { ...dispute, _notificationError: notificationError } : null;
    } catch (error: any) {
      console.error('End relationship error:', error);
      // Re-throw the error so the UI can display it
      throw error;
    }
  }, [currentUser, relationships, createNotification, logActivity]);

  const confirmEndRelationship = useCallback(async (disputeId: string) => {
    if (!currentUser) return;
    
    try {
      const { data: dispute } = await supabase
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .single();

      if (!dispute) return;

      await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolution: 'confirmed',
          resolved_at: new Date().toISOString(),
          resolved_by: currentUser.id,
        })
        .eq('id', disputeId);

      await supabase
        .from('relationships')
        .update({
          status: 'ended',
          end_date: new Date().toISOString(),
        })
        .eq('id', dispute.relationship_id);

      // Get the other partner to send notification
      const { data: relationship } = await supabase
        .from('relationships')
        .select('user_id, partner_user_id')
        .eq('id', dispute.relationship_id)
        .single();

      if (relationship) {
        const otherPartnerId = relationship.user_id === currentUser.id 
          ? relationship.partner_user_id 
          : relationship.user_id;
        
        if (otherPartnerId) {
          await createNotification(
            otherPartnerId,
            'relationship_ended',
            'Relationship Ended',
            `Your relationship has been ended`,
            { relationshipId: dispute.relationship_id }
          );
        }
      }

      await logActivity('end_relationship_confirmed', 'relationship', dispute.relationship_id);

      const updatedRelationships = relationships.filter(r => r.id !== dispute.relationship_id);
      setRelationships(updatedRelationships);
    } catch (error) {
      console.error('Confirm end relationship error:', error);
    }
  }, [currentUser, relationships, createNotification, logActivity]);

  const editPost = useCallback(async (postId: string, content: string, mediaUrls: string[], mediaType: Post['mediaType']) => {
    if (!currentUser) return null;
    
    // Check if user is restricted from editing posts
    const restriction = await checkUserRestriction(currentUser.id, 'posts');
    if (showBanModal(restriction)) {
      return null;
    }
    
    try {
      const post = posts.find(p => p.id === postId);
      if (!post || post.userId !== currentUser.id) {
        throw new Error('Unauthorized');
      }

      const { data, error } = await supabase
        .from('posts')
        .update({
          content,
          media_urls: mediaUrls,
          media_type: mediaType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;

      const updatedPosts = posts.map(p => 
        p.id === postId 
          ? { ...p, content, mediaUrls, mediaType }
          : p
      );
      
      // Maintain sort order by createdAt (newest first)
      const sortedPosts = [...updatedPosts].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setPosts(sortedPosts);
      
      await logActivity('edit_post', 'post', postId);
      return data;
    } catch (error) {
      console.error('Edit post error:', error);
      return null;
    }
  }, [currentUser, posts, logActivity]);

  const deletePost = useCallback(async (postId: string) => {
    if (!currentUser) return false;
    
    try {
      const post = posts.find(p => p.id === postId);
      if (!post || post.userId !== currentUser.id) {
        throw new Error('Unauthorized');
      }

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      const updatedPosts = posts.filter(p => p.id !== postId);
      setPosts(updatedPosts);
      
      await logActivity('delete_post', 'post', postId);
      return true;
    } catch (error) {
      console.error('Delete post error:', error);
      return false;
    }
  }, [currentUser, posts, logActivity]);

  const editComment = useCallback(async (commentId: string, content: string) => {
    if (!currentUser) return null;
    
    // Check if user is restricted from editing comments
    const restriction = await checkUserRestriction(currentUser.id, 'comments');
    if (showBanModal(restriction)) {
      return null;
    }
    
    try {
      let foundComment: Comment | null = null;
      let postId: string | null = null;

      for (const [pid, commentList] of Object.entries(comments)) {
        const comment = commentList.find(c => c.id === commentId);
        if (comment) {
          foundComment = comment;
          postId = pid;
          break;
        }
        
        // Search in replies
        for (const comment of commentList) {
          if (comment.replies) {
            const reply = comment.replies.find(r => r.id === commentId);
            if (reply) {
              foundComment = reply;
              postId = pid;
              break;
            }
          }
        }
        if (foundComment) break;
      }

      if (!foundComment || foundComment.userId !== currentUser.id || !postId) {
        throw new Error('Unauthorized');
      }

      // Prevent editing sticker comments - they can only be deleted
      if (foundComment.messageType === 'sticker') {
        throw new Error('Sticker comments cannot be edited');
      }

      const { data, error } = await supabase
        .from('comments')
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;

      const updatedComments = { ...comments };
      const postCommentsList = comments[postId];
      const isReply = foundComment.parentCommentId !== undefined;
      
      if (isReply) {
        const parentId = foundComment.parentCommentId!;
        updatedComments[postId] = postCommentsList.map(comment => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replies: (comment.replies || []).map(c => 
                c.id === commentId ? { ...c, content } : c
              ),
            };
          }
          return comment;
        });
      } else {
        updatedComments[postId] = postCommentsList.map(c => 
          c.id === commentId ? { ...c, content } : c
        );
      }
      setComments(updatedComments);
      
      await logActivity('edit_comment', 'comment', commentId);
      return data;
    } catch (error) {
      console.error('Edit comment error:', error);
      return null;
    }
  }, [currentUser, comments, logActivity]);

  const deleteComment = useCallback(async (commentId: string) => {
    if (!currentUser) return false;
    
    try {
      let foundComment: Comment | null = null;
      let postId: string | null = null;
      let parentCommentId: string | null = null;

      // Search in top-level comments and replies
      for (const [pid, commentList] of Object.entries(comments)) {
        const topLevelComment = commentList.find(c => c.id === commentId);
        if (topLevelComment) {
          foundComment = topLevelComment;
          postId = pid;
          break;
        }
        
        // Search in replies
        for (const comment of commentList) {
          if (comment.replies) {
            const reply = comment.replies.find(r => r.id === commentId);
            if (reply) {
              foundComment = reply;
              postId = pid;
              parentCommentId = comment.id;
              break;
            }
          }
        }
        if (foundComment) break;
      }

      if (!foundComment || foundComment.userId !== currentUser.id || !postId) {
        throw new Error('Unauthorized');
      }

      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      const updatedComments = { ...comments };
      if (parentCommentId) {
        // Remove from parent's replies
        updatedComments[postId] = comments[postId].map(comment => {
          if (comment.id === parentCommentId) {
            return {
              ...comment,
              replies: (comment.replies || []).filter(r => r.id !== commentId),
            };
          }
          return comment;
        });
      } else {
        // Remove top-level comment
        updatedComments[postId] = comments[postId].filter(c => c.id !== commentId);
      }
      setComments(updatedComments);

      const updatedPosts = posts.map(p => 
        p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p
      );
      setPosts(updatedPosts);
      
      await logActivity('delete_comment', 'comment', commentId);
      return true;
    } catch (error) {
      console.error('Delete comment error:', error);
      return false;
    }
  }, [currentUser, comments, posts, logActivity]);

  const toggleCommentLike = useCallback(async (commentId: string, postId: string) => {
    if (!currentUser) return false;
    
    try {
      // Check if already liked
      const postComments = comments[postId] || [];
      let comment: Comment | null = null;
      let isReply = false;
      let parentCommentId: string | null = null;

      // Search in top-level comments
      comment = postComments.find(c => c.id === commentId) || null;
      
      // If not found, search in replies
      if (!comment) {
        for (const c of postComments) {
          if (c.replies) {
            const reply = c.replies.find(r => r.id === commentId);
            if (reply) {
              comment = reply;
              isReply = true;
              parentCommentId = c.id;
              break;
            }
          }
        }
      }

      if (!comment) return false;

      const isLiked = comment.likes.includes(currentUser.id);

      if (isLiked) {
        // Unlike
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUser.id);

        const updatedLikes = comment.likes.filter(id => id !== currentUser.id);
        
        const updatedComments = { ...comments };
        if (isReply && parentCommentId) {
          updatedComments[postId] = postComments.map(c => {
            if (c.id === parentCommentId) {
              return {
                ...c,
                replies: (c.replies || []).map(r => 
                  r.id === commentId ? { ...r, likes: updatedLikes } : r
                ),
              };
            }
            return c;
          });
        } else {
          updatedComments[postId] = postComments.map(c => 
            c.id === commentId ? { ...c, likes: updatedLikes } : c
          );
        }
        setComments(updatedComments);
      } else {
        // Like
        await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: currentUser.id,
          });

        const updatedLikes = [...comment.likes, currentUser.id];
        
        const updatedComments = { ...comments };
        if (isReply && parentCommentId) {
          updatedComments[postId] = postComments.map(c => {
            if (c.id === parentCommentId) {
              return {
                ...c,
                replies: (c.replies || []).map(r => 
                  r.id === commentId ? { ...r, likes: updatedLikes } : r
                ),
              };
            }
            return c;
          });
        } else {
          updatedComments[postId] = postComments.map(c => 
            c.id === commentId ? { ...c, likes: updatedLikes } : c
          );
        }
        setComments(updatedComments);
      }

      return true;
    } catch (error) {
      console.error('Toggle comment like error:', error);
      return false;
    }
  }, [currentUser, comments]);

  const editReel = useCallback(async (reelId: string, caption: string) => {
    if (!currentUser) return null;
    
    // Check if user is restricted from editing reels
    const restriction = await checkUserRestriction(currentUser.id, 'reels');
    if (showBanModal(restriction)) {
      return null;
    }
    
    try {
      const reel = reels.find(r => r.id === reelId);
      if (!reel || reel.userId !== currentUser.id) {
        throw new Error('Unauthorized');
      }

      const { data, error } = await supabase
        .from('reels')
        .update({
          caption,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reelId)
        .select()
        .single();

      if (error) throw error;

      const updatedReels = reels.map(r => 
        r.id === reelId ? { ...r, caption } : r
      );
      setReels(updatedReels);
      
      await logActivity('edit_reel', 'reel', reelId);
      return data;
    } catch (error) {
      console.error('Edit reel error:', error);
      return null;
    }
  }, [currentUser, reels, logActivity]);

  const deleteReel = useCallback(async (reelId: string) => {
    if (!currentUser) return false;
    
    try {
      const reel = reels.find(r => r.id === reelId);
      if (!reel || reel.userId !== currentUser.id) {
        throw new Error('Unauthorized');
      }

      const { error } = await supabase
        .from('reels')
        .delete()
        .eq('id', reelId);

      if (error) throw error;

      const updatedReels = reels.filter(r => r.id !== reelId);
      setReels(updatedReels);
      
      await logActivity('delete_reel', 'reel', reelId);
      return true;
    } catch (error) {
      console.error('Delete reel error:', error);
      return false;
    }
  }, [currentUser, reels, logActivity]);

  const sharePost = useCallback(async (postId: string) => {
    if (!currentUser) return;
    
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      // Deep link (opens the app if installed). No domain ownership required.
      const deepLink = `committed://post/${postId}`;
      // Fallback download page (opens in browser if app not installed).
      const downloadUrl = `https://dreambig.org.za/committed`;
      const preview = post.content ? `${post.content.substring(0, 100)}...` : 'View this post in Committed';
      const shareText = `${preview}\n\nOpen in app: ${deepLink}\nDownload Committed: ${downloadUrl}`;
      
      // Use React Native Share API
      const Share = require('react-native').Share;
      await Share.share({
        message: shareText,
        url: deepLink,
        title: `Post by ${post.userName}`,
      });
      
      await logActivity('share_post', 'post', postId);
    } catch (error) {
      console.error('Share post error:', error);
    }
  }, [currentUser, posts, logActivity]);

  const shareReel = useCallback(async (reelId: string) => {
    if (!currentUser) return;
    
    try {
      const reel = reels.find(r => r.id === reelId);
      if (!reel) return;

      // Deep link (opens the app if installed). No domain ownership required.
      const deepLink = `committed://reel/${reelId}`;
      // Fallback download page (opens in browser if app not installed).
      const downloadUrl = `https://dreambig.org.za/committed`;
      const preview = reel.caption ? `${reel.caption.substring(0, 100)}...` : 'View this reel in Committed';
      const shareText = `${preview}\n\nOpen in app: ${deepLink}\nDownload Committed: ${downloadUrl}`;
      
      // Use React Native Share API
      const Share = require('react-native').Share;
      await Share.share({
        message: shareText,
        url: deepLink,
        title: `Reel by ${reel.userName}`,
      });
      
      await logActivity('share_reel', 'reel', reelId);
    } catch (error) {
      console.error('Share reel error:', error);
    }
  }, [currentUser, reels, logActivity]);

  const adminDeletePost = useCallback(async (postId: string) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'moderator')) {
      return false;
    }
    
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      const updatedPosts = posts.filter(p => p.id !== postId);
      setPosts(updatedPosts);
      
      await logActivity('admin_delete_post', 'post', postId, { adminId: currentUser.id });
      return true;
    } catch (error) {
      console.error('Admin delete post error:', error);
      return false;
    }
  }, [currentUser, posts, logActivity]);

  const adminRejectPost = useCallback(async (postId: string, reason?: string) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'moderator')) {
      return false;
    }
    
    try {
      const { error } = await supabase
        .from('posts')
        .update({
          moderation_status: 'rejected',
          moderation_reason: reason,
          moderated_at: new Date().toISOString(),
          moderated_by: currentUser.id,
        })
        .eq('id', postId);

      if (error) throw error;

      const updatedPosts = posts.filter(p => p.id !== postId);
      setPosts(updatedPosts);
      
      await logActivity('admin_reject_post', 'post', postId, { adminId: currentUser.id, reason });
      return true;
    } catch (error) {
      console.error('Admin reject post error:', error);
      return false;
    }
  }, [currentUser, posts, logActivity]);

  const adminDeleteReel = useCallback(async (reelId: string) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'moderator')) {
      return false;
    }
    
    try {
      const { error } = await supabase
        .from('reels')
        .delete()
        .eq('id', reelId);

      if (error) throw error;

      const updatedReels = reels.filter(r => r.id !== reelId);
      setReels(updatedReels);
      
      await logActivity('admin_delete_reel', 'reel', reelId, { adminId: currentUser.id });
      return true;
    } catch (error) {
      console.error('Admin delete reel error:', error);
      return false;
    }
  }, [currentUser, reels, logActivity]);

  const adminRejectReel = useCallback(async (reelId: string, reason?: string) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'moderator')) {
      return false;
    }
    
    try {
      const { error } = await supabase
        .from('reels')
        .update({
          moderation_status: 'rejected',
          moderation_reason: reason,
          moderated_at: new Date().toISOString(),
          moderated_by: currentUser.id,
        })
        .eq('id', reelId);

      if (error) throw error;

      const updatedReels = reels.filter(r => r.id !== reelId);
      setReels(updatedReels);
      
      await logActivity('admin_reject_reel', 'reel', reelId, { adminId: currentUser.id, reason });
      return true;
    } catch (error) {
      console.error('Admin reject reel error:', error);
      return false;
    }
  }, [currentUser, reels, logActivity]);

  const getChatBackground = useCallback(async (conversationId: string) => {
    if (!currentUser) {
      console.log('getChatBackground: No current user');
      return null;
    }
    
    try {
      console.log('Fetching chat background from database:', { userId: currentUser.id, conversationId });
      const { data, error } = await supabase
        .from('chat_backgrounds')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('conversation_id', conversationId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no row exists

      if (error) {
        console.error('Get chat background database error:', error);
        throw error;
      }
      
      console.log('Chat background query result:', data);
      return data;
    } catch (error) {
      console.error('Get chat background error:', error);
      return null;
    }
  }, [currentUser]);

  const setChatBackground = useCallback(async (
    conversationId: string,
    backgroundType: 'color' | 'image' | 'gradient',
    backgroundValue: string,
    opacity?: number,
    overlayColor?: string
  ) => {
    if (!currentUser) {
      console.log('setChatBackground: No current user');
      return false;
    }
    
    try {
      const updateData: any = {
        user_id: currentUser.id,
        conversation_id: conversationId,
        background_type: backgroundType,
        background_value: backgroundValue,
        updated_at: new Date().toISOString(),
      };

      if (opacity !== undefined) {
        updateData.opacity = opacity;
      }

      if (overlayColor !== undefined) {
        updateData.overlay_color = overlayColor;
      }

      console.log('Saving chat background to database:', updateData);
      
      const { data, error } = await supabase
        .from('chat_backgrounds')
        .upsert(updateData, {
          onConflict: 'user_id,conversation_id'
        })
        .select();

      if (error) {
        console.error('Set chat background database error:', error);
        throw error;
      }
      
      console.log('Chat background saved successfully:', data);
      return true;
    } catch (error) {
      console.error('Set chat background error:', error);
      return false;
    }
  }, [currentUser]);

  const getMessageWarnings = useCallback(async (conversationId: string) => {
    if (!currentUser) return [];
    
    try {
      const { data, error } = await supabase
        .from('message_warnings')
        .select('*')
        .eq('conversation_id', conversationId)
        .or(`user_id.eq.${currentUser.id},partner_user_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map((w: any) => ({
        id: w.id,
        messageId: w.message_id,
        conversationId: w.conversation_id,
        userId: w.user_id,
        partnerUserId: w.partner_user_id,
        warningType: w.warning_type,
        triggerWords: w.trigger_words || [],
        messageContent: w.message_content,
        severity: w.severity,
        acknowledged: w.acknowledged,
        acknowledgedAt: w.acknowledged_at,
        createdAt: w.created_at,
      }));
    } catch (error) {
      console.error('Get message warnings error:', error);
      return [];
    }
  }, [currentUser]);

  const acknowledgeWarning = useCallback(async (warningId: string) => {
    if (!currentUser) return false;
    
    try {
      const { error } = await supabase
        .from('message_warnings')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', warningId)
        .or(`user_id.eq.${currentUser.id},partner_user_id.eq.${currentUser.id}`);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Acknowledge warning error:', error);
      return false;
    }
  }, [currentUser]);

  const getInfidelityReports = useCallback(async () => {
    if (!currentUser) return [];
    
    try {
      const { data, error } = await supabase
        .from('infidelity_reports')
        .select('*')
        .or(`user_id.eq.${currentUser.id},partner_user_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map((r: any) => ({
        id: r.id,
        relationshipId: r.relationship_id,
        userId: r.user_id,
        partnerUserId: r.partner_user_id,
        reportType: r.report_type,
        warningCount: r.warning_count,
        firstWarningAt: r.first_warning_at,
        lastWarningAt: r.last_warning_at,
        summary: r.summary,
        evidence: r.evidence,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
      }));
    } catch (error) {
      console.error('Get infidelity reports error:', error);
      return [];
    }
  }, [currentUser]);

  // Admin functions for managing trigger words
  const getTriggerWords = useCallback(async () => {
    if (!currentUser || !['admin', 'super_admin', 'moderator'].includes(currentUser.role)) {
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('trigger_words')
        .select('*')
        .order('severity', { ascending: true })
        .order('word_phrase', { ascending: true });

      if (error) throw error;
      
      return (data || []).map((tw: any) => ({
        id: tw.id,
        wordPhrase: tw.word_phrase,
        severity: tw.severity,
        category: tw.category,
        active: tw.active,
        createdBy: tw.created_by,
        createdAt: tw.created_at,
        updatedAt: tw.updated_at,
      }));
    } catch (error) {
      console.error('Get trigger words error:', error);
      return [];
    }
  }, [currentUser]);

  const addTriggerWord = useCallback(async (
    wordPhrase: string,
    severity: 'low' | 'medium' | 'high',
    category: 'romantic' | 'intimate' | 'suspicious' | 'meetup' | 'secret' | 'general' = 'general'
  ) => {
    if (!currentUser || !['admin', 'super_admin', 'moderator'].includes(currentUser.role)) {
      return false;
    }
    
    try {
      const { error } = await supabase
        .from('trigger_words')
        .insert({
          word_phrase: wordPhrase.toLowerCase().trim(),
          severity,
          category,
          active: true,
          created_by: currentUser.id,
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Add trigger word error:', error);
      return false;
    }
  }, [currentUser]);

  const updateTriggerWord = useCallback(async (
    id: string,
    updates: {
      wordPhrase?: string;
      severity?: 'low' | 'medium' | 'high';
      category?: 'romantic' | 'intimate' | 'suspicious' | 'meetup' | 'secret' | 'general';
      active?: boolean;
    }
  ) => {
    if (!currentUser || !['admin', 'super_admin', 'moderator'].includes(currentUser.role)) {
      return false;
    }
    
    try {
      const updateData: any = {};
      if (updates.wordPhrase !== undefined) {
        updateData.word_phrase = updates.wordPhrase.toLowerCase().trim();
      }
      if (updates.severity !== undefined) {
        updateData.severity = updates.severity;
      }
      if (updates.category !== undefined) {
        updateData.category = updates.category;
      }
      if (updates.active !== undefined) {
        updateData.active = updates.active;
      }

      const { error } = await supabase
        .from('trigger_words')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Update trigger word error:', error);
      return false;
    }
  }, [currentUser]);

  const deleteTriggerWord = useCallback(async (id: string) => {
    if (!currentUser || !['admin', 'super_admin', 'moderator'].includes(currentUser.role)) {
      return false;
    }
    
    try {
      const { error } = await supabase
        .from('trigger_words')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Delete trigger word error:', error);
      return false;
    }
  }, [currentUser]);

  const getWarningTemplates = useCallback(async () => {
    if (!currentUser || !['admin', 'super_admin', 'moderator'].includes(currentUser.role)) return [];
    try {
      const { data, error } = await supabase
        .from('warning_templates')
        .select('*')
        .order('severity', { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        severity: t.severity,
        titleTemplate: t.title_template,
        messageTemplate: t.message_template,
        inChatWarningTemplate: t.in_chat_warning_template,
        description: t.description,
        active: t.active,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
    } catch (error) {
      console.error('Get warning templates error:', error);
      return [];
    }
  }, [currentUser]);

  const updateWarningTemplate = useCallback(async (
    id: string,
    updates: {
      titleTemplate?: string;
      messageTemplate?: string;
      inChatWarningTemplate?: string;
      description?: string;
      active?: boolean;
    }
  ) => {
    if (!currentUser || !['admin', 'super_admin', 'moderator'].includes(currentUser.role)) {
      return false;
    }
    try {
      const updateData: any = {};
      if (updates.titleTemplate !== undefined) updateData.title_template = updates.titleTemplate;
      if (updates.messageTemplate !== undefined) updateData.message_template = updates.messageTemplate;
      if (updates.inChatWarningTemplate !== undefined) updateData.in_chat_warning_template = updates.inChatWarningTemplate;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.active !== undefined) updateData.active = updates.active;

      const { error } = await supabase
        .from('warning_templates')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Update warning template error:', error);
      return false;
    }
  }, [currentUser]);

  // ============================================
  // USER STATUS FUNCTIONS
  // ============================================

  const loadUserStatus = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_status')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Load user status error:', error);
        return null;
      }

      if (data) {
        const status: UserStatus = {
          userId: data.user_id,
          statusType: data.status_type,
          customStatusText: data.custom_status_text,
          lastActiveAt: data.last_active_at,
          statusVisibility: data.status_visibility,
          lastSeenVisibility: data.last_seen_visibility,
          updatedAt: data.updated_at,
        };
        setUserStatuses(prev => ({ ...prev, [userId]: status }));
        return status;
      }

      // Create default status if doesn't exist
      const defaultStatus: UserStatus = {
        userId,
        statusType: 'offline',
        lastActiveAt: new Date().toISOString(),
        statusVisibility: 'contacts',
        lastSeenVisibility: 'contacts',
        updatedAt: new Date().toISOString(),
      };
      await createUserStatus(defaultStatus);
      setUserStatuses(prev => ({ ...prev, [userId]: defaultStatus }));
      return defaultStatus;
    } catch (error) {
      console.error('Load user status error:', error);
      return null;
    }
  }, []);

  const createUserStatus = useCallback(async (status: UserStatus) => {
    try {
      // Use upsert instead of insert to handle cases where status might already exist
      // This also works better with RLS policies
      const { error } = await supabase
        .from('user_status')
        .upsert({
          user_id: status.userId,
          status_type: status.statusType,
          custom_status_text: status.customStatusText,
          last_active_at: status.lastActiveAt,
          status_visibility: status.statusVisibility,
          last_seen_visibility: status.lastSeenVisibility,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        // If it's an RLS error, log it but don't throw - allow the app to continue
        if (error.code === '42501') {
          console.warn('RLS policy error when creating user status (may need to run migration):', error.message);
          return false;
        }
        throw error;
      }
      return true;
    } catch (error: any) {
      console.error('Create user status error:', error);
      // Don't throw - allow app to continue even if status creation fails
      return false;
    }
  }, []);

  const updateUserStatus = useCallback(async (
    statusType: UserStatusType,
    customStatusText?: string
  ) => {
    if (!currentUser) return false;

    try {
      const updateData: any = {
        status_type: statusType,
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (customStatusText !== undefined) {
        updateData.custom_status_text = customStatusText || null;
      }

      const { error } = await supabase
        .from('user_status')
        .update(updateData)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      // Update local state
      setUserStatuses(prev => {
        const existing = prev[currentUser.id];
        return {
          ...prev,
          [currentUser.id]: {
            ...existing,
            statusType,
            customStatusText: customStatusText || existing?.customStatusText,
            lastActiveAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as UserStatus,
        };
      });

      return true;
    } catch (error) {
      console.error('Update user status error:', error);
      return false;
    }
  }, [currentUser]);

  const updateStatusPrivacy = useCallback(async (
    statusVisibility: StatusVisibility,
    lastSeenVisibility: StatusVisibility
  ) => {
    if (!currentUser) return false;

    try {
      const { error } = await supabase
        .from('user_status')
        .update({
          status_visibility: statusVisibility,
          last_seen_visibility: lastSeenVisibility,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', currentUser.id);

      if (error) throw error;

      // Update local state
      setUserStatuses(prev => {
        const existing = prev[currentUser.id];
        return {
          ...prev,
          [currentUser.id]: {
            ...existing,
            statusVisibility,
            lastSeenVisibility,
            updatedAt: new Date().toISOString(),
          } as UserStatus,
        };
      });

      return true;
    } catch (error) {
      console.error('Update status privacy error:', error);
      return false;
    }
  }, [currentUser]);

  const getUserStatus = useCallback(async (userId: string): Promise<UserStatus | null> => {
    // Check if this is the AI user - always return online status
    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userData?.email === 'ai@committed.app') {
      // AI user - always return online status
      const aiStatus: UserStatus = {
        userId,
        statusType: 'online',
        lastActiveAt: new Date().toISOString(),
        statusVisibility: 'everyone',
        lastSeenVisibility: 'everyone',
        updatedAt: new Date().toISOString(),
      };
      setUserStatuses(prev => ({ ...prev, [userId]: aiStatus }));
      return aiStatus;
    }

    // Always load fresh from database to get accurate status and last_active_at
    const status = await loadUserStatus(userId);
    
    if (!status) return null;

    // Trust the database status - it's updated in real-time by app state handlers
    // Only calculate if status is 'online' but last_active_at is very old (likely stale)
    const now = new Date();
    const lastActive = new Date(status.lastActiveAt);
    const diffMs = now.getTime() - lastActive.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    let actualStatusType: UserStatusType = status.statusType;
    
    // If status is manually set to 'busy', always preserve it
    if (status.statusType === 'busy') {
      actualStatusType = 'busy';
    }
    // If status is 'online' but last_active_at is more than 5 minutes old, likely stale
    // Set to 'away' or 'offline' based on time
    else if (status.statusType === 'online' && diffMins > 5) {
      if (diffMins < 15) {
        actualStatusType = 'away';
      } else {
        actualStatusType = 'offline';
      }
    }
    // If status is 'away' but last_active_at is more than 20 minutes old, set to offline
    else if (status.statusType === 'away' && diffMins > 20) {
      actualStatusType = 'offline';
    }
    // Otherwise, trust the database status
    // The database status is updated in real-time by app state handlers

    // Return status with calculated type (only if we changed it)
    const finalStatus: UserStatus = {
      ...status,
      statusType: actualStatusType,
    };

    // Update cache
    setUserStatuses(prev => ({ ...prev, [userId]: finalStatus }));
    
    return finalStatus;
  }, [loadUserStatus]);

  const startStatusTracking = useCallback(() => {
    if (!currentUser) return;

    // Clear existing interval
    if (statusUpdateIntervalRef.current) {
      clearInterval(statusUpdateIntervalRef.current);
      statusUpdateIntervalRef.current = null;
    }

    // Update last_active_at every 30 seconds while app is active
    // This keeps the user marked as "online" while they're using the app
    const interval = setInterval(async () => {
      if (currentUser) {
        const now = new Date();
        
        // Update last_active_at to show user is active
        // Only update status to 'online' if it's not manually set to 'busy'
        const { data: currentStatusData, error: fetchError } = await supabase
          .from('user_status')
          .select('status_type')
          .eq('user_id', currentUser.id)
          .single();

        if (currentStatusData && !fetchError) {
          // Only update to 'online' if not 'busy'
          const newStatusType = currentStatusData.status_type === 'busy' 
            ? 'busy' 
            : 'online';

          const updateData: any = {
            last_active_at: now.toISOString(),
            updated_at: now.toISOString(),
          };

          // Only update status if it changed (and not busy)
          if (newStatusType !== currentStatusData.status_type) {
            updateData.status_type = newStatusType;
          }

          const { error } = await supabase
            .from('user_status')
            .update(updateData)
            .eq('user_id', currentUser.id);

          if (!error) {
            setUserStatuses(prev => {
              const existing = prev[currentUser.id];
              if (existing) {
                return {
                  ...prev,
                  [currentUser.id]: {
                    ...existing,
                    statusType: newStatusType,
                    lastActiveAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                  },
                };
              }
              return prev;
            });
          }
        } else if (fetchError && fetchError.code === 'PGRST116') {
          // No status record exists, create one
          const { error: insertError } = await supabase
            .from('user_status')
            .insert({
              user_id: currentUser.id,
              status_type: 'online',
              last_active_at: now.toISOString(),
              status_visibility: 'everyone',
              last_seen_visibility: 'everyone',
            });

          if (!insertError) {
            const newStatus: UserStatus = {
              userId: currentUser.id,
              statusType: 'online',
              lastActiveAt: now.toISOString(),
              statusVisibility: 'everyone',
              lastSeenVisibility: 'everyone',
              updatedAt: now.toISOString(),
            };
            setUserStatuses(prev => ({ ...prev, [currentUser.id]: newStatus }));
          }
        }
      }
    }, 30 * 1000); // Every 30 seconds

    statusUpdateIntervalRef.current = interval;
  }, [currentUser]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    if (!currentUser) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const now = new Date().toISOString();
      
      if (nextAppState === 'active') {
        // App came to foreground - set status to online immediately
        console.log('App became active - setting status to online');
        
        // Stop any existing interval first
        if (statusUpdateIntervalRef.current) {
          clearInterval(statusUpdateIntervalRef.current);
          statusUpdateIntervalRef.current = null;
        }

        // Update status to online and last_active_at to NOW
        const { error } = await supabase
          .from('user_status')
          .update({
            status_type: 'online',
            last_active_at: now,
            updated_at: now,
          })
          .eq('user_id', currentUser.id);

        if (!error) {
          setUserStatuses(prev => {
            const existing = prev[currentUser.id];
            return {
              ...prev,
              [currentUser.id]: {
                ...existing,
                statusType: 'online',
                lastActiveAt: now,
                updatedAt: now,
              } as UserStatus,
            };
          });
        }

        // Start tracking
        startStatusTracking();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background - update last_active_at to NOW and set to away/offline
        console.log('App went to background - updating last_active_at and setting status');
        
        // Stop tracking interval
        if (statusUpdateIntervalRef.current) {
          clearInterval(statusUpdateIntervalRef.current);
          statusUpdateIntervalRef.current = null;
        }

        // Update last_active_at to NOW (actual time they left)
        // Set status to 'away' (will become offline after timeout)
        const { error } = await supabase
          .from('user_status')
          .update({
            status_type: 'away',
            last_active_at: now, // Update to actual time they left
            updated_at: now,
          })
          .eq('user_id', currentUser.id);

        if (!error) {
          setUserStatuses(prev => {
            const existing = prev[currentUser.id];
            return {
              ...prev,
              [currentUser.id]: {
                ...existing,
                statusType: 'away',
                lastActiveAt: now, // Actual time they left
                updatedAt: now,
              } as UserStatus,
            };
          });
        }
      }
    };

    // Get initial app state
    const currentAppState = AppState.currentState;
    if (currentAppState === 'active' && currentUser) {
      // App is already active, set to online
      handleAppStateChange('active');
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [currentUser, startStatusTracking]);

  // Cleanup interval on unmount or logout
  useEffect(() => {
    return () => {
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
        statusUpdateIntervalRef.current = null;
      }
    };
  }, []);

  // Subscribe to real-time status updates for all users we interact with
  useEffect(() => {
    if (!currentUser) return;

    // Subscribe to status updates for users in conversations
    const conversationUserIds = new Set<string>();
    conversations.forEach(conv => {
      conv.participants.forEach(id => {
        if (id !== currentUser.id) {
          conversationUserIds.add(id);
        }
      });
    });

    // Subscribe to status updates for followed users
    follows.forEach(follow => {
      if (follow.followingId !== currentUser.id) {
        conversationUserIds.add(follow.followingId);
      }
    });

    if (conversationUserIds.size === 0) return;

    const channels: RealtimeChannel[] = [];
    
    // Create a channel for status updates
    const statusChannel = supabase
      .channel('user_status_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_status',
        },
        async (payload) => {
          const statusData = payload.new as any;
          if (statusData && conversationUserIds.has(statusData.user_id)) {
            // Use getUserStatus to get properly calculated status
            const calculatedStatus = await getUserStatus(statusData.user_id);
            if (calculatedStatus) {
              setUserStatuses(prev => ({ ...prev, [statusData.user_id]: calculatedStatus }));
            }
          }
        }
      )
      .subscribe();

    channels.push(statusChannel);
    setStatusRealtimeChannels(channels);

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [currentUser, conversations, follows]);

  // Set status to offline on logout
  // Note: Status is now set in the logout function itself before clearing state
  // This useEffect is kept for edge cases but should rarely trigger
  useEffect(() => {
    // Only run if we have no session but still have a currentUser (edge case)
    // The main logout flow handles status update in the logout function
    if (!session && currentUser) {
      const userId = currentUser.id;
      
      // Update status to offline
      const setOfflineOnLogout = async () => {
        const now = new Date().toISOString();
        console.log('User logged out - setting status to offline (edge case)');
        
        try {
          await supabase
            .from('user_status')
            .update({
              status_type: 'offline',
              last_active_at: now,
              updated_at: now,
            })
            .eq('user_id', userId);
          
          // Update local state
          setUserStatuses(prev => {
            const existing = prev[userId];
            if (existing) {
              return {
                ...prev,
                [userId]: {
                  ...existing,
                  statusType: 'offline',
                  lastActiveAt: now,
                  updatedAt: now,
                },
              };
            }
            return prev;
          });
        } catch (error) {
          console.error('Error setting offline status on logout:', error);
        }
      };
      
      setOfflineOnLogout();
      
      // Stop tracking
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
        statusUpdateIntervalRef.current = null;
      }
      // Clean up realtime channels
      statusRealtimeChannels.forEach(ch => supabase.removeChannel(ch));
      setStatusRealtimeChannels([]);
    }
  }, [session, currentUser, statusRealtimeChannels]);

  return {
    currentUser,
    isLoading,
    login,
    signup,
    logout,
    deleteAccount,
    resetPassword,
    updateUserProfile,
    refreshRelationships,
    createRelationship,
    acceptRelationshipRequest,
    rejectRelationshipRequest,
    getCurrentUserRelationship,
    getUserRelationship,
    searchUsers,
    searchByFace,
    getPendingRequests,
    posts,
    reels,
    conversations,
    createPost,
    createReel,
    toggleLike,
    toggleReelLike,
    addComment,
    sendMessage,
    getConversation,
    getMessages,
    createOrGetConversation,
    getComments,
    advertisements,
    createAdvertisement,
    updateAdvertisement,
    deleteAdvertisement,
    recordAdImpression,
    recordAdClick,
    getActiveAds,
    getPersonalizedFeed,
    getSmartAds,
    notifications,
    cheatingAlerts,
    follows,
    disputes,
    certificates,
    anniversaries,
    followUser,
    unfollowUser,
    isFollowing,
    blockUser,
    unblockUser,
    isBlocked,
    addReelComment,
    getReelComments,
    editReelComment,
    deleteReelComment,
    toggleReelCommentLike,
    reportContent,
    reportFalseRelationship,
    createNotification,
    markNotificationAsRead,
    getUnreadNotificationsCount,
    deleteNotification,
    clearAllNotifications,
    deleteConversation,
    deleteMessage,
    getChatBackground,
    setChatBackground,
    getMessageWarnings,
    acknowledgeWarning,
    banModalVisible,
    banModalData,
    setBanModalVisible,
    getInfidelityReports,
    logActivity,
    endRelationship,
    confirmEndRelationship,
    sendPhoneVerificationCode,
    verifyPhoneCode,
    sendEmailVerificationCode,
    verifyEmailCode,
    uploadIDVerification,
    uploadCoupleSelfie,
    createCertificate,
    getCertificates,
    createAnniversary,
    getAnniversaries,
    createMilestone,
    getMilestones,
    getAchievements,
    getCoupleLevel,
    detectDuplicateRelationships,
    savePushToken,
    editPost,
    deletePost,
    editComment,
    deleteComment,
    toggleCommentLike,
    editReel,
    deleteReel,
    sharePost,
    shareReel,
    adminDeletePost,
    adminRejectPost,
    adminDeleteReel,
    adminRejectReel,
    getTriggerWords,
    addTriggerWord,
    updateTriggerWord,
    deleteTriggerWord,
    getWarningTemplates,
    updateWarningTemplate,
    legalAcceptanceStatus,
    setLegalAcceptanceStatus,
    // Status functions
    userStatuses,
    getUserStatus,
    updateUserStatus,
    updateStatusPrivacy,
    loadUserStatus,
    // Onboarding
    hasCompletedOnboarding,
    checkOnboardingStatus: useCallback(async (userId: string): Promise<boolean> => {
      try {
        const { data, error } = await supabase
          .from('user_onboarding_data')
          .select('has_completed_onboarding')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (error) throw error;
        const completed = data?.has_completed_onboarding ?? false;
        setHasCompletedOnboarding(completed);
        return completed;
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
        return false;
      }
    }, []),
  };
});

// Helper functions for verification
const sendPhoneVerificationCode = async (phoneNumber: string) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`Phone verification code for ${phoneNumber}: ${code}`);
    return { success: true, code };
  } catch (error) {
    console.error('Send phone code error:', error);
    return { success: false, error };
  }
};

const verifyPhoneCode = async (code: string) => {
  try {
    return { success: true };
  } catch (error) {
    console.error('Verify phone code error:', error);
    return { success: false, error };
  }
};

const sendEmailVerificationCode = async (email: string) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`Email verification code for ${email}: ${code}`);
    return { success: true, code };
  } catch (error) {
    console.error('Send email code error:', error);
    return { success: false, error };
  }
};

const verifyEmailCode = async (code: string) => {
  try {
    return { success: true };
  } catch (error) {
    console.error('Verify email code error:', error);
    return { success: false, error };
  }
};

const uploadIDVerification = async (documentType: string, documentUrl: string, selfieUrl?: string) => {
  try {
    return { success: true };
  } catch (error) {
    console.error('Upload ID verification error:', error);
    return { success: false, error };
  }
};

const uploadCoupleSelfie = async (relationshipId: string, selfieUrl: string) => {
  try {
    return { success: true };
  } catch (error) {
    console.error('Upload couple selfie error:', error);
    return { success: false, error };
  }
};

const createCertificate = async (relationshipId: string) => {
  try {
    return { success: true };
  } catch (error) {
    console.error('Create certificate error:', error);
    return { success: false, error };
  }
};

const getCertificates = (relationshipId: string) => {
  return [];
};

const createAnniversary = async (relationshipId: string, type: string, date: string, title: string) => {
  try {
    return { success: true };
  } catch (error) {
    console.error('Create anniversary error:', error);
    return { success: false, error };
  }
};

const getAnniversaries = (relationshipId: string) => {
  return [];
};

const createMilestone = async (relationshipId: string, type: string, title: string, description: string, date: string) => {
  try {
    return { success: true };
  } catch (error) {
    console.error('Create milestone error:', error);
    return { success: false, error };
  }
};

const getMilestones = (relationshipId: string) => {
  return [];
};

const getAchievements = (relationshipId: string) => {
  return [];
};

const getCoupleLevel = (relationshipId: string) => {
  return null;
};

const detectDuplicateRelationships = async (userId: string) => {
  try {
    return { success: true, duplicates: [] };
  } catch (error) {
    console.error('Detect duplicates error:', error);
    return { success: false, error };
  }
};

const savePushToken = async (token: string, deviceType: string) => {
  try {
    return { success: true };
  } catch (error) {
    console.error('Save push token error:', error);
    return { success: false, error };
  }
};
