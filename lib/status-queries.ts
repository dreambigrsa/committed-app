/**
 * Status System Queries
 * 
 * Client-side functions for interacting with the status system
 * Handles fetching, creating, viewing, and deleting statuses
 */

import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface StatusSticker {
  id: string;
  status_id: string;
  sticker_id: string;
  sticker_image_url: string;
  position_x: number;
  position_y: number;
  scale: number;
  rotation: number;
}

export interface Status {
  id: string;
  user_id: string;
  content_type: 'text' | 'image' | 'video';
  text_content: string | null;
  media_path: string | null;
  privacy_level: 'public' | 'friends' | 'followers' | 'only_me' | 'custom';
  created_at: string;
  expires_at: string;
  archived: boolean;
  archived_at: string | null;
  // Customization fields
  background_color?: string | null;
  text_style?: 'classic' | 'neon' | 'typewriter' | 'elegant' | 'bold' | 'italic' | null;
  text_effect?: 'default' | 'white-bg' | 'black-bg' | 'outline-white' | 'outline-black' | 'glow' | null;
  text_alignment?: 'left' | 'center' | 'right' | null;
  background_image_path?: string | null;
  text_position_x?: number | null;
  text_position_y?: number | null;
  user?: {
    id: string;
    full_name: string;
    profile_picture: string | null;
  };
  has_unviewed?: boolean;
  stickers?: StatusSticker[];
}

export interface StatusFeedItem {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  latest_status: Status;
  has_unviewed: boolean;
}

// ============================================
// FEED QUERIES (Facebook Feed Style)
// ============================================

/**
 * Get status feed for the main Feed screen
 * Returns one bubble per user with their latest status
 */
export async function getStatusFeedForFeed(): Promise<StatusFeedItem[]> {
  console.log('🔍 [getStatusFeedForFeed] Starting...');
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error('❌ [getStatusFeedForFeed] Auth error:', userError);
    return [];
  }
  
  if (!user) {
    console.warn('⚠️ [getStatusFeedForFeed] No user found');
    return [];
  }

  console.log('✅ [getStatusFeedForFeed] User authenticated:', user.id);

  // Get all visible statuses (RLS filters automatically)
  // Remove client-side filters to see what RLS returns
  const { data: statuses, error } = await supabase
    .from('statuses')
    .select(`
      id,
      user_id,
      content_type,
      text_content,
      media_path,
      privacy_level,
      created_at,
      expires_at,
      archived,
      archived_at,
      background_color,
      text_style,
      text_effect,
      text_alignment,
      background_image_path,
      text_position_x,
      text_position_y
    `)
    .order('created_at', { ascending: false });

  console.log('📊 [getStatusFeedForFeed] Query result:', {
    statusesCount: statuses?.length || 0,
    statuses: statuses ? statuses.map((s: any) => ({
      id: s.id?.substring(0, 8) + '...',
      user_id: s.user_id?.substring(0, 8) + '...',
      archived: s.archived,
      expires_at: s.expires_at,
      privacy_level: s.privacy_level,
    })) : null,
    error: error ? {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    } : null,
  });

  if (error) {
    if (error.code === 'PGRST200' || error.message?.includes('schema cache')) {
      console.warn('⚠️ Status table not found. Please run COMPLETE-STATUS-SETUP-FINAL.sql in Supabase SQL Editor.');
      return [];
    }
    console.error('❌ [getStatusFeedForFeed] Error fetching status feed:', error);
    return [];
  }

  if (!statuses || statuses.length === 0) {
    console.warn('⚠️ [getStatusFeedForFeed] No statuses returned from query');
    return [];
  }

  console.log('📋 [getStatusFeedForFeed] Raw statuses:', statuses.map(s => ({
    id: s.id,
    user_id: s.user_id,
    archived: s.archived,
    expires_at: s.expires_at,
    privacy_level: s.privacy_level,
  })));

  // Filter by archived and expires_at on client side
  const now = new Date().toISOString();
  const activeStatuses = statuses.filter((s: Status) => {
    const isNotArchived = s.archived === false;
    const isNotExpired = s.expires_at > now;
    return isNotArchived && isNotExpired;
  });

  console.log('✅ [getStatusFeedForFeed] Active statuses after filtering:', activeStatuses.length);

  if (activeStatuses.length === 0) {
    console.warn('⚠️ [getStatusFeedForFeed] No active statuses after filtering');
    return [];
  }

  // Fetch user data for all status owners
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const userIds = Array.from<string>(new Set<string>(activeStatuses.map((s: Status) => s.user_id).filter((id: string) => {
    if (!id || id === 'undefined' || id === 'null' || typeof id !== 'string') {
      return false;
    }
    return uuidRegex.test(id);
  })));

  console.log('👥 [getStatusFeedForFeed] User IDs to fetch:', userIds.length);

  if (userIds.length === 0) {
    console.warn('⚠️ [getStatusFeedForFeed] No valid user IDs found in statuses');
    return [];
  }

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, full_name, profile_picture')
    .in('id', userIds);

  if (usersError) {
    console.error('Error fetching user data for statuses:', usersError);
  }

  const usersMap = new Map<string, { id: string; full_name: string; profile_picture: string | null }>();
  if (usersData) {
    console.log('✅ [getStatusFeedForFeed] Fetched user data:', usersData.length, 'users');
    usersData.forEach((u: { id: string; full_name: string; profile_picture: string | null }) => {
      usersMap.set(u.id, u);
    });
  } else {
    console.warn('⚠️ [getStatusFeedForFeed] No user data returned');
  }

  // Latest status per user (activeStatuses is newest-first)
  const latestByUser = new Map<string, Status>();
  for (const status of activeStatuses) {
    const userId = status.user_id;
    if (!latestByUser.has(userId)) {
      latestByUser.set(userId, status);
    }
  }

  const statusIdsForViews = [...latestByUser.values()].map((s) => s.id);
  const viewedStatusIds = new Set<string>();
  if (statusIdsForViews.length > 0) {
    const { data: viewsRows, error: viewsBatchError } = await supabase
      .from('status_views')
      .select('status_id')
      .eq('viewer_id', user.id)
      .in('status_id', statusIdsForViews);

    if (viewsBatchError && viewsBatchError.code !== 'PGRST116') {
      console.warn('⚠️ [getStatusFeedForFeed] Batch view lookup:', viewsBatchError);
    }
    if (viewsRows) {
      viewsRows.forEach((row: { status_id: string }) => viewedStatusIds.add(row.status_id));
    }
  }

  const statusMap = new Map<string, Status>();
  console.log('🔄 [getStatusFeedForFeed] Processing statuses (batched views):', latestByUser.size);
  for (const [userId, status] of latestByUser.entries()) {
    statusMap.set(userId, {
      ...status,
      user: usersMap.get(userId) || undefined,
      has_unviewed: !viewedStatusIds.has(status.id),
    });
  }
  
  console.log(`📦 [getStatusFeedForFeed] Status map size:`, statusMap.size);

  // Build feed items
  const feedItems: StatusFeedItem[] = [];

  // IMPORTANT: Include ALL statuses, including own status
  // The component will handle displaying them appropriately
  for (const [userId, status] of statusMap.entries()) {
    const isOwnStatus = userId === user.id;
    feedItems.push({
      user_id: userId,
      user_name: status.user?.full_name || (isOwnStatus ? 'You' : 'Unknown'),
      user_avatar: status.user?.profile_picture || null,
      latest_status: status,
      has_unviewed: isOwnStatus ? false : (status.has_unviewed || false),
    });
  }

  console.log(`📦 [getStatusFeedForFeed] Built feed items:`, {
    totalItems: feedItems.length,
    ownStatusIncluded: feedItems.some(item => item.user_id === user.id),
    ownStatusUser: feedItems.find(item => item.user_id === user.id)?.user_name,
    otherStatusesCount: feedItems.filter(item => item.user_id !== user.id).length,
    allUserIds: feedItems.map(item => item.user_id),
  });

  // Sort: unviewed first, then by most recent
  feedItems.sort((a, b) => {
    if (a.has_unviewed !== b.has_unviewed) {
      return a.has_unviewed ? -1 : 1;
    }
    if (!a.latest_status || !b.latest_status) return 0;
    return new Date(b.latest_status.created_at).getTime() - 
           new Date(a.latest_status.created_at).getTime();
  });

  console.log('🎉 [getStatusFeedForFeed] Final feed items:', feedItems.length);
  console.log('📝 [getStatusFeedForFeed] Feed items:', feedItems.map(item => ({
    user_id: item.user_id,
    user_name: item.user_name,
    has_unviewed: item.has_unviewed,
  })));

  // DEBUG: If no feed items, log everything we know
  if (feedItems.length === 0) {
    console.error('❌ [getStatusFeedForFeed] NO FEED ITEMS RETURNED!');
    console.error('📋 [getStatusFeedForFeed] Debug info:', {
      activeStatusesCount: activeStatuses.length,
      userIdsCount: userIds.length,
      usersDataCount: usersData?.length || 0,
      statusMapSize: statusMap.size,
      currentUserId: user.id,
      statusesFromQuery: statuses?.length || 0,
      allStatusUserIds: statuses?.map((s: any) => s.user_id) || [],
    });
  }

  return feedItems;
}

/**
 * Get all statuses for a specific user (for viewing their story)
 */
export async function getUserStatuses(userId: string): Promise<Status[]> {
  console.log('🔍 [getUserStatuses] Starting:', { userId });
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('⚠️ [getUserStatuses] No user found');
    return [];
  }

  if (!userId || userId === 'undefined' || userId === 'null') {
    console.error('❌ [getUserStatuses] Invalid userId:', userId);
    return [];
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error('❌ [getUserStatuses] Invalid UUID format:', userId);
    return [];
  }

  const isOwnStatus = userId === user.id;
  console.log('👤 [getUserStatuses] Is own status:', isOwnStatus);

  // Build query - for own statuses, show ALL (even expired/archived) for management
  // For others, only show active statuses
  let query = supabase
    .from('statuses')
    .select(`
      id,
      user_id,
      content_type,
      text_content,
      media_path,
      privacy_level,
      created_at,
      expires_at,
      archived,
      archived_at,
      background_color,
      text_style,
      text_effect,
      text_alignment,
      background_image_path,
      text_position_x,
      text_position_y
    `)
    .eq('user_id', userId);

  if (!isOwnStatus) {
    // For others, only show active statuses
    query = query
      .eq('archived', false)
      .gt('expires_at', new Date().toISOString());
  }
  // For own statuses, show all (no filters) - RLS policy "Users can view own statuses always" allows this

  const { data: statuses, error } = await query.order('created_at', { ascending: true });

  console.log('📊 [getUserStatuses] Query result:', {
    statusesCount: statuses?.length || 0,
    isOwnStatus,
    statuses: statuses?.map((s: any) => ({
      id: s.id?.substring(0, 8) + '...',
      content_type: s.content_type,
      archived: s.archived,
      expires_at: s.expires_at,
    })),
    error: error ? { 
      code: error.code, 
      message: error.message,
      details: error.details,
      hint: error.hint,
    } : null,
  });

  if (error) {
    console.error('❌ [getUserStatuses] Error fetching user statuses:', error);
    if (error.code === 'PGRST200' || error.message?.includes('schema cache')) {
      console.error('❌ [getUserStatuses] Table might not exist. Run COMPLETE-STATUS-FIX.sql');
    }
    return [];
  }

  if (!statuses || statuses.length === 0) {
    console.warn('⚠️ [getUserStatuses] No statuses returned for user:', userId);
    return [];
  }

  // Fetch user data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, full_name, profile_picture')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('❌ [getUserStatuses] Error fetching user data:', userError);
  }

  // Fetch stickers for all statuses
  const statusIds = statuses.map(s => s.id);
  const { data: stickersData } = await supabase
    .from('status_stickers')
    .select('*')
    .in('status_id', statusIds);

  const stickersByStatusId = new Map<string, StatusSticker[]>();
  if (stickersData) {
    stickersData.forEach((sticker: any) => {
      if (!stickersByStatusId.has(sticker.status_id)) {
        stickersByStatusId.set(sticker.status_id, []);
      }
      stickersByStatusId.get(sticker.status_id)!.push({
        id: sticker.id,
        status_id: sticker.status_id,
        sticker_id: sticker.sticker_id,
        sticker_image_url: sticker.sticker_image_url,
        position_x: sticker.position_x,
        position_y: sticker.position_y,
        scale: sticker.scale,
        rotation: sticker.rotation,
      });
    });
  }

  const result = statuses.map((status: Status) => ({
    ...status,
    user: userData || undefined,
    stickers: stickersByStatusId.get(status.id) || [],
  }));

  console.log('✅ [getUserStatuses] Returning:', {
    count: result.length,
    userData: !!userData,
    stickersCount: stickersData?.length || 0,
  });

  return result;
}

/**
 * Get status feed for the Messages screen
 */
export async function getStatusFeedForMessenger(): Promise<StatusFeedItem[]> {
  console.log('🔍 [getStatusFeedForMessenger] Starting...');
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error('❌ [getStatusFeedForMessenger] Auth error:', userError);
    return [];
  }
  
  if (!user) {
    console.warn('⚠️ [getStatusFeedForMessenger] No user found');
    return [];
  }

  console.log('✅ [getStatusFeedForMessenger] User authenticated:', user.id);

  // Get friends list
  const { data: friends, error: friendsError } = await supabase
    .from('friends')
    .select('friend_id')
    .eq('user_id', user.id)
    .eq('status', 'accepted');

  if (friendsError) {
    console.error('❌ [getStatusFeedForMessenger] Error fetching friends:', friendsError);
  }

  const friendIds = friends?.map((f) => f.friend_id) || [];
  console.log('👥 [getStatusFeedForMessenger] Friends count:', friendIds.length);

  // Get recent chat participants (from conversations/messages)
  // Try to get participants from conversations table
  let recentParticipantIds: string[] = [];
  try {
    const { data: conversations } = await supabase
      .from('conversations')
      .select('participant_ids, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50); // Get recent 50 conversations

    if (conversations) {
      const allParticipants = new Set<string>();
      conversations.forEach((conv: any) => {
        if (Array.isArray(conv.participant_ids)) {
          // Check if current user is in this conversation
          if (conv.participant_ids.includes(user.id)) {
            conv.participant_ids.forEach((p: string) => {
              if (p !== user.id) {
                allParticipants.add(p);
              }
            });
          }
        }
      });
      recentParticipantIds = Array.from(allParticipants);
      console.log('💬 [getStatusFeedForMessenger] Recent chat participants:', recentParticipantIds.length);
    }
  } catch (error) {
    console.warn('⚠️ [getStatusFeedForMessenger] Could not fetch chat participants:', error);
  }

  // Combine friends and recent chat participants
  const allowedUserIds = Array.from(new Set([...friendIds, ...recentParticipantIds]));
  console.log('👥 [getStatusFeedForMessenger] Total allowed users (friends + chat):', allowedUserIds.length);

  // Get all visible statuses (RLS will filter based on privacy)
  // IMPORTANT: Don't filter by user_id here - let RLS handle privacy, then filter client-side
  const { data: statuses, error } = await supabase
    .from('statuses')
    .select(`
      id,
      user_id,
      content_type,
      text_content,
      media_path,
      privacy_level,
      created_at,
      expires_at,
      archived,
      archived_at,
      background_color,
      text_style,
      text_effect,
      text_alignment,
      background_image_path,
      text_position_x,
      text_position_y
    `)
    .eq('archived', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  console.log('📊 [getStatusFeedForMessenger] Query result:', {
    statusesCount: statuses?.length || 0,
    error: error ? {
      message: error.message,
      code: error.code,
    } : null,
  });

  if (error) {
    console.error('❌ [getStatusFeedForMessenger] Error fetching statuses:', error);
    return [];
  }

  if (!statuses || statuses.length === 0) {
    console.warn('⚠️ [getStatusFeedForMessenger] No statuses returned');
    return [];
  }

  // Filter to show statuses from:
  // 1. Own status
  // 2. Friends (if privacy allows)
  // 3. Recent chat participants (if privacy allows)
  // Note: RLS already filtered by privacy_level='public' or privacy checks
  const filteredStatuses = statuses.filter((s: Status) => {
    if (s.user_id === user.id) {
      return true; // Always show own status
    }
    
    // For friends/followers privacy, check if user is in allowed list
    if (s.privacy_level === 'friends' || s.privacy_level === 'followers') {
      return allowedUserIds.includes(s.user_id);
    }
    
    // For public, allow if user is in allowed list (friends or recent chats)
    if (s.privacy_level === 'public') {
      return allowedUserIds.includes(s.user_id);
    }
    
    return false; // only_me and custom are handled by RLS
  });

  console.log('✅ [getStatusFeedForMessenger] Filtered statuses:', {
    total: statuses.length,
    afterFilter: filteredStatuses.length,
    ownStatusCount: filteredStatuses.filter(s => s.user_id === user.id).length,
    friendsStatusCount: filteredStatuses.filter(s => friendIds.includes(s.user_id)).length,
    chatParticipantsStatusCount: filteredStatuses.filter(s => 
      !friendIds.includes(s.user_id) && recentParticipantIds.includes(s.user_id)
    ).length,
  });

  if (filteredStatuses.length === 0) {
    console.warn('⚠️ [getStatusFeedForMessenger] No statuses after filtering');
    // Still return own status if exists
    const ownStatuses = statuses.filter(s => s.user_id === user.id);
    if (ownStatuses.length > 0) {
      console.log('✅ [getStatusFeedForMessenger] Returning own status only');
      // Continue processing with own statuses only
      filteredStatuses.push(...ownStatuses);
    } else {
      return [];
    }
  }

  // Similar processing as getStatusFeedForFeed
  const userIds = Array.from<string>(new Set<string>(filteredStatuses.map((s: Status) => s.user_id)));
  
  const { data: usersData } = await supabase
    .from('users')
    .select('id, full_name, profile_picture')
    .in('id', userIds);

  const usersMap = new Map<string, { id: string; full_name: string; profile_picture: string | null }>();
  if (usersData) {
    console.log('✅ [getStatusFeedForMessenger] Fetched user data:', usersData.length);
    usersData.forEach((u: { id: string; full_name: string; profile_picture: string | null }) => {
      usersMap.set(u.id, u);
    });
  } else {
    console.warn('⚠️ [getStatusFeedForMessenger] No user data returned');
  }

  const latestByUserMessenger = new Map<string, Status>();
  for (const status of filteredStatuses) {
    if (!latestByUserMessenger.has(status.user_id)) {
      latestByUserMessenger.set(status.user_id, status);
    }
  }

  const messengerStatusIds = [...latestByUserMessenger.values()].map((s) => s.id);
  const viewedMessenger = new Set<string>();
  if (messengerStatusIds.length > 0) {
    const { data: viewsRows, error: viewsBatchError } = await supabase
      .from('status_views')
      .select('status_id')
      .eq('viewer_id', user.id)
      .in('status_id', messengerStatusIds);

    if (viewsBatchError && viewsBatchError.code !== 'PGRST116') {
      console.warn('⚠️ [getStatusFeedForMessenger] Batch view lookup:', viewsBatchError);
    }
    if (viewsRows) {
      viewsRows.forEach((row: { status_id: string }) => viewedMessenger.add(row.status_id));
    }
  }

  const statusMap = new Map<string, Status>();
  for (const [userId, status] of latestByUserMessenger.entries()) {
    statusMap.set(userId, {
      ...status,
      user: usersMap.get(userId) || undefined,
      has_unviewed: !viewedMessenger.has(status.id),
    });
  }

  const feedItems: StatusFeedItem[] = [];
  for (const [userId, status] of statusMap.entries()) {
    const isOwnStatus = userId === user.id;
    feedItems.push({
      user_id: userId,
      user_name: status.user?.full_name || (isOwnStatus ? 'You' : 'Unknown'),
      user_avatar: status.user?.profile_picture || null,
      latest_status: status,
      has_unviewed: isOwnStatus ? false : (status.has_unviewed || false),
    });
  }

  feedItems.sort((a, b) => {
    if (a.has_unviewed !== b.has_unviewed) {
      return a.has_unviewed ? -1 : 1;
    }
    return new Date(b.latest_status.created_at).getTime() - 
           new Date(a.latest_status.created_at).getTime();
  });

  console.log('🎉 [getStatusFeedForMessenger] Final feed items:', feedItems.length);

  return feedItems;
}

// ============================================
// STATUS CREATION
// ============================================

/**
 * Create a new status
 */
export async function createStatus(
  contentType: 'text' | 'image' | 'video',
  textContent: string | null,
  mediaUri: string | null,
  privacyLevel: 'public' | 'friends' | 'followers' | 'only_me' | 'custom',
  allowedUserIds?: string[],
  customization?: {
    backgroundColor?: string;
    textStyle?: 'classic' | 'neon' | 'typewriter' | 'elegant' | 'bold' | 'italic';
    textEffect?: 'default' | 'white-bg' | 'black-bg' | 'outline-white' | 'outline-black' | 'glow';
    textAlignment?: 'left' | 'center' | 'right';
    textPositionX?: number;
    textPositionY?: number;
    backgroundImageUri?: string | null;
    stickers?: { id: string; imageUrl: string; positionX?: number; positionY?: number; scale?: number; rotation?: number }[];
  }
): Promise<Status | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('User not authenticated');
    return null;
  }

  // Get session for RLS
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.access_token) {
    console.error('No active session found');
    return null;
  }

  let mediaPath: string | null = null;
  let backgroundImagePath: string | null = null;

  // Upload media if provided
  // NOTE: Some projects use bucket `media` while others use `status-media`.
  // We try `status-media` first, then fall back to `media` for compatibility.
  if (mediaUri && (contentType === 'image' || contentType === 'video')) {
    try {
      const fileExt = contentType === 'video' ? 'mp4' : 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Handle local file URIs (file://, ph://, content://) vs remote URLs
      let fileData: Uint8Array;
      
      if (mediaUri.startsWith('file://') || mediaUri.startsWith('ph://') || mediaUri.startsWith('content://')) {
        // Local file - read using FileSystem
        const base64 = await FileSystem.readAsStringAsync(mediaUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        fileData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          fileData[i] = binaryString.charCodeAt(i);
        }
      } else {
        // Remote URL - fetch and convert to Uint8Array
        const response = await fetch(mediaUri);
        const arrayBuffer = await response.arrayBuffer();
        fileData = new Uint8Array(arrayBuffer);
      }

      const bucketsToTry = ['status-media', 'media'];
      let uploadedBucket: string | null = null;
      let lastUploadError: any = null;

      for (const bucket of bucketsToTry) {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, fileData, {
            contentType: contentType === 'video' ? 'video/mp4' : 'image/jpeg',
            upsert: false,
          });

        if (!uploadError) {
          uploadedBucket = bucket;
          break;
        }
        lastUploadError = uploadError;
      }

      if (!uploadedBucket) {
        console.error('Error uploading status media:', lastUploadError);
        const msg = String((lastUploadError as any)?.message || (lastUploadError as any)?.error_description || '');
        throw new Error(msg || 'Failed to upload status media (bucket/policy misconfiguration)');
      }

      // Store "{bucket}/{path}" so signed-url logic can resolve it.
      mediaPath = `${uploadedBucket}/${filePath}`;
    } catch (error) {
      console.error('Error processing media:', error);
      throw error;
    }
  }

  // Upload background image if provided (for text statuses)
  if (customization?.backgroundImageUri && contentType === 'text') {
    try {
      const fileName = `bg-${Date.now()}.jpg`;
      const filePath = `${user.id}/${fileName}`;

      // Handle local file URIs (file://, ph://, content://) vs remote URLs
      let fileData: Uint8Array;
      
      if (customization.backgroundImageUri.startsWith('file://') || 
          customization.backgroundImageUri.startsWith('ph://') || 
          customization.backgroundImageUri.startsWith('content://')) {
        // Local file - read using FileSystem
        const base64 = await FileSystem.readAsStringAsync(customization.backgroundImageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        fileData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          fileData[i] = binaryString.charCodeAt(i);
        }
      } else {
        // Remote URL - fetch and convert to Uint8Array
        const response = await fetch(customization.backgroundImageUri);
        const arrayBuffer = await response.arrayBuffer();
        fileData = new Uint8Array(arrayBuffer);
      }

      const bucketsToTry = ['status-media', 'media'];
      let uploadedBucket: string | null = null;
      let lastUploadError: any = null;

      for (const bucket of bucketsToTry) {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, fileData, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (!uploadError) {
          uploadedBucket = bucket;
          break;
        }
        lastUploadError = uploadError;
      }

      if (!uploadedBucket) {
        console.error('Error uploading background image:', lastUploadError);
        // Don't fail the whole status creation if background image fails
      } else {
        backgroundImagePath = `${uploadedBucket}/${filePath}`;
      }
    } catch (error) {
      console.error('Error processing background image:', error);
      // Don't fail the whole status creation if background image fails
    }
  }

  // Create status record
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const insertData: any = {
    user_id: session.user.id,
    content_type: contentType,
    text_content: textContent,
    media_path: mediaPath,
    privacy_level: privacyLevel,
    expires_at: expiresAt.toISOString(),
    // Customization fields
    background_color: customization?.backgroundColor || null,
    text_style: customization?.textStyle || 'classic',
    text_effect: customization?.textEffect || 'default',
    text_alignment: customization?.textAlignment || 'center',
    text_position_x: typeof customization?.textPositionX === 'number' ? customization?.textPositionX : 0.5,
    text_position_y: typeof customization?.textPositionY === 'number' ? customization?.textPositionY : 0.5,
    background_image_path: backgroundImagePath,
  };

  const { data: status, error: statusError } = await supabase
    .from('statuses')
    .insert(insertData)
    .select()
    .single();

  if (statusError) {
    console.error('Error creating status:', statusError);
    return null;
  }

  // Handle custom privacy
  if (privacyLevel === 'custom' && allowedUserIds && allowedUserIds.length > 0) {
    const visibilityRecords = allowedUserIds.map((userId) => ({
      status_id: status.id,
      allowed_user_id: userId,
    }));

    await supabase.from('status_visibility').insert(visibilityRecords);
  }

  // Handle stickers (upload and store references)
  if (customization?.stickers && customization.stickers.length > 0) {
    const stickerRecords = customization.stickers.map((sticker) => ({
      status_id: status.id,
      sticker_id: sticker.id,
      sticker_image_url: sticker.imageUrl,
      position_x: sticker.positionX || 0.5,
      position_y: sticker.positionY || 0.5,
      scale: sticker.scale || 1.0,
      rotation: sticker.rotation || 0,
    }));

    const { error: stickersError } = await supabase
      .from('status_stickers')
      .insert(stickerRecords);

    if (stickersError) {
      console.error('Error saving stickers:', stickersError);
      // Don't fail the whole status creation if stickers fail
    }
  }

  return status;
}

// ============================================
// STATUS VIEWING
// ============================================

/**
 * Mark a status as viewed
 */
export async function markStatusAsViewed(statusId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('⚠️ [markStatusAsViewed] No user found');
    return false;
  }

  // Get session to ensure RLS works
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.access_token) {
    console.error('❌ [markStatusAsViewed] No session found');
    return false;
  }

  console.log('👁️ [markStatusAsViewed] Marking status as viewed:', {
    statusId,
    viewerId: user.id,
  });

  const { error } = await supabase
    .from('status_views')
    .upsert({
      status_id: statusId,
      viewer_id: user.id,
      viewed_at: new Date().toISOString(),
    }, {
      onConflict: 'status_id,viewer_id',
    });

  if (error) {
    console.error('❌ [markStatusAsViewed] Error marking status as viewed:', error);
    console.error('❌ [markStatusAsViewed] Error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return false;
  }

  console.log('✅ [markStatusAsViewed] Successfully marked as viewed');
  return true;
}

/**
 * Get status view count and viewers list
 */
export interface StatusViewer {
  id: string;
  viewer_id: string;
  viewed_at: string;
  reaction_type?: 'heart' | 'like' | 'laugh' | null;
  has_message?: boolean;
  user: {
    id: string;
    full_name: string;
    profile_picture: string | null;
  };
}

export async function getStatusViewers(statusId: string): Promise<StatusViewer[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('⚠️ [getStatusViewers] No user found');
    return [];
  }

  // Get the status to check ownership
  const { data: status } = await supabase
    .from('statuses')
    .select('user_id')
    .eq('id', statusId)
    .single();

  if (!status || status.user_id !== user.id) {
    console.warn('⚠️ [getStatusViewers] Can only view own status viewers');
    return [];
  }

  // Get all viewers
  const { data: views, error } = await supabase
    .from('status_views')
    .select('id, viewer_id, viewed_at')
    .eq('status_id', statusId)
    .order('viewed_at', { ascending: false });

  if (error) {
    console.error('❌ [getStatusViewers] Error fetching viewers:', error);
    return [];
  }

  if (!views || views.length === 0) return [];

  // Get user info for all viewers
  const viewerIds = views.map(v => v.viewer_id);
  const { data: usersData } = await supabase
    .from('users')
    .select('id, full_name, profile_picture')
    .in('id', viewerIds);

  const usersMap = new Map();
  if (usersData) {
    usersData.forEach((u: any) => {
      usersMap.set(u.id, u);
    });
  }

  // Get reactions for all viewers
  const { data: reactionsData } = await supabase
    .from('status_reactions')
    .select('user_id, reaction_type')
    .eq('status_id', statusId)
    .in('user_id', viewerIds);

  const reactionsMap = new Map<string, 'heart' | 'like' | 'laugh'>();
  if (reactionsData) {
    reactionsData.forEach((r: any) => {
      reactionsMap.set(r.user_id, r.reaction_type);
    });
  }

  // Get messages that reference this status
  const { data: messagesData } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('status_id', statusId)
    .in('sender_id', viewerIds);

  const hasMessageSet = new Set<string>();
  if (messagesData) {
    messagesData.forEach((m: any) => {
      hasMessageSet.add(m.sender_id);
    });
  }

  // Combine views with user data, reactions, and messages
  return views.map((view: any) => ({
    id: view.id,
    viewer_id: view.viewer_id,
    viewed_at: view.viewed_at,
    reaction_type: reactionsMap.get(view.viewer_id) || null,
    has_message: hasMessageSet.has(view.viewer_id),
    user: usersMap.get(view.viewer_id) || {
      id: view.viewer_id,
      full_name: 'Unknown User',
      profile_picture: null,
    },
  }));
}

export async function getStatusViewCount(statusId: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // Get the status to check ownership
  const { data: status } = await supabase
    .from('statuses')
    .select('user_id')
    .eq('id', statusId)
    .single();

  if (!status || status.user_id !== user.id) {
    return 0;
  }

  const { count, error } = await supabase
    .from('status_views')
    .select('*', { count: 'exact', head: true })
    .eq('status_id', statusId);

  if (error) {
    console.error('❌ [getStatusViewCount] Error fetching view count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Update status privacy level
 */
export async function updateStatusPrivacy(
  statusId: string,
  privacyLevel: 'public' | 'friends' | 'followers' | 'only_me' | 'custom',
  allowedUserIds?: string[]
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('❌ [updateStatusPrivacy] No user found');
    return false;
  }

  // Verify ownership
  const { data: status } = await supabase
    .from('statuses')
    .select('user_id')
    .eq('id', statusId)
    .single();

  if (!status || status.user_id !== user.id) {
    console.error('❌ [updateStatusPrivacy] Can only update own statuses');
    return false;
  }

  // Update privacy level
  const { error: updateError } = await supabase
    .from('statuses')
    .update({ privacy_level: privacyLevel })
    .eq('id', statusId);

  if (updateError) {
    console.error('❌ [updateStatusPrivacy] Error updating privacy:', updateError);
    return false;
  }

  // Handle custom privacy
  if (privacyLevel === 'custom' && allowedUserIds && allowedUserIds.length > 0) {
    // Delete existing visibility records
    await supabase
      .from('status_visibility')
      .delete()
      .eq('status_id', statusId);

    // Insert new visibility records
    const visibilityRecords = allowedUserIds.map((userId) => ({
      status_id: statusId,
      allowed_user_id: userId,
    }));

    const { error: visibilityError } = await supabase
      .from('status_visibility')
      .insert(visibilityRecords);

    if (visibilityError) {
      console.error('❌ [updateStatusPrivacy] Error setting custom visibility:', visibilityError);
      return false;
    }
  } else {
    // Delete custom visibility if switching from custom to another privacy level
    await supabase
      .from('status_visibility')
      .delete()
      .eq('status_id', statusId);
  }

  return true;
}

/**
 * Archive a status
 */
export async function archiveStatus(statusId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('❌ [archiveStatus] No user found');
    return false;
  }

  // Verify ownership
  const { data: status } = await supabase
    .from('statuses')
    .select('user_id')
    .eq('id', statusId)
    .single();

  if (!status || status.user_id !== user.id) {
    console.error('❌ [archiveStatus] Can only archive own statuses');
    return false;
  }

  const { error } = await supabase
    .from('statuses')
    .update({
      archived: true,
      archived_at: new Date().toISOString(),
    })
    .eq('id', statusId);

  if (error) {
    console.error('❌ [archiveStatus] Error archiving status:', error);
    return false;
  }

  return true;
}

/**
 * Get signed URL for status media
 */
export async function getSignedUrlForMedia(mediaPath: string): Promise<string | null> {
  if (!mediaPath) return null;

  // If already a URL, use it directly
  if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
    return mediaPath;
  }

  // Support multiple stored formats:
  // - "status-media/<path>"
  // - "media/<path>"
  // - "<bucket>/<path>"
  // - Legacy: sometimes a file was uploaded to bucket "media" but the DB stored "status-media/<path>"
  //
  // We generate a set of (bucket, path) attempts and try them in order.
  const attempts: { bucket: string; path: string }[] = [];

  const addAttempt = (bucket: string, path: string) => {
    const cleanPath = path.replace(/^\/+/, '');
    if (!cleanPath) return;
    // de-dupe
    if (attempts.some((a) => a.bucket === bucket && a.path === cleanPath)) return;
    attempts.push({ bucket, path: cleanPath });
  };

  const parts = mediaPath.split('/');
  const first = parts[0];

  if (mediaPath.startsWith('status-media/')) {
    const p = mediaPath.substring('status-media/'.length);
    // normal
    addAttempt('status-media', p);
    // legacy fallback: stored with status-media prefix but actually uploaded into media bucket
    addAttempt('media', p);
    // extra legacy fallback: uploaded into media bucket without the status-media prefix
    addAttempt('media', mediaPath.substring('status-media/'.length));
  } else if (mediaPath.startsWith('media/')) {
    const p = mediaPath.substring('media/'.length);
    addAttempt('media', p);
    // legacy fallback: sometimes stored as media/<path> but uploaded into status-media bucket
    addAttempt('status-media', p);
    // legacy: "media/status-media/<path>" but actually stored as "media/<path>"
    if (p.startsWith('status-media/')) {
      const inner = p.substring('status-media/'.length);
      addAttempt('media', inner);
      addAttempt('status-media', inner);
    }
  } else if (parts.length > 1) {
    // Treat first segment as bucket candidate (e.g., "<bucket>/<path>")
    const rest = parts.slice(1).join('/');
    addAttempt(first, rest);
    // Also try common buckets with full path and with first-segment stripped
    addAttempt('status-media', mediaPath);
    addAttempt('media', mediaPath);
    addAttempt('status-media', rest);
    addAttempt('media', rest);
    // legacy: "<bucket>/status-media/<path>" but stored as "<bucket>/<path>"
    if (rest.startsWith('status-media/')) {
      const inner = rest.substring('status-media/'.length);
      addAttempt(first, inner);
      addAttempt('media', inner);
      addAttempt('status-media', inner);
    }
  } else {
    // Just a raw path
    addAttempt('status-media', mediaPath);
    addAttempt('media', mediaPath);
  }

  for (const { bucket, path } of attempts) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600); // 1 hour expiry
    if (!error && data?.signedUrl) return data.signedUrl;
    if (error && !String((error as any).message || '').toLowerCase().includes('not found')) {
      console.warn('Error creating signed URL (will retry other buckets):', { bucket, path, error });
    }
  }

  console.error('Error creating signed URL: StorageApiError: Object not found');
  return null;
}

// ============================================
// STATUS DELETION
// ============================================

/**
 * Delete a status (owner only)
 */
/**
 * React to a status
 */
export async function reactToStatus(
  statusId: string,
  reactionType: 'heart' | 'like' | 'laugh'
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('❌ [reactToStatus] No authenticated user');
    return false;
  }

  try {
    // First, check if reaction already exists
    const { data: existingReaction } = await supabase
      .from('status_reactions')
      .select('id, reaction_type')
      .eq('status_id', statusId)
      .eq('user_id', user.id)
      .maybeSingle();

    let error;
    
    if (existingReaction) {
      // Update existing reaction
      const { error: updateError } = await supabase
        .from('status_reactions')
        .update({ reaction_type: reactionType })
        .eq('id', existingReaction.id);
      error = updateError;
    } else {
      // Insert new reaction
      const { error: insertError } = await supabase
        .from('status_reactions')
        .insert({
          status_id: statusId,
          user_id: user.id,
          reaction_type: reactionType,
        });
      error = insertError;
    }

    if (error) {
      console.error('❌ [reactToStatus] Database error:', error);
      console.error('❌ [reactToStatus] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      // Check if it's a table not found error
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.error('❌ [reactToStatus] Table "status_reactions" does not exist. Please run status-reactions-setup.sql');
      } else if (error.code === '42501' || error.message?.includes('permission denied') || error.code === 'PGRST301') {
        console.error('❌ [reactToStatus] Permission denied. Check RLS policies for status_reactions table.');
        console.error('❌ [reactToStatus] Status ID:', statusId);
        console.error('❌ [reactToStatus] User ID:', user.id);
      }
      throw error;
    }
    console.log('✅ [reactToStatus] Reaction saved successfully');
    return true;
  } catch (error) {
    console.error('❌ [reactToStatus] Error reacting to status:', error);
    // Re-throw to let caller handle it
    throw error;
  }
}

/**
 * Remove reaction from a status
 */
export async function removeStatusReaction(statusId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  try {
    const { error } = await supabase
      .from('status_reactions')
      .delete()
      .eq('status_id', statusId)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error removing reaction:', error);
    return false;
  }
}

/**
 * Get user's reaction to a status
 */
export async function getUserReaction(statusId: string): Promise<'heart' | 'like' | 'laugh' | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from('status_reactions')
      .select('reaction_type')
      .eq('status_id', statusId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data?.reaction_type as 'heart' | 'like' | 'laugh' | null;
  } catch (error) {
    console.error('Error getting user reaction:', error);
    return null;
  }
}

/**
 * Get reaction counts for a status
 */
export async function getStatusReactionCounts(statusId: string): Promise<{
  heart: number;
  like: number;
  laugh: number;
}> {
  try {
    const { data, error } = await supabase
      .from('status_reactions')
      .select('reaction_type')
      .eq('status_id', statusId);

    if (error) throw error;

    const counts = {
      heart: 0,
      like: 0,
      laugh: 0,
    };

    data?.forEach((reaction) => {
      if (reaction.reaction_type === 'heart') counts.heart++;
      else if (reaction.reaction_type === 'like') counts.like++;
      else if (reaction.reaction_type === 'laugh') counts.laugh++;
    });

    return counts;
  } catch (error) {
    console.error('Error getting reaction counts:', error);
    return { heart: 0, like: 0, laugh: 0 };
  }
}

export async function deleteStatus(statusId: string): Promise<boolean> {
  console.log('🗑️ [deleteStatus] Starting deletion:', { statusId });
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('❌ [deleteStatus] No authenticated user');
    return false;
  }

  console.log('✅ [deleteStatus] User authenticated:', user.id);

  // Strategy: Try to fetch status info for media cleanup
  // If that fails (e.g., RLS blocks expired/archived statuses), proceed with deletion anyway
  // The DELETE RLS policy should allow owners to delete their own statuses regardless of expiration/archival
  let status: { media_path?: string | null; background_image_path?: string | null } | null = null;
  
  const { data: statusData, error: selectError } = await supabase
    .from('statuses')
    .select('media_path, background_image_path, id')
    .eq('id', statusId)
    .eq('user_id', user.id)
    .maybeSingle(); // Use maybeSingle() instead of single() to avoid error if not found

  if (!selectError && statusData) {
    status = statusData;
    console.log('✅ [deleteStatus] Status found, preparing to delete media...');
  } else if (selectError) {
    console.warn('⚠️ [deleteStatus] Could not fetch status details (may be expired/archived):', selectError.message);
    console.log('⚠️ [deleteStatus] Proceeding with direct deletion (RLS will authorize)...');
  }

  // Delete media files if we were able to fetch status info
  if (status) {
    const filesToDelete: string[] = [];

    if (status.media_path) {
      // Extract file path (remove bucket name if present)
      const pathParts = status.media_path.split('/');
      // Handle both "status-media/..." and "bucket-name/status-media/..." formats
      const bucketIndex = pathParts.indexOf('status-media');
      const filePath = bucketIndex >= 0 
        ? pathParts.slice(bucketIndex).join('/')
        : pathParts.slice(1).join('/');
      filesToDelete.push(filePath);
      console.log('📎 [deleteStatus] Adding media file to delete:', filePath);
    }

    if (status.background_image_path) {
      const pathParts = status.background_image_path.split('/');
      const bucketIndex = pathParts.indexOf('status-media');
      const filePath = bucketIndex >= 0 
        ? pathParts.slice(bucketIndex).join('/')
        : pathParts.slice(1).join('/');
      filesToDelete.push(filePath);
      console.log('📎 [deleteStatus] Adding background image to delete:', filePath);
    }

    // Delete all media files
    if (filesToDelete.length > 0) {
      try {
        const { error: storageError } = await supabase.storage
          .from('status-media')
          .remove(filesToDelete);

        if (storageError) {
          console.error('⚠️ [deleteStatus] Error deleting media files:', storageError);
          // Continue with status deletion even if media deletion fails
        } else {
          console.log('✅ [deleteStatus] Media files deleted:', filesToDelete.length);
        }
      } catch (storageErr) {
        console.error('⚠️ [deleteStatus] Exception deleting media:', storageErr);
        // Continue with status deletion
      }
    }

    // Delete stickers
    try {
      const { error: stickersError } = await supabase
        .from('status_stickers')
        .delete()
        .eq('status_id', statusId);

      if (stickersError) {
        console.error('⚠️ [deleteStatus] Error deleting stickers:', stickersError);
        // Continue with status deletion even if sticker deletion fails
      } else {
        console.log('✅ [deleteStatus] Stickers deleted');
      }
    } catch (stickersErr) {
      console.error('⚠️ [deleteStatus] Exception deleting stickers:', stickersErr);
      // Continue with status deletion
    }
  }

  // Delete status record
  // RLS policy "Users can delete own statuses" should allow this
  const { data: deleteData, error: deleteError } = await supabase
    .from('statuses')
    .delete()
    .eq('id', statusId)
    .eq('user_id', user.id)
    .select(); // Select to get confirmation

  if (deleteError) {
    console.error('❌ [deleteStatus] Error deleting status:', {
      code: deleteError.code,
      message: deleteError.message,
      details: deleteError.details,
      hint: deleteError.hint,
    });
    return false;
  }

  // Check if anything was actually deleted
  if (deleteData && deleteData.length === 0) {
    console.error('❌ [deleteStatus] No status was deleted (may not exist or not owned by user)');
    return false;
  }

  console.log('✅ [deleteStatus] Status deleted successfully');
  return true;
}

