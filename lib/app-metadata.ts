/**
 * App Metadata Service
 * Dynamically discovers and exposes app structure, routes, screens, and functions
 * This allows the AI to query the app structure in real-time instead of relying on hardcoded knowledge
 */

export interface AppRoute {
  path: string;
  name: string;
  description?: string;
  category: 'tab' | 'screen' | 'admin' | 'feature';
  requiresAuth?: boolean;
  requiresRole?: string[];
}

export interface AppFunction {
  name: string;
  description: string;
  category: string;
  parameters?: string[];
  returnType?: string;
}

export interface AppFeature {
  name: string;
  description: string;
  routes: string[];
  functions: string[];
  category: string;
}

/**
 * Get all app routes dynamically
 */
export async function getAppRoutes(): Promise<AppRoute[]> {
  const routes: AppRoute[] = [
    // Main Tabs
    { path: '/(tabs)/home', name: 'Home', description: 'Dashboard with relationship status and overview', category: 'tab' },
    { path: '/(tabs)/feed', name: 'Feed', description: 'Social posts feed with likes and comments', category: 'tab' },
    { path: '/(tabs)/reels', name: 'Reels', description: 'Short vertical videos (TikTok-style)', category: 'tab' },
    { path: '/(tabs)/dating', name: 'Dating', description: 'Discover potential matches, swipe through profiles', category: 'tab' },
    { path: '/(tabs)/search', name: 'Search', description: 'Find users and check relationship status', category: 'tab' },
    { path: '/(tabs)/messages', name: 'Messages', description: 'Conversations and Committed AI chat', category: 'tab' },
    { path: '/(tabs)/notifications', name: 'Notifications', description: 'Alerts, requests, and system notices', category: 'tab' },
    { path: '/(tabs)/profile', name: 'Profile', description: 'Your profile with stats and settings', category: 'tab' },
    
    // Dating Features
    { path: '/dating/profile-setup', name: 'Dating Profile Setup', description: 'Create or edit your dating profile with photos, bio, preferences', category: 'feature', requiresAuth: true },
    { path: '/dating/matches', name: 'Dating Matches', description: 'View all your mutual matches', category: 'feature', requiresAuth: true },
    { path: '/dating/filters', name: 'Dating Filters', description: 'Set age range, distance, and gender preferences', category: 'feature', requiresAuth: true },
    { path: '/dating/create-date-request', name: 'Create Date Request', description: 'Create a date request with a matched user', category: 'feature', requiresAuth: true },
    { path: '/dating/date-requests', name: 'Date Requests', description: 'View and manage date requests', category: 'feature', requiresAuth: true },
    { path: '/dating/likes-received', name: 'Likes Received', description: 'See who liked your profile (premium feature)', category: 'feature', requiresAuth: true },
    { path: '/dating/premium', name: 'Dating Premium', description: 'Upgrade to premium dating features', category: 'feature', requiresAuth: true },
    
    // Relationship Features
    { path: '/relationship/register', name: 'Register Relationship', description: 'Multi-step relationship registration with partner invitation', category: 'feature', requiresAuth: true },
    
    // Messages
    { path: '/messages/[conversationId]', name: 'Chat', description: 'Individual chat conversation with messages, images, documents', category: 'screen', requiresAuth: true },
    
    // Profile
    { path: '/profile/[userId]', name: 'User Profile', description: 'View another user\'s profile', category: 'screen', requiresAuth: true },
    
    // Settings
    { path: '/settings', name: 'Settings', description: 'Account settings, privacy, notifications, end relationship', category: 'screen', requiresAuth: true },
    { path: '/settings/2fa', name: 'Two-Factor Authentication', description: 'Enable 2FA for account security', category: 'feature', requiresAuth: true },
    { path: '/settings/blocked-users', name: 'Blocked Users', description: 'Manage blocked users list', category: 'feature', requiresAuth: true },
    { path: '/settings/become-professional', name: 'Become Professional', description: 'Apply to become a verified professional', category: 'feature', requiresAuth: true },
    
    // Verification
    { path: '/verification', name: 'Verification Hub', description: 'Overview of all verification options', category: 'feature', requiresAuth: true },
    { path: '/verification/phone', name: 'Phone Verification', description: 'Verify your phone number', category: 'feature', requiresAuth: true },
    { path: '/verification/email', name: 'Email Verification', description: 'Verify your email address', category: 'feature', requiresAuth: true },
    { path: '/verification/id', name: 'ID Verification', description: 'Upload government ID for verification', category: 'feature', requiresAuth: true },
    { path: '/verification/couple-selfie', name: 'Couple Selfie', description: 'Upload couple selfie for relationship verification', category: 'feature', requiresAuth: true },
    
    // Posts & Reels
    { path: '/post/create', name: 'Create Post', description: 'Create a new social media post', category: 'feature', requiresAuth: true },
    { path: '/post/[postId]', name: 'Post Detail', description: 'View post details with comments', category: 'screen', requiresAuth: true },
    { path: '/reel/create', name: 'Create Reel', description: 'Create a new video reel', category: 'feature', requiresAuth: true },
    { path: '/reel/[reelId]', name: 'Reel Detail', description: 'View reel details with comments', category: 'screen', requiresAuth: true },
    
    // Status
    { path: '/status/create', name: 'Create Status', description: 'Create a temporary status (photo/video/text)', category: 'feature', requiresAuth: true },
    { path: '/status/[userId]', name: 'View Status', description: 'View user\'s status updates', category: 'screen', requiresAuth: true },
    
    // Admin (requires admin role)
    { path: '/admin', name: 'Admin Dashboard', description: 'Admin overview and analytics', category: 'admin', requiresAuth: true, requiresRole: ['admin', 'super_admin'] },
    { path: '/admin/users', name: 'Manage Users', description: 'View and manage all users', category: 'admin', requiresAuth: true, requiresRole: ['admin', 'super_admin'] },
    { path: '/admin/relationships', name: 'Manage Relationships', description: 'View and manage all relationships', category: 'admin', requiresAuth: true, requiresRole: ['admin', 'super_admin'] },
    { path: '/admin/settings', name: 'Admin Settings', description: 'Platform settings, OpenAI key management', category: 'admin', requiresAuth: true, requiresRole: ['super_admin'] },
    { path: '/admin/dating-interests', name: 'Dating Interests', description: 'Manage dating interests (sports, music, etc.)', category: 'admin', requiresAuth: true, requiresRole: ['admin', 'super_admin'] },
    { path: '/admin/false-relationship-reports', name: 'False Relationship Reports', description: 'Review and resolve false relationship reports', category: 'admin', requiresAuth: true, requiresRole: ['admin', 'super_admin'] },
  ];
  
  return routes;
}

/**
 * Get all available app functions from AppContext
 */
export async function getAppFunctions(): Promise<AppFunction[]> {
  const functions: AppFunction[] = [
    // User & Profile
    { name: 'updateUserProfile', description: 'Update user profile information', category: 'user' },
    { name: 'searchUsers', description: 'Search for users by name, username, or phone', category: 'user' },
    { name: 'searchByFace', description: 'Search for users by face recognition', category: 'user' },
    
    // Relationships
    { name: 'createRelationship', description: 'Create a new relationship request', category: 'relationship' },
    { name: 'acceptRelationshipRequest', description: 'Accept a pending relationship request', category: 'relationship' },
    { name: 'rejectRelationshipRequest', description: 'Reject a pending relationship request', category: 'relationship' },
    { name: 'endRelationship', description: 'Request to end a relationship (requires partner confirmation)', category: 'relationship' },
    { name: 'confirmEndRelationship', description: 'Confirm or reject an end relationship request', category: 'relationship' },
    { name: 'getCurrentUserRelationship', description: 'Get current user\'s active relationship', category: 'relationship' },
    { name: 'getUserRelationship', description: 'Get relationship between two users', category: 'relationship' },
    { name: 'getPendingRequests', description: 'Get pending relationship requests', category: 'relationship' },
    { name: 'getPendingEndRelationshipRequests', description: 'Get pending end relationship requests', category: 'relationship' },
    
    // Dating
    { name: 'getDatingProfile', description: 'Get user\'s dating profile', category: 'dating' },
    { name: 'createOrUpdateDatingProfile', description: 'Create or update dating profile with photos, bio, preferences', category: 'dating' },
    { name: 'getDatingDiscovery', description: 'Get discovery feed of potential matches based on filters', category: 'dating' },
    { name: 'likeUser', description: 'Like a user in dating discovery', category: 'dating' },
    { name: 'passUser', description: 'Pass on a user in dating discovery', category: 'dating' },
    { name: 'getMatches', description: 'Get all mutual matches', category: 'dating' },
    { name: 'unmatch', description: 'Unmatch with someone', category: 'dating' },
    { name: 'getDatingInterests', description: 'Get all available dating interests', category: 'dating' },
    
    // Posts & Reels
    { name: 'createPost', description: 'Create a new social media post', category: 'content' },
    { name: 'createReel', description: 'Create a new video reel', category: 'content' },
    { name: 'toggleLike', description: 'Like or unlike a post', category: 'content' },
    { name: 'toggleReelLike', description: 'Like or unlike a reel', category: 'content' },
    { name: 'addComment', description: 'Add a comment to a post', category: 'content' },
    { name: 'addReelComment', description: 'Add a comment to a reel', category: 'content' },
    { name: 'getComments', description: 'Get comments for a post', category: 'content' },
    { name: 'getReelComments', description: 'Get comments for a reel', category: 'content' },
    
    // Messages
    { name: 'sendMessage', description: 'Send a message in a conversation', category: 'messaging' },
    { name: 'getConversation', description: 'Get conversation details', category: 'messaging' },
    { name: 'getMessages', description: 'Get messages in a conversation', category: 'messaging' },
    { name: 'createOrGetConversation', description: 'Create a new conversation or get existing one', category: 'messaging' },
    { name: 'deleteMessage', description: 'Delete a message (for me or everyone)', category: 'messaging' },
    { name: 'deleteConversation', description: 'Delete an entire conversation', category: 'messaging' },
    { name: 'getChatBackground', description: 'Get chat background settings', category: 'messaging' },
    { name: 'setChatBackground', description: 'Set chat background (color, image, gradient)', category: 'messaging' },
    
    // Notifications
    { name: 'createNotification', description: 'Create a notification for a user', category: 'notifications' },
    { name: 'markNotificationAsRead', description: 'Mark a notification as read', category: 'notifications' },
    { name: 'deleteNotification', description: 'Delete a notification', category: 'notifications' },
    { name: 'getUnreadNotificationsCount', description: 'Get count of unread notifications', category: 'notifications' },
    { name: 'clearAllNotifications', description: 'Clear all notifications', category: 'notifications' },
    
    // Verification
    { name: 'sendPhoneVerificationCode', description: 'Send phone verification code via SMS', category: 'verification' },
    { name: 'verifyPhoneCode', description: 'Verify phone with code', category: 'verification' },
    { name: 'sendEmailVerificationCode', description: 'Send email verification code', category: 'verification' },
    { name: 'verifyEmailCode', description: 'Verify email with code', category: 'verification' },
    { name: 'uploadIDVerification', description: 'Upload government ID for verification', category: 'verification' },
    { name: 'uploadCoupleSelfie', description: 'Upload couple selfie for relationship verification', category: 'verification' },
    
    // Social
    { name: 'followUser', description: 'Follow a user', category: 'social' },
    { name: 'unfollowUser', description: 'Unfollow a user', category: 'social' },
    { name: 'isFollowing', description: 'Check if following a user', category: 'social' },
    { name: 'blockUser', description: 'Block a user', category: 'social' },
    { name: 'unblockUser', description: 'Unblock a user', category: 'social' },
    { name: 'isBlocked', description: 'Check if a user is blocked', category: 'social' },
    { name: 'reportContent', description: 'Report inappropriate content', category: 'social' },
    { name: 'reportFalseRelationship', description: 'Report a false relationship', category: 'social' },
    
    // Certificates & Anniversaries
    { name: 'createCertificate', description: 'Create a relationship certificate', category: 'relationship' },
    { name: 'getCertificates', description: 'Get relationship certificates', category: 'relationship' },
    { name: 'createAnniversary', description: 'Create an anniversary reminder', category: 'relationship' },
    { name: 'getAnniversaries', description: 'Get anniversary reminders', category: 'relationship' },
    { name: 'createMilestone', description: 'Create a relationship milestone', category: 'relationship' },
    { name: 'getMilestones', description: 'Get relationship milestones', category: 'relationship' },
    { name: 'getAchievements', description: 'Get user achievements', category: 'gamification' },
    { name: 'getCoupleLevel', description: 'Get couple level and experience', category: 'gamification' },
  ];
  
  return functions;
}

/**
 * Get app features with their associated routes and functions
 */
export async function getAppFeatures(): Promise<AppFeature[]> {
  const features: AppFeature[] = [
    {
      name: 'Dating',
      description: 'Discover potential matches, swipe through profiles, create matches, send date requests',
      routes: ['/(tabs)/dating', '/dating/profile-setup', '/dating/matches', '/dating/filters', '/dating/create-date-request', '/dating/date-requests'],
      functions: ['getDatingProfile', 'createOrUpdateDatingProfile', 'getDatingDiscovery', 'likeUser', 'passUser', 'getMatches', 'unmatch', 'getDatingInterests'],
      category: 'social'
    },
    {
      name: 'Relationship Management',
      description: 'Register relationships, verify them, end relationships with partner confirmation',
      routes: ['/relationship/register', '/settings'],
      functions: ['createRelationship', 'acceptRelationshipRequest', 'rejectRelationshipRequest', 'endRelationship', 'confirmEndRelationship', 'getCurrentUserRelationship'],
      category: 'core'
    },
    {
      name: 'Messaging',
      description: 'Chat with users, send messages, images, documents, stickers, customize backgrounds',
      routes: ['/(tabs)/messages', '/messages/[conversationId]'],
      functions: ['sendMessage', 'getConversation', 'getMessages', 'createOrGetConversation', 'deleteMessage', 'getChatBackground', 'setChatBackground'],
      category: 'communication'
    },
    {
      name: 'Social Feed',
      description: 'Create posts, reels, like, comment, share content',
      routes: ['/(tabs)/feed', '/(tabs)/reels', '/post/create', '/reel/create'],
      functions: ['createPost', 'createReel', 'toggleLike', 'toggleReelLike', 'addComment', 'addReelComment'],
      category: 'social'
    },
    {
      name: 'Verification',
      description: 'Verify phone, email, ID, and couple selfie for relationship verification',
      routes: ['/verification', '/verification/phone', '/verification/email', '/verification/id', '/verification/couple-selfie'],
      functions: ['sendPhoneVerificationCode', 'verifyPhoneCode', 'sendEmailVerificationCode', 'verifyEmailCode', 'uploadIDVerification', 'uploadCoupleSelfie'],
      category: 'security'
    },
    {
      name: 'Notifications',
      description: 'Receive and manage notifications for requests, matches, messages, and more',
      routes: ['/(tabs)/notifications'],
      functions: ['createNotification', 'markNotificationAsRead', 'deleteNotification', 'getUnreadNotificationsCount'],
      category: 'communication'
    }
  ];
  
  return features;
}

/**
 * Get comprehensive app metadata for AI
 * This is what the AI will query to understand the app structure
 */
export async function getAppMetadata(): Promise<{
  routes: AppRoute[];
  functions: AppFunction[];
  features: AppFeature[];
  summary: string;
}> {
  const [routes, functions, features] = await Promise.all([
    getAppRoutes(),
    getAppFunctions(),
    getAppFeatures()
  ]);
  
  const summary = `
The Committed app has ${routes.length} routes, ${functions.length} functions, and ${features.length} major features.
Main tabs: Home, Feed, Reels, Dating, Search, Messages, Notifications, Profile.
Key features: Dating discovery, Relationship management, Messaging, Social feed, Verification system, Notifications.
Admin features available for admin/super_admin roles.
  `.trim();
  
  return {
    routes,
    functions,
    features,
    summary
  };
}

/**
 * Search routes by keyword
 */
export async function searchRoutes(keyword: string): Promise<AppRoute[]> {
  const routes = await getAppRoutes();
  const lowerKeyword = keyword.toLowerCase();
  return routes.filter(route => 
    route.name.toLowerCase().includes(lowerKeyword) ||
    route.path.toLowerCase().includes(lowerKeyword) ||
    route.description?.toLowerCase().includes(lowerKeyword) ||
    route.category.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * Search functions by keyword
 */
export async function searchFunctions(keyword: string): Promise<AppFunction[]> {
  const functions = await getAppFunctions();
  const lowerKeyword = keyword.toLowerCase();
  return functions.filter(func => 
    func.name.toLowerCase().includes(lowerKeyword) ||
    func.description.toLowerCase().includes(lowerKeyword) ||
    func.category.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * Get feature by name
 */
export async function getFeatureByName(name: string): Promise<AppFeature | null> {
  const features = await getAppFeatures();
  return features.find(f => f.name.toLowerCase() === name.toLowerCase()) || null;
}

