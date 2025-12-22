import { supabase } from './supabase';
import type { User } from '@/types';

/**
 * Dating Service - Direct Supabase operations
 * Replaces tRPC backend calls with direct Supabase queries
 */

// ============================================
// PROFILE OPERATIONS
// ============================================

export async function getDatingProfile(userId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const targetUserId = userId || user?.id;

  if (!targetUserId) {
    console.log('getDatingProfile: No user ID');
    return null;
  }

  const { data, error } = await supabase
    .from('dating_profiles')
    .select(`
      *,
      photos:dating_photos(*),
      videos:dating_videos(*),
      user:users!dating_profiles_user_id_fkey(id, full_name, profile_picture, verified)
    `)
    .eq('user_id', targetUserId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found - this is okay, return null
      console.log('getDatingProfile: Profile not found for user', targetUserId);
      return null;
    }
    console.error('getDatingProfile error:', error);
    throw error;
  }
  
  console.log('getDatingProfile: Found profile', data?.id);
  return data;
}

export async function createOrUpdateDatingProfile(profileData: {
  bio?: string;
  age?: number;
  location_city?: string;
  location_latitude?: number;
  location_longitude?: number;
  relationship_goals?: string[];
  interests?: string[];
  looking_for?: 'men' | 'women' | 'everyone';
  age_range_min?: number;
  age_range_max?: number;
  max_distance_km?: number;
  is_active?: boolean;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Check if profile exists
  const { data: existing } = await supabase
    .from('dating_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (existing) {
    // Update existing profile
    const { data, error } = await supabase
      .from('dating_profiles')
      .update(profileData)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // Create new profile
    const { data, error } = await supabase
      .from('dating_profiles')
      .insert({
        user_id: user.id,
        ...profileData,
        is_active: profileData.is_active ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export async function deleteDatingPhoto(photoId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Verify photo belongs to user's profile
  const { data: photo } = await supabase
    .from('dating_photos')
    .select('dating_profile_id, dating_profiles!inner(user_id)')
    .eq('id', photoId)
    .single();

  if (!photo) throw new Error('Photo not found');

  const { error } = await supabase
    .from('dating_photos')
    .delete()
    .eq('id', photoId);

  if (error) throw error;
  return { success: true };
}

// ============================================
// DISCOVERY & MATCHING
// ============================================

export async function getDatingDiscovery(filters?: {
  minAge?: number;
  maxAge?: number;
  maxDistance?: number;
  lookingFor?: 'men' | 'women' | 'everyone';
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get user's profile for preferences
  const { data: userProfile } = await supabase
    .from('dating_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!userProfile || !userProfile.is_active) {
    return { profiles: [], hasMore: false };
  }

  // Build query
  let query = supabase
    .from('dating_profiles')
    .select(`
      *,
      user:users!dating_profiles_user_id_fkey(
        id,
        full_name,
        profile_picture,
        verified,
        email_verified,
        phone_verified,
        id_verified
      ),
      photos:dating_photos(*)
    `)
    .eq('is_active', true)
    .neq('user_id', user.id)
    .limit(20);

  // Apply filters
  if (filters?.minAge || userProfile.age_range_min) {
    query = query.gte('age', filters?.minAge || userProfile.age_range_min || 18);
  }
  if (filters?.maxAge || userProfile.age_range_max) {
    query = query.lte('age', filters?.maxAge || userProfile.age_range_max || 99);
  }

  // Exclude already liked/passed users
  const { data: liked } = await supabase
    .from('dating_likes')
    .select('liked_id')
    .eq('liker_id', user.id);

  const { data: passed } = await supabase
    .from('dating_passes')
    .select('passed_id')
    .eq('passer_id', user.id);

  const excludedIds = [
    ...(liked?.map(l => l.liked_id) || []),
    ...(passed?.map(p => p.passed_id) || []),
  ];

  if (excludedIds.length > 0) {
    query = query.not('user_id', 'in', `(${excludedIds.join(',')})`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return { profiles: data || [], hasMore: (data?.length || 0) >= 20 };
}

export async function likeUser(likedUserId: string, isSuperLike: boolean = false) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Check if already liked
  const { data: existing } = await supabase
    .from('dating_likes')
    .select('id')
    .eq('liker_id', user.id)
    .eq('liked_id', likedUserId)
    .single();

  if (existing) {
    return { isMatch: false, like: existing };
  }

  // Create like
  const { data: like, error } = await supabase
    .from('dating_likes')
    .insert({
      liker_id: user.id,
      liked_id: likedUserId,
      is_super_like: isSuperLike,
    })
    .select()
    .single();

  if (error) throw error;

  // Check for mutual like (match)
  const { data: mutualLike } = await supabase
    .from('dating_likes')
    .select('id')
    .eq('liker_id', likedUserId)
    .eq('liked_id', user.id)
    .single();

  let isMatch = false;
  if (mutualLike) {
    // Create match
    const { data: match, error: matchError } = await supabase
      .from('dating_matches')
      .insert({
        user1_id: user.id < likedUserId ? user.id : likedUserId,
        user2_id: user.id > likedUserId ? user.id : likedUserId,
      })
      .select()
      .single();

    if (!matchError) {
      isMatch = true;
      // Create notifications for both users
      await supabase.from('notifications').insert([
        {
          user_id: user.id,
          type: 'dating_match',
          title: "It's a Match!",
          message: `You and ${(await supabase.from('users').select('full_name').eq('id', likedUserId).single()).data?.full_name || 'someone'} liked each other!`,
          data: { match_id: match.id, matched_user_id: likedUserId },
        },
        {
          user_id: likedUserId,
          type: 'dating_match',
          title: "It's a Match!",
          message: `You and ${(await supabase.from('users').select('full_name').eq('id', user.id).single()).data?.full_name || 'someone'} liked each other!`,
          data: { match_id: match.id, matched_user_id: user.id },
        },
      ]);
    }
  } else {
    // Create notification for liked user
    const { data: liker } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single();

    await supabase.from('notifications').insert({
      user_id: likedUserId,
      type: isSuperLike ? 'dating_super_like' : 'dating_like',
      title: isSuperLike ? 'Super Like!' : 'New Like',
      message: `${liker?.full_name || 'Someone'} ${isSuperLike ? 'super liked' : 'liked'} you!`,
      data: { liker_id: user.id },
    });
  }

  return { isMatch, like };
}

export async function passUser(passedUserId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Check if already passed
  const { data: existing } = await supabase
    .from('dating_passes')
    .select('id')
    .eq('passer_id', user.id)
    .eq('passed_id', passedUserId)
    .single();

  if (existing) {
    return { success: true };
  }

  const { error } = await supabase
    .from('dating_passes')
    .insert({
      passer_id: user.id,
      passed_id: passedUserId,
    });

  if (error) throw error;
  return { success: true };
}

// ============================================
// MATCHES
// ============================================

export async function getDatingMatches() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('dating_matches')
    .select(`
      *,
      user1:users!dating_matches_user1_id_fkey(
        id,
        full_name,
        profile_picture,
        verified
      ),
      user2:users!dating_matches_user2_id_fkey(
        id,
        full_name,
        profile_picture,
        verified
      )
    `)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Format matches to show the other user
  return (data || []).map(match => ({
    ...match,
    matchedUser: match.user1_id === user.id ? match.user2 : match.user1,
  }));
}

export async function unmatchUser(matchId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Verify match belongs to user
  const { data: match } = await supabase
    .from('dating_matches')
    .select('*')
    .eq('id', matchId)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .single();

  if (!match) throw new Error('Match not found');

  const { error } = await supabase
    .from('dating_matches')
    .delete()
    .eq('id', matchId);

  if (error) throw error;
  return { success: true };
}

export async function getLikesReceived() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Check subscription for premium feature
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!subscription) {
    throw new Error('Premium subscription required to see who liked you');
  }

  const { data, error } = await supabase
    .from('dating_likes')
    .select(`
      *,
      liker:users!dating_likes_liker_id_fkey(
        id,
        full_name,
        profile_picture,
        verified
      )
    `)
    .eq('liked_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ============================================
// INTERESTS
// ============================================

export async function getDatingInterests() {
  const { data, error } = await supabase
    .from('dating_interests')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  
  const interests = data || [];
  
  // Group by category
  const grouped: Record<string, any[]> = {};
  const categories: string[] = [];
  
  interests.forEach((interest: any) => {
    const cat = interest.category || 'other';
    if (!grouped[cat]) {
      grouped[cat] = [];
      categories.push(cat);
    }
    grouped[cat].push(interest);
  });
  
  return {
    all: interests,
    grouped,
    categories,
  };
}

// ============================================
// DATE REQUESTS
// ============================================

export async function getDateOptions() {
  const { data, error } = await supabase
    .from('dating_date_options')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;

  // Group by type
  const grouped = {
    dressCodes: data?.filter(d => d.option_type === 'dress_code') || [],
    budgetRanges: data?.filter(d => d.option_type === 'budget_range') || [],
    expenseHandling: data?.filter(d => d.option_type === 'expense_handling') || [],
    suggestedActivities: data?.filter(d => d.option_type === 'suggested_activity') || [],
  };

  return grouped;
}

export async function getDateRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('dating_date_requests')
    .select(`
      *,
      initiator:users!dating_date_requests_initiator_id_fkey(
        id,
        full_name,
        profile_picture,
        verified
      ),
      recipient:users!dating_date_requests_recipient_id_fkey(
        id,
        full_name,
        profile_picture,
        verified
      )
    `)
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createDateRequest(requestData: {
  recipientId: string;
  title: string;
  description?: string;
  locationName: string;
  locationLatitude?: number;
  locationLongitude?: number;
  proposedDate: string;
  proposedTime: string;
  durationMinutes?: number;
  suggestedActivities?: string[];
  dressCode?: string;
  budgetRange?: string;
  expenseHandling?: string;
  numberOfPeople?: number;
  genderPreference?: string;
  specialRequests?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('dating_date_requests')
    .insert({
      initiator_id: user.id,
      ...requestData,
      status: 'pending',
    })
    .select(`
      *,
      recipient:users!dating_date_requests_recipient_id_fkey(
        id,
        full_name,
        profile_picture
      )
    `)
    .single();

  if (error) throw error;

  // Create notification
  await supabase.from('notifications').insert({
    user_id: requestData.recipientId,
    type: 'dating_date_request',
    title: 'New Date Request',
    message: `${(await supabase.from('users').select('full_name').eq('id', user.id).single()).data?.full_name || 'Someone'} sent you a date request!`,
    data: { date_request_id: data.id, initiator_id: user.id },
  });

  return data;
}

export async function respondToDateRequest(
  requestId: string,
  response: 'accepted' | 'declined'
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: request } = await supabase
    .from('dating_date_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (!request || request.recipient_id !== user.id) {
    throw new Error('Date request not found or unauthorized');
  }

  if (request.status !== 'pending') {
    throw new Error('Date request has already been responded to');
  }

  const { data, error } = await supabase
    .from('dating_date_requests')
    .update({
      status: response,
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;

  // Create notification
  await supabase.from('notifications').insert({
    user_id: request.initiator_id,
    type: response === 'accepted' ? 'dating_date_accepted' : 'dating_date_declined',
    title: response === 'accepted' ? 'Date Request Accepted!' : 'Date Request Declined',
    message: `${(await supabase.from('users').select('full_name').eq('id', user.id).single()).data?.full_name || 'Someone'} ${response === 'accepted' ? 'accepted' : 'declined'} your date request.`,
    data: { date_request_id: requestId },
  });

  return data;
}

export async function updateDateRequest(
  requestId: string,
  updates: Partial<{
    title: string;
    description: string;
    locationName: string;
    locationLatitude: number;
    locationLongitude: number;
    proposedDate: string;
    proposedTime: string;
    durationMinutes: number;
    suggestedActivities: string[];
    dressCode: string;
    budgetRange: string;
    expenseHandling: string;
    numberOfPeople: number;
    genderPreference: string;
    specialRequests: string;
  }>
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: request } = await supabase
    .from('dating_date_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (!request || request.initiator_id !== user.id) {
    throw new Error('Date request not found or unauthorized');
  }

  if (request.status !== 'pending') {
    throw new Error('Can only update pending date requests');
  }

  const { data, error } = await supabase
    .from('dating_date_requests')
    .update(updates)
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function cancelDateRequest(requestId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: request } = await supabase
    .from('dating_date_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (!request || request.initiator_id !== user.id) {
    throw new Error('Date request not found or unauthorized');
  }

  if (request.status !== 'pending') {
    throw new Error('Can only cancel pending date requests');
  }

  const { error } = await supabase
    .from('dating_date_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId);

  if (error) throw error;
  return { success: true };
}

