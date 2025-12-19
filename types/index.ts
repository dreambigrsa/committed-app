export type RelationshipType = 'married' | 'engaged' | 'serious' | 'dating';

export type RelationshipStatus = 'pending' | 'verified' | 'ended';

export type UserStatusType = 'online' | 'away' | 'busy' | 'offline';
export type StatusVisibility = 'everyone' | 'contacts' | 'nobody';

export interface UserStatus {
  userId: string;
  statusType: UserStatusType;
  customStatusText?: string;
  lastActiveAt: string;
  statusVisibility: StatusVisibility;
  lastSeenVisibility: StatusVisibility;
  updatedAt: string;
}

export interface User {
  id: string;
  fullName: string;
  username?: string;
  email: string;
  phoneNumber: string;
  profilePicture?: string;
  role: UserRole;
  verifications: {
    phone: boolean;
    email: boolean;
    id: boolean;
  };
  status?: UserStatus; // Optional status info
  createdAt: string;
}

export interface Relationship {
  id: string;
  userId: string;
  partnerName: string;
  partnerPhone: string;
  partnerUserId?: string;
  type: RelationshipType;
  status: RelationshipStatus;
  startDate: string;
  verifiedDate?: string;
  endDate?: string;
  privacyLevel: 'public' | 'private' | 'verified-only';
  partnerFacePhoto?: string;
  partnerDateOfBirthMonth?: number;
  partnerDateOfBirthYear?: number;
  partnerCity?: string;
}

export interface RelationshipRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  relationshipType: RelationshipType;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface SearchResult {
  userId: string;
  fullName: string;
  profilePicture?: string;
  relationship?: {
    partnerName: string;
    type: RelationshipType;
    status: RelationshipStatus;
    startDate: string;
    verified: boolean;
  };
}

export type NotificationType = 'relationship_request' | 'cheating_alert' | 'relationship_verified' | 'relationship_ended' | 'relationship_end_request' | 'post_like' | 'post_comment' | 'message' | 'follow' | 'anniversary_reminder' | 'verification_attempt' | 'status_reaction';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video' | 'mixed';
  likes: string[];
  commentCount: number;
  createdAt: string;
}

export interface Reel {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  caption: string;
  likes: string[];
  commentCount: number;
  viewCount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  stickerId?: string;
  stickerImageUrl?: string; // Sticker image URL for rendering
  messageType?: 'text' | 'sticker';
  likes: string[];
  createdAt: string;
  parentCommentId?: string;
  replies?: Comment[];
}

export type MessageType = 'text' | 'image' | 'document' | 'sticker';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  mediaUrl?: string;
  documentUrl?: string;
  documentName?: string;
  stickerId?: string;
  messageType: MessageType;
  deletedForSender?: boolean;
  deletedForReceiver?: boolean;
  read: boolean;
  createdAt: string;
  statusId?: string;
  statusPreviewUrl?: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantNames: string[];
  participantAvatars: (string | undefined)[];
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export type UserRole = 'user' | 'moderator' | 'admin' | 'super_admin';

export interface Advertisement {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl?: string;
  type: 'banner' | 'card' | 'video';
  placement: 'feed' | 'reels' | 'messages' | 'all';
  active: boolean;
  impressions: number;
  clicks: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheatingAlert {
  id: string;
  userId: string;
  partnerUserId: string;
  alertType: 'duplicate_registration' | 'suspicious_activity';
  description: string;
  read: boolean;
  createdAt: string;
}

export interface MessageWarning {
  id: string;
  messageId: string;
  conversationId: string;
  userId: string;
  partnerUserId: string;
  warningType: 'trigger_word' | 'suspicious_pattern' | 'frequent_contact';
  triggerWords: string[];
  messageContent: string;
  severity: 'low' | 'medium' | 'high';
  acknowledged: boolean;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface InfidelityReport {
  id: string;
  relationshipId: string;
  userId: string;
  partnerUserId: string;
  reportType: 'ignored_warnings' | 'pattern_detected' | 'multiple_warnings';
  warningCount: number;
  firstWarningAt?: string;
  lastWarningAt?: string;
  summary: string;
  evidence: any;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface WarningTemplate {
  id: string;
  severity: 'low' | 'medium' | 'high';
  titleTemplate: string;
  messageTemplate: string;
  inChatWarningTemplate: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TriggerWord {
  id: string;
  wordPhrase: string;
  severity: 'low' | 'medium' | 'high';
  category: 'romantic' | 'intimate' | 'suspicious' | 'meetup' | 'secret' | 'general';
  active: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  relationshipId: string;
  initiatedBy: string;
  disputeType: 'end_relationship' | 'challenge_verification' | 'privacy_change';
  description?: string;
  status: 'pending' | 'resolved' | 'auto_resolved';
  resolution?: string;
  autoResolveAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

export interface CoupleCertificate {
  id: string;
  relationshipId: string;
  certificateUrl: string;
  verificationSelfieUrl?: string;
  issuedAt: string;
  createdAt: string;
}

export interface Anniversary {
  id: string;
  relationshipId: string;
  anniversaryDate: string;
  reminderSent: boolean;
  createdAt: string;
}

export interface ReportedContent {
  id: string;
  reporterId: string;
  reportedUserId?: string;
  contentType: 'post' | 'reel' | 'comment' | 'message' | 'profile';
  contentId?: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: string;
  actionTaken?: string;
  createdAt: string;
}

export interface ReelComment {
  id: string;
  reelId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  stickerId?: string;
  stickerImageUrl?: string; // Sticker image URL for rendering
  messageType?: 'text' | 'sticker';
  likes: string[];
  createdAt: string;
  parentCommentId?: string;
  replies?: ReelComment[];
}

export interface BanAppeal {
  id: string;
  userId: string;
  restrictionId?: string;
  appealType: 'full_ban' | 'feature_restriction';
  restrictedFeature?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'under_review';
  reviewedBy?: string;
  reviewedAt?: string;
  adminResponse?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRestriction {
  id: string;
  userId: string;
  restrictedFeature: 'posts' | 'comments' | 'messages' | 'reels' | 'reel_comments' | 'all';
  reason?: string;
  restrictedBy?: string;
  restrictedAt: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LegalDocument {
  id: string;
  title: string;
  slug: string;
  content: string;
  version: string;
  isActive: boolean;
  isRequired: boolean;
  displayLocation: ('signup' | 'settings' | 'search' | 'relationship')[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  lastUpdatedBy?: string;
}

export interface UserLegalAcceptance {
  id: string;
  userId: string;
  documentId: string;
  documentVersion: string;
  acceptedAt: string;
  context: 'signup' | 'relationship_registration' | 'update' | 'manual';
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface StickerPack {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sticker {
  id: string;
  packId: string;
  name: string;
  imageUrl: string;
  isAnimated: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}