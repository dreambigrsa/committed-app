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

  // First try a simple query without relationships
  const { data, error } = await supabase
    .from('dating_profiles')
    .select('*')
    .eq('user_id', targetUserId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found - this is okay, return null
      console.log('getDatingProfile: Profile not found for user', targetUserId);
      return null;
    }
    console.error('getDatingProfile error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    // Don't throw, return null so UI can show create screen
    return null;
  }

  if (!data) {
    console.log('getDatingProfile: No data returned');
    return null;
  }

  // Now fetch related data separately
  const [photosResult, videosResult, userResult] = await Promise.all([
    supabase
      .from('dating_photos')
      .select('*')
      .eq('dating_profile_id', data.id)
      .order('display_order', { ascending: true }),
    supabase
      .from('dating_videos')
      .select('*')
      .eq('dating_profile_id', data.id)
      .order('display_order', { ascending: true }),
    supabase
      .from('users')
      .select('id, full_name, profile_picture, verified, email_verified, phone_verified, id_verified')
      .eq('id', targetUserId)
      .single(),
  ]);

  // Combine all data
  const profileWithRelations = {
    ...data,
    photos: photosResult.data || [],
    videos: videosResult.data || [],
    user: userResult.data || null,
  };
  
  console.log('getDatingProfile: Found profile', profileWithRelations.id);
  return profileWithRelations;
}

export async function createOrUpdateDatingProfile(profileData: {
  bio?: string;
  age?: number;
  location_city?: string;
  location_country?: string;
  location_latitude?: number;
  location_longitude?: number;
  relationship_goals?: string[];
  interests?: string[];
  looking_for?: 'men' | 'women' | 'everyone';
  age_range_min?: number;
  age_range_max?: number;
  max_distance_km?: number;
  is_active?: boolean;
  what_im_looking_for?: string;
  bio_video_url?: string;
  kids?: 'have_kids' | 'want_kids' | 'dont_want_kids' | 'have_and_want_more' | 'not_sure';
  work?: string;
  smoke?: 'yes' | 'no' | 'sometimes' | 'prefer_not_to_say';
  drink?: 'yes' | 'no' | 'sometimes' | 'prefer_not_to_say';
  prompts?: Array<{ question: string; answer: string }>;
  headline?: string;
  intro_voice_url?: string;
  values?: string[];
  mood?: 'chill' | 'romantic' | 'fun' | 'serious' | 'adventurous';
  what_makes_me_different?: string;
  weekend_style?: 'homebody' | 'out_with_friends' | 'church_faith' | 'side_hustling' | 'exploring';
  conversation_starters?: string[];
  daily_question_answer?: string;
  daily_question_id?: string;
  intention_tag?: 'friendship' | 'dating' | 'serious' | 'marriage';
  respect_first_badge?: boolean;
  local_food?: string;
  local_slang?: string;
  local_spot?: string;
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

  // First, get the photo and verify it belongs to user's profile
  const { data: photo, error: fetchError } = await supabase
    .from('dating_photos')
    .select('id, photo_url, dating_profile_id, dating_profiles!inner(user_id)')
    .eq('id', photoId)
    .single();

  if (fetchError || !photo) {
    throw new Error('Photo not found or you do not have permission to delete it');
  }

  // Delete the photo record
  const { error: deleteError } = await supabase
    .from('dating_photos')
    .delete()
    .eq('id', photoId);

  if (deleteError) {
    console.error('Delete photo error:', deleteError);
    throw new Error(deleteError.message || 'Failed to delete photo');
  }

  // Try to delete from storage if it's a Supabase storage URL
  if (photo.photo_url && photo.photo_url.includes('supabase.co/storage')) {
    try {
      // Extract path from URL
      const urlParts = photo.photo_url.split('/storage/v1/object/public/');
      if (urlParts.length === 2) {
        const pathParts = urlParts[1].split('/');
        const bucket = pathParts[0];
        const filePath = pathParts.slice(1).join('/');
        
        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove([filePath]);
        
        if (storageError) {
          console.warn('Failed to delete from storage:', storageError);
          // Don't throw - photo record is already deleted
        }
      }
    } catch (storageErr) {
      console.warn('Error deleting from storage:', storageErr);
      // Don't throw - photo record is already deleted
    }
  }

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
  locationCity?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
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

  // Build query - start simple without relationships to avoid 400 errors
  let query = supabase
    .from('dating_profiles')
    .select('*')
    .eq('is_active', true)
    .neq('user_id', user.id)
    .limit(20);

  // Apply filters - use provided filters or fall back to saved profile preferences
  const minAge = filters?.minAge ?? userProfile.age_range_min ?? 18;
  const maxAge = filters?.maxAge ?? userProfile.age_range_max ?? 99;
  const maxDistance = filters?.maxDistance ?? userProfile.max_distance_km ?? 50;
  const locationCity = filters?.locationCity ?? userProfile.location_city;
  const locationCountry = filters?.locationCountry ?? userProfile.location_country;
  const userLatitude = filters?.latitude ?? userProfile.location_latitude;
  const userLongitude = filters?.longitude ?? userProfile.location_longitude;
  
  // Apply age filters
  if (minAge) {
    query = query.gte('age', minAge);
  }
  if (maxAge) {
    query = query.lte('age', maxAge);
  }
  
  // Apply location filters (city and country)
  if (locationCity) {
    query = query.ilike('location_city', `%${locationCity}%`);
  }
  if (locationCountry) {
    query = query.ilike('location_country', `%${locationCountry}%`);
  }
  
  // Note: Distance filtering by coordinates would require PostGIS or manual calculation
  // For now, we filter by city/country which is stored in the profile

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
    ...(liked?.map((l: any) => l.liked_id) || []),
    ...(passed?.map((p: any) => p.passed_id) || []),
  ];

  if (excludedIds.length > 0) {
    query = query.not('user_id', 'in', `(${excludedIds.join(',')})`);
  }

  const { data: profiles, error } = await query;

  if (error) {
    console.error('getDatingDiscovery query error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }

  if (!profiles || profiles.length === 0) {
    return { profiles: [], hasMore: false };
  }

  // Now fetch related data for each profile separately to avoid 400 errors
  const profilesWithRelations = await Promise.all(
    profiles.map(async (profile: any) => {
      const [photosResult, videosResult, userResult] = await Promise.all([
        supabase
          .from('dating_photos')
          .select('*')
          .eq('dating_profile_id', profile.id)
          .order('display_order', { ascending: true }),
        supabase
          .from('dating_videos')
          .select('*')
          .eq('dating_profile_id', profile.id)
          .order('display_order', { ascending: true }),
        supabase
          .from('users')
          .select('id, full_name, profile_picture, verified, email_verified, phone_verified, id_verified')
          .eq('id', profile.user_id)
          .single(),
      ]);

      return {
        ...profile,
        photos: photosResult.data || [],
        videos: videosResult.data || [],
        user: userResult.data || null,
      };
    })
  );

  return { profiles: profilesWithRelations, hasMore: profiles.length >= 20 };
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

// ============================================
// SUBSCRIPTION HELPERS
// ============================================

export async function checkPremiumSubscription(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Check for active subscription or trial
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'trial'])
    .single();

  if (!subscription) return false;

  // If it's a trial, check if it hasn't expired
  if (subscription.status === 'trial' && subscription.expires_at) {
    const expiresAt = new Date(subscription.expires_at);
    if (expiresAt < new Date()) {
      return false; // Trial expired
    }
  }

  // Also check dating profile for trial info
  const { data: profile } = await supabase
    .from('dating_profiles')
    .select('premium_trial_ends_at')
    .eq('user_id', user.id)
    .single();

  if (profile?.premium_trial_ends_at) {
    const trialEndsAt = new Date(profile.premium_trial_ends_at);
    if (trialEndsAt >= new Date()) {
      return true; // Trial still active
    }
  }

  return !!subscription;
}

export async function getSubscriptionInfo() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get subscription (active or trial)
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .eq('user_id', user.id)
    .in('status', ['active', 'trial'])
    .single();

  // Also get trial info from dating profile
  const { data: profile } = await supabase
    .from('dating_profiles')
    .select('premium_trial_ends_at, premium_trial_granted_at, premium_trial_granted_by')
    .eq('user_id', user.id)
    .single();

  if (subscription) {
    return {
      ...subscription,
      is_trial: subscription.status === 'trial',
      trial_ends_at: subscription.expires_at || profile?.premium_trial_ends_at,
      trial_granted_at: profile?.premium_trial_granted_at,
    };
  }

  // If no subscription but has trial info in profile
  if (profile?.premium_trial_ends_at) {
    const trialEndsAt = new Date(profile.premium_trial_ends_at);
    if (trialEndsAt >= new Date()) {
      return {
        status: 'trial',
        is_trial: true,
        trial_ends_at: profile.premium_trial_ends_at,
        trial_granted_at: profile.premium_trial_granted_at,
      };
    }
  }

  return null;
}

// ============================================
// PROFILE DELETION
// ============================================

export async function deleteDatingProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get profile to delete photos/videos
  const { data: profile } = await supabase
    .from('dating_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    throw new Error('Profile not found');
  }

  // Delete all photos
  const { data: photos } = await supabase
    .from('dating_photos')
    .select('photo_url')
    .eq('dating_profile_id', profile.id);

  if (photos && photos.length > 0) {
    // Delete photos from storage
    for (const photo of photos) {
      if (photo.photo_url && photo.photo_url.includes('supabase.co/storage')) {
        try {
          const urlParts = photo.photo_url.split('/storage/v1/object/public/');
          if (urlParts.length === 2) {
            const pathParts = urlParts[1].split('/');
            const bucket = pathParts[0];
            const filePath = pathParts.slice(1).join('/');
            await supabase.storage.from(bucket).remove([filePath]);
          }
        } catch (e) {
          console.warn('Error deleting photo from storage:', e);
        }
      }
    }
  }

  // Delete all videos
  const { data: videos } = await supabase
    .from('dating_videos')
    .select('video_url, thumbnail_url')
    .eq('dating_profile_id', profile.id);

  if (videos && videos.length > 0) {
    // Delete videos from storage
    for (const video of videos) {
      if (video.video_url && video.video_url.includes('supabase.co/storage')) {
        try {
          const urlParts = video.video_url.split('/storage/v1/object/public/');
          if (urlParts.length === 2) {
            const pathParts = urlParts[1].split('/');
            const bucket = pathParts[0];
            const filePath = pathParts.slice(1).join('/');
            await supabase.storage.from(bucket).remove([filePath]);
          }
        } catch (e) {
          console.warn('Error deleting video from storage:', e);
        }
      }
      if (video.thumbnail_url && video.thumbnail_url.includes('supabase.co/storage')) {
        try {
          const urlParts = video.thumbnail_url.split('/storage/v1/object/public/');
          if (urlParts.length === 2) {
            const pathParts = urlParts[1].split('/');
            const bucket = pathParts[0];
            const filePath = pathParts.slice(1).join('/');
            await supabase.storage.from(bucket).remove([filePath]);
          }
        } catch (e) {
          console.warn('Error deleting thumbnail from storage:', e);
        }
      }
    }
  }

  // Delete the profile (cascade will handle related records)
  const { error } = await supabase
    .from('dating_profiles')
    .delete()
    .eq('user_id', user.id);

  if (error) throw error;
  return { success: true };
}

