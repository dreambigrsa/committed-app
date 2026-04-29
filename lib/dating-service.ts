import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

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
      .select('id, full_name, profile_picture, id_verified, email_verified, phone_verified')
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
  gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
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
  prompts?: { question: string; answer: string }[];
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
  religion?: string;
  education?: string;
  height_cm?: number;
  exercise?: 'often' | 'sometimes' | 'rarely' | 'prefer_not_to_say';
  pets?: 'have_pets' | 'want_pets' | 'no_pets' | 'prefer_not_to_say';
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Check if profile exists and get current values
  const { data: existing } = await supabase
    .from('dating_profiles')
    .select('id, gender, looking_for')
    .eq('user_id', user.id)
    .single();

  // Determine the final gender and looking_for values
  const finalGender = profileData.gender !== undefined ? profileData.gender : existing?.gender;
  const providedLookingFor = profileData.looking_for;
  
  // Set default looking_for based on gender if not provided
  let finalLookingFor = providedLookingFor;
  if (finalLookingFor === undefined) {
    // If updating and looking_for is not provided, check existing value
    if (existing?.looking_for) {
      finalLookingFor = existing.looking_for;
    } else if (finalGender === 'male') {
      // Male users see women by default
      finalLookingFor = 'women';
    } else if (finalGender === 'female') {
      // Female users see men by default
      finalLookingFor = 'men';
    } else {
      // Non-binary or prefer_not_to_say defaults to everyone
      finalLookingFor = 'everyone';
    }
  }

  if (existing) {
    // Update existing profile
    // Filter out undefined values but keep null/empty string for explicit clearing
    const updateData: any = {};
    Object.keys(profileData).forEach((key) => {
      const value = (profileData as any)[key];
      // Include the field if it's not undefined (allow null, empty string, etc.)
      if (value !== undefined) {
        updateData[key] = value;
      }
    });
    
    // Add default looking_for if gender is set but looking_for is not
    if (finalGender && !providedLookingFor && !existing.looking_for) {
      updateData.looking_for = finalLookingFor;
    }
    
    const { data, error } = await supabase
      .from('dating_profiles')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // Create new profile
    const insertData: any = {
      user_id: user.id,
      ...profileData,
      is_active: profileData.is_active ?? true,
    };
    
    // Set default looking_for if gender is set but looking_for is not provided
    if (finalGender && !providedLookingFor) {
      insertData.looking_for = finalLookingFor;
    }
    
    const { data, error } = await supabase
      .from('dating_profiles')
      .insert(insertData)
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

const DATING_DISCOVERY_FILTERS_KEY = 'committed:dating-discovery-filters:v1';

export type DatingDiscoveryFilters = {
  minAge?: number;
  maxAge?: number;
  maxDistance?: number;
  lookingFor?: 'men' | 'women' | 'everyone';
  locationCity?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  includePassed?: boolean;
  intentionTags?: string[];
  religions?: string[];
  educationLevels?: string[];
  kids?: string[];
  smoke?: string[];
  drink?: string[];
  exercise?: string[];
  pets?: string[];
  interests?: string[];
  minHeightCm?: number;
  maxHeightCm?: number;
  hasPhotos?: boolean;
  verifiedOnly?: boolean;
  activeRecently?: boolean;
};

export async function getSavedDatingDiscoveryFilters(): Promise<DatingDiscoveryFilters> {
  try {
    const rawFilters = await AsyncStorage.getItem(DATING_DISCOVERY_FILTERS_KEY);
    return rawFilters ? JSON.parse(rawFilters) : {};
  } catch (error) {
    console.warn('Failed to load dating discovery filters:', error);
    return {};
  }
}

export async function saveDatingDiscoveryFilters(filters: DatingDiscoveryFilters) {
  await AsyncStorage.setItem(DATING_DISCOVERY_FILTERS_KEY, JSON.stringify(filters));
}

export async function clearDatingDiscoveryFilters() {
  await AsyncStorage.removeItem(DATING_DISCOVERY_FILTERS_KEY);
}

export async function getDatingDiscovery(filters?: DatingDiscoveryFilters) {
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

  const savedFilters = filters ?? await getSavedDatingDiscoveryFilters();

  // Build query - start simple without relationships to avoid 400 errors
  let query = supabase
    .from('dating_profiles')
    .select('*')
    .eq('is_active', true)
    .neq('user_id', user.id)
    .eq('admin_limited', false) // Exclude admin-limited profiles
    .eq('admin_suspended', false) // Exclude admin-suspended profiles
    .limit(50);

  // Apply filters - use provided filters or fall back to saved profile preferences
  const minAge = savedFilters.minAge ?? userProfile.age_range_min ?? 18;
  const maxAge = savedFilters.maxAge ?? userProfile.age_range_max ?? 99;
  const maxDistance = savedFilters.maxDistance ?? userProfile.max_distance_km ?? 50;
  const locationCity = savedFilters.locationCity ?? userProfile.location_city;
  const locationCountry = savedFilters.locationCountry ?? userProfile.location_country;
  const userLatitude = savedFilters.latitude ?? userProfile.location_latitude;
  const userLongitude = savedFilters.longitude ?? userProfile.location_longitude;
  const lookingFor = savedFilters.lookingFor ?? userProfile.looking_for ?? 'everyone';
  
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

  if (savedFilters.intentionTags?.length) {
    query = query.in('intention_tag', savedFilters.intentionTags);
  }
  if (savedFilters.religions?.length) {
    query = query.in('religion', savedFilters.religions);
  }
  if (savedFilters.educationLevels?.length) {
    query = query.in('education', savedFilters.educationLevels);
  }
  if (savedFilters.kids?.length) {
    query = query.in('kids', savedFilters.kids);
  }
  if (savedFilters.smoke?.length) {
    query = query.in('smoke', savedFilters.smoke);
  }
  if (savedFilters.drink?.length) {
    query = query.in('drink', savedFilters.drink);
  }
  if (savedFilters.exercise?.length) {
    query = query.in('exercise', savedFilters.exercise);
  }
  if (savedFilters.pets?.length) {
    query = query.in('pets', savedFilters.pets);
  }
  if (savedFilters.minHeightCm) {
    query = query.gte('height_cm', savedFilters.minHeightCm);
  }
  if (savedFilters.maxHeightCm) {
    query = query.lte('height_cm', savedFilters.maxHeightCm);
  }
  if (savedFilters.activeRecently) {
    query = query.gte('last_active_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
  }
  if (savedFilters.interests?.length) {
    query = query.overlaps('interests', savedFilters.interests);
  }
  
  // Note: Distance filtering by coordinates will be done after fetching
  // since Supabase doesn't have built-in distance calculation without PostGIS
  
  // Note: Gender filtering requires a gender field in dating_profiles table
  // For now, we filter based on mutual compatibility:
  // User A sees User B if User A's looking_for matches User B's gender
  // AND User B's looking_for includes User A's gender (or is 'everyone')
  // Since we don't have a gender field yet, we'll filter after fetching
  // and match based on the looking_for preferences

  const [likedResult, passedResult] = await Promise.all([
    supabase
      .from('dating_likes')
      .select('liked_id')
      .eq('liker_id', user.id),
    savedFilters.includePassed
      ? Promise.resolve({ data: [] as any[] })
      : supabase
          .from('dating_passes')
          .select('passed_id')
          .eq('passer_id', user.id),
  ]);

  const excludedIds = Array.from(new Set([
    ...(likedResult.data?.map((l: any) => l.liked_id) || []),
    ...(passedResult.data?.map((p: any) => p.passed_id) || []),
  ]));

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

  // Helper function to calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Filter by distance if coordinates are available
  let filteredProfiles = profiles;
  if (userLatitude && userLongitude && maxDistance) {
    filteredProfiles = filteredProfiles.filter((profile: any) => {
      // If profile doesn't have coordinates, include it (can't filter by distance)
      if (!profile.location_latitude || !profile.location_longitude) {
        return true;
      }
      
      const distance = calculateDistance(
        userLatitude,
        userLongitude,
        profile.location_latitude,
        profile.location_longitude
      );
      
      return distance <= maxDistance;
    });
  }

  // Filter by gender preference (mutual compatibility)
  // User A sees User B if:
  // 1. User A's looking_for preference matches User B's gender
  // 2. User B's looking_for preference includes User A's gender (or is 'everyone')
  if (lookingFor !== 'everyone') {
    // Get current user's gender from their profile
    const currentUserGender = userProfile.gender;
    
    console.log(`[Dating Discovery] Filtering by gender: lookingFor=${lookingFor}, currentUserGender=${currentUserGender}`);
    
    filteredProfiles = filteredProfiles.filter((profile: any) => {
      const profileGender = profile.gender;
      const profileLookingFor = profile.looking_for || 'everyone';
      
      // STRICT: Don't show profiles without gender when filtering by gender
      // This ensures users only see profiles that match their preference
      if (!profileGender || profileGender === 'prefer_not_to_say') {
        return false; // Don't show profiles without gender when filtering
      }
      
      // If current user wants to see 'men', show profiles where:
      // - profile's gender is 'male' (matches "men")
      // - AND profile's looking_for includes current user's gender (or is 'everyone')
      if (lookingFor === 'men') {
        // Profile must be male - STRICT CHECK
        if (profileGender !== 'male') {
          console.log(`[Dating Discovery] Filtered out profile ${profile.user_id}: gender=${profileGender} (expected male)`);
          return false; // Don't show women or non-binary when looking for men
        }
        
        // Check mutual compatibility: Does this profile want to see the current user?
        if (profileLookingFor === 'everyone') return true;
        
        // If current user hasn't set gender, show anyway (can't check mutual compatibility)
        if (!currentUserGender || currentUserGender === 'prefer_not_to_say') return true;
        
        // Profile wants 'men' - show if current user is male or non-binary
        if (profileLookingFor === 'men' && (currentUserGender === 'male' || currentUserGender === 'non_binary')) return true;
        
        // Profile wants 'women' - show if current user is female or non-binary (mutual interest)
        if (profileLookingFor === 'women' && (currentUserGender === 'female' || currentUserGender === 'non_binary')) return true;
        
        console.log(`[Dating Discovery] Filtered out profile ${profile.user_id}: no mutual compatibility (profile wants ${profileLookingFor}, user is ${currentUserGender})`);
        return false;
      }
      
      // If current user wants to see 'women', show profiles where:
      // - profile's gender is 'female' (matches "women")
      // - AND profile's looking_for includes current user's gender (or is 'everyone')
      if (lookingFor === 'women') {
        // Profile must be female - STRICT CHECK
        if (profileGender !== 'female') {
          console.log(`[Dating Discovery] Filtered out profile ${profile.user_id}: gender=${profileGender} (expected female)`);
          return false; // Don't show men or non-binary when looking for women
        }
        
        // Check mutual compatibility: Does this profile want to see the current user?
        if (profileLookingFor === 'everyone') return true;
        
        // If current user hasn't set gender, show anyway (can't check mutual compatibility)
        if (!currentUserGender || currentUserGender === 'prefer_not_to_say') return true;
        
        // Profile wants 'women' - show if current user is female or non-binary
        if (profileLookingFor === 'women' && (currentUserGender === 'female' || currentUserGender === 'non_binary')) return true;
        
        // Profile wants 'men' - show if current user is male or non-binary (mutual interest)
        if (profileLookingFor === 'men' && (currentUserGender === 'male' || currentUserGender === 'non_binary')) return true;
        
        console.log(`[Dating Discovery] Filtered out profile ${profile.user_id}: no mutual compatibility (profile wants ${profileLookingFor}, user is ${currentUserGender})`);
        return false;
      }
      
      return true;
    });
  }

  const profileIds = filteredProfiles.map((profile: any) => profile.id);
  const userIds = filteredProfiles.map((profile: any) => profile.user_id);
  const [photosResult, videosResult, usersResult] = await Promise.all([
    profileIds.length > 0
      ? supabase
          .from('dating_photos')
          .select('*')
          .in('dating_profile_id', profileIds)
          .order('display_order', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    profileIds.length > 0
      ? supabase
          .from('dating_videos')
          .select('*')
          .in('dating_profile_id', profileIds)
          .order('display_order', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    userIds.length > 0
      ? supabase
          .from('users')
          .select('id, full_name, profile_picture, id_verified, email_verified, phone_verified')
          .in('id', userIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const photosByProfile = new Map<string, any[]>();
  (photosResult.data || []).forEach((photo: any) => {
    const list = photosByProfile.get(photo.dating_profile_id) || [];
    list.push(photo);
    photosByProfile.set(photo.dating_profile_id, list);
  });

  const videosByProfile = new Map<string, any[]>();
  (videosResult.data || []).forEach((video: any) => {
    const list = videosByProfile.get(video.dating_profile_id) || [];
    list.push(video);
    videosByProfile.set(video.dating_profile_id, list);
  });

  const usersById = new Map((usersResult.data || []).map((u: any) => [u.id, u]));

  let profilesWithRelations = filteredProfiles.map((profile: any) => ({
    ...profile,
    photos: photosByProfile.get(profile.id) || [],
    videos: videosByProfile.get(profile.id) || [],
    user: usersById.get(profile.user_id) || null,
  }));

  if (savedFilters.hasPhotos) {
    profilesWithRelations = profilesWithRelations.filter((profile: any) => profile.photos.length > 0);
  }
  if (savedFilters.verifiedOnly) {
    profilesWithRelations = profilesWithRelations.filter((profile: any) => {
      const profileUser = profile.user;
      return !!(profileUser?.id_verified || profileUser?.phone_verified || profileUser?.email_verified);
    });
  }

  return { profiles: profilesWithRelations.slice(0, 20), hasMore: profiles.length >= 50 };
}

export async function likeUser(likedUserId: string, isSuperLike: boolean = false) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Check if already liked
  const { data: existing } = await supabase
    .from('dating_likes')
    .select('id, is_super_like')
    .eq('liker_id', user.id)
    .eq('liked_id', likedUserId)
    .maybeSingle();

  if (existing) {
    // If already liked, update to super like if needed
    if (isSuperLike && !existing.is_super_like) {
      const { data: updated, error: updateError } = await supabase
        .from('dating_likes')
        .update({ is_super_like: true })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      await removePass(user.id, likedUserId);
      const isMatch = await ensureMatchIfMutual(user.id, likedUserId);
      return { isMatch, like: updated };
    }
    await removePass(user.id, likedUserId);
    const isMatch = await ensureMatchIfMutual(user.id, likedUserId);
    return { isMatch, like: existing };
  }

  // Use upsert to handle race conditions gracefully
  // If duplicate key error occurs, it will update instead of failing
  const { data: like, error } = await supabase
    .from('dating_likes')
    .upsert({
      liker_id: user.id,
      liked_id: likedUserId,
      is_super_like: isSuperLike,
    }, {
      onConflict: 'liker_id,liked_id',
    })
    .select()
    .single();

  if (error) {
    // If it's a duplicate key error, try to fetch the existing like
    if (error.code === '23505' || error.message?.includes('unique_like') || error.message?.includes('duplicate key')) {
      const { data: existingLike } = await supabase
        .from('dating_likes')
        .select('id, is_super_like')
        .eq('liker_id', user.id)
        .eq('liked_id', likedUserId)
        .single();
      
      if (existingLike) {
        await removePass(user.id, likedUserId);
        const isMatch = await ensureMatchIfMutual(user.id, likedUserId);
        return { isMatch, like: existingLike };
      }
    }
    throw error;
  }

  await removePass(user.id, likedUserId);
  const isMatch = await ensureMatchIfMutual(user.id, likedUserId);
  if (!isMatch) {
    void createDatingLikeNotification(user.id, likedUserId, isSuperLike);
  }

  return { isMatch, like };
}

export async function getDatingReactionState(targetUserId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { liked: false, superLiked: false, matched: false };

  const { data: like } = await supabase
    .from('dating_likes')
    .select('id, is_super_like')
    .eq('liker_id', user.id)
    .eq('liked_id', targetUserId)
    .maybeSingle();

  const user1Id = user.id < targetUserId ? user.id : targetUserId;
  const user2Id = user.id > targetUserId ? user.id : targetUserId;
  const { data: match } = await supabase
    .from('dating_matches')
    .select('id')
    .eq('user1_id', user1Id)
    .eq('user2_id', user2Id)
    .maybeSingle();

  return {
    liked: !!like,
    superLiked: !!like?.is_super_like,
    matched: !!match,
  };
}

async function removePass(userId: string, targetUserId: string) {
  await supabase
    .from('dating_passes')
    .delete()
    .eq('passer_id', userId)
    .eq('passed_id', targetUserId);
}

async function ensureMatchIfMutual(userId: string, likedUserId: string): Promise<boolean> {
  const { data: mutualLike } = await supabase
    .from('dating_likes')
    .select('id')
    .eq('liker_id', likedUserId)
    .eq('liked_id', userId)
    .maybeSingle();

  if (!mutualLike) return false;

  const user1Id = userId < likedUserId ? userId : likedUserId;
  const user2Id = userId > likedUserId ? userId : likedUserId;
  const { data: existingMatch } = await supabase
    .from('dating_matches')
    .select('id')
    .eq('user1_id', user1Id)
    .eq('user2_id', user2Id)
    .maybeSingle();

  if (existingMatch) return true;

  const { data: match, error: matchError } = await supabase
    .from('dating_matches')
    .insert({
      user1_id: user1Id,
      user2_id: user2Id,
    })
    .select('id')
    .single();

  if (!matchError) {
    void createDatingMatchNotifications(userId, likedUserId, match.id);
    return true;
  }

  if (matchError.code === '23505' || matchError.message?.includes('duplicate')) {
    return true;
  }

  throw matchError;
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
    .maybeSingle();

  if (existing) {
    return { success: true };
  }

  const { error } = await supabase
    .from('dating_passes')
    .upsert({
      passer_id: user.id,
      passed_id: passedUserId,
    }, {
      onConflict: 'passer_id,passed_id',
    });

  if (error) throw error;
  return { success: true };
}

async function createDatingMatchNotifications(userId: string, likedUserId: string, matchId: string) {
  try {
    const [likedUserResult, currentUserResult] = await Promise.all([
      supabase.from('users').select('full_name').eq('id', likedUserId).single(),
      supabase.from('users').select('full_name').eq('id', userId).single(),
    ]);

    await supabase.from('notifications').insert([
      {
        user_id: userId,
        type: 'dating_match',
        title: "It's a Match!",
        message: `You and ${likedUserResult.data?.full_name || 'someone'} liked each other!`,
        data: { match_id: matchId, matched_user_id: likedUserId },
      },
      {
        user_id: likedUserId,
        type: 'dating_match',
        title: "It's a Match!",
        message: `You and ${currentUserResult.data?.full_name || 'someone'} liked each other!`,
        data: { match_id: matchId, matched_user_id: userId },
      },
    ]);
  } catch (error) {
    console.warn('[Dating] Failed to create match notifications:', error);
  }
}

async function createDatingLikeNotification(userId: string, likedUserId: string, isSuperLike: boolean) {
  try {
    const { data: liker } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();

    await supabase.from('notifications').insert({
      user_id: likedUserId,
      type: isSuperLike ? 'dating_super_like' : 'dating_like',
      title: isSuperLike ? 'Super Like!' : 'New Like',
      message: `${liker?.full_name || 'Someone'} ${isSuperLike ? 'super liked' : 'liked'} you!`,
      data: { liker_id: userId },
    });
  } catch (error) {
    console.warn('[Dating] Failed to create like notification:', error);
  }
}

/**
 * Clear all passed profiles to see them again in discovery
 */
export async function clearPassedProfiles() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('dating_passes')
    .delete()
    .eq('passer_id', user.id);

  if (error) throw error;
  return { success: true };
}

// ============================================
// MATCHES
// ============================================

export async function getDatingMatches() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Query matches where user is either user1 or user2
  // Split into two queries to avoid ambiguous column reference
  const [user1Matches, user2Matches] = await Promise.all([
    supabase
      .from('dating_matches')
      .select(`
        *,
        user1:users!dating_matches_user1_id_fkey(
          id,
          full_name,
          profile_picture,
          id_verified,
          phone_verified,
          email_verified
        ),
        user2:users!dating_matches_user2_id_fkey(
          id,
          full_name,
          profile_picture,
          id_verified,
          phone_verified,
          email_verified
        )
      `)
      .eq('user1_id', user.id)
      .order('matched_at', { ascending: false }),
    supabase
      .from('dating_matches')
      .select(`
        *,
        user1:users!dating_matches_user1_id_fkey(
          id,
          full_name,
          profile_picture,
          id_verified,
          phone_verified,
          email_verified
        ),
        user2:users!dating_matches_user2_id_fkey(
          id,
          full_name,
          profile_picture,
          id_verified,
          phone_verified,
          email_verified
        )
      `)
      .eq('user2_id', user.id)
      .order('matched_at', { ascending: false }),
  ]);

  if (user1Matches.error) throw user1Matches.error;
  if (user2Matches.error) throw user2Matches.error;

  // Combine and deduplicate results
  const allMatches = [...(user1Matches.data || []), ...(user2Matches.data || [])];
  const uniqueMatches = Array.from(
    new Map(allMatches.map(match => [match.id, match])).values()
  );

  const data = uniqueMatches.sort((a, b) => 
    new Date(b.matched_at).getTime() - new Date(a.matched_at).getTime()
  );

  // Format matches to show the other user
  const formattedMatches = data.map(match => ({
    ...match,
    matchedUser: match.user1_id === user.id ? match.user2 : match.user1,
  }));

  const matchedUserIds = formattedMatches
    .map((match: any) => match.matchedUser?.id)
    .filter(Boolean);
  if (matchedUserIds.length === 0) return formattedMatches;

  const { data: matchedProfiles } = await supabase
    .from('dating_profiles')
    .select('id,user_id')
    .in('user_id', matchedUserIds);
  const profileIds = (matchedProfiles || []).map((profile: any) => profile.id);
  const { data: primaryPhotos } = profileIds.length > 0
    ? await supabase
        .from('dating_photos')
        .select('dating_profile_id,photo_url,is_primary,display_order')
        .in('dating_profile_id', profileIds)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })
    : { data: [] as any[] };

  const profileIdByUser = new Map((matchedProfiles || []).map((profile: any) => [profile.user_id, profile.id]));
  const photoByProfile = new Map<string, string>();
  (primaryPhotos || []).forEach((photo: any) => {
    if (!photoByProfile.has(photo.dating_profile_id)) {
      photoByProfile.set(photo.dating_profile_id, photo.photo_url);
    }
  });

  return formattedMatches.map((match: any) => {
    const profileId = profileIdByUser.get(match.matchedUser?.id);
    return {
      ...match,
      primaryPhoto: profileId ? photoByProfile.get(profileId) : undefined,
    };
  });
}

export async function unmatchUser(matchId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Verify match belongs to user - use separate queries to avoid ambiguous column
  const { data: matchAsUser1 } = await supabase
    .from('dating_matches')
    .select('*')
    .eq('id', matchId)
    .eq('user1_id', user.id)
    .single();

  const { data: matchAsUser2 } = await supabase
    .from('dating_matches')
    .select('*')
    .eq('id', matchId)
    .eq('user2_id', user.id)
    .single();

  const match = matchAsUser1 || matchAsUser2;

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
    .in('status', ['active', 'trial'])
    .single();

  const isPremium = !!subscription;

  // Get likes count and basic info even for non-premium users
  const { data, error } = await supabase
    .from('dating_likes')
    .select(`
      *,
      liker:users!dating_likes_liker_id_fkey(
        id,
        full_name,
        profile_picture,
        id_verified,
        phone_verified,
        email_verified
      )
    `)
    .eq('liked_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  // If premium, return full data
  if (isPremium) {
    return hydrateLikesWithPrimaryPhotos(data || []);
  }

  // For non-premium users, return blurred/anonymized data
  const hydratedLikes = await hydrateLikesWithPrimaryPhotos(data || []);
  return hydratedLikes.map((like) => ({
    ...like,
    isBlurred: true,
    liker: {
      id: like.liker?.id || '',
      full_name: like.liker?.full_name ? 'Someone' : 'Someone',
      profile_picture: like.liker?.profile_picture || null,
      id_verified: false,
      phone_verified: false,
      email_verified: false,
    },
  }));
}

async function hydrateLikesWithPrimaryPhotos(likes: any[]) {
  const likerIds = likes.map((like) => like.liker?.id).filter(Boolean);
  if (likerIds.length === 0) return likes;

  const { data: profiles } = await supabase
    .from('dating_profiles')
    .select('id,user_id')
    .in('user_id', likerIds);
  const profileIds = (profiles || []).map((profile: any) => profile.id);
  const { data: photos } = profileIds.length > 0
    ? await supabase
        .from('dating_photos')
        .select('dating_profile_id,photo_url,is_primary,display_order')
        .in('dating_profile_id', profileIds)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })
    : { data: [] as any[] };

  const profileIdByUser = new Map((profiles || []).map((profile: any) => [profile.user_id, profile.id]));
  const photoByProfile = new Map<string, string>();
  (photos || []).forEach((photo: any) => {
    if (!photoByProfile.has(photo.dating_profile_id)) {
      photoByProfile.set(photo.dating_profile_id, photo.photo_url);
    }
  });

  return likes.map((like) => {
    const profileId = profileIdByUser.get(like.liker?.id);
    return {
      ...like,
      primaryPhoto: profileId ? photoByProfile.get(profileId) : like.primaryPhoto,
    };
  });
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
      from_user:users!dating_date_requests_from_user_id_fkey(
        id,
        full_name,
        profile_picture,
        id_verified,
        phone_verified,
        email_verified
      ),
      to_user:users!dating_date_requests_to_user_id_fkey(
        id,
        full_name,
        profile_picture,
        id_verified,
        phone_verified,
        email_verified
      )
    `)
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) {
    // Extract proper error message from Supabase error
    const errorMessage = error.message || error.details || error.hint || 'Failed to load date requests';
    throw new Error(errorMessage);
  }
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

  // Get match_id for the recipient
  // Match exists if (user1_id = user.id AND user2_id = recipientId) OR (user1_id = recipientId AND user2_id = user.id)
  const { data: match } = await supabase
    .from('dating_matches')
    .select('id')
    .or(`and(user1_id.eq.${user.id},user2_id.eq.${requestData.recipientId}),and(user1_id.eq.${requestData.recipientId},user2_id.eq.${user.id})`)
    .single();

  if (!match) {
    throw new Error('Match not found. You can only send date requests to your matches.');
  }

  // Combine date and time
  const dateTime = new Date(`${requestData.proposedDate}T${requestData.proposedTime}`);

  const { data, error } = await supabase
    .from('dating_date_requests')
    .insert({
      match_id: match.id,
      from_user_id: user.id,
      to_user_id: requestData.recipientId,
      date_title: requestData.title,
      date_description: requestData.description,
      date_location: requestData.locationName,
      date_location_latitude: requestData.locationLatitude,
      date_location_longitude: requestData.locationLongitude,
      date_time: dateTime.toISOString(),
      date_duration_hours: requestData.durationMinutes ? Math.ceil(requestData.durationMinutes / 60) : 2,
      suggested_activities: requestData.suggestedActivities,
      dress_code: requestData.dressCode,
      budget_range: requestData.budgetRange,
      expense_handling: (requestData.expenseHandling && ['split', 'initiator_pays', 'acceptor_pays'].includes(requestData.expenseHandling)) 
        ? requestData.expenseHandling 
        : 'split', // Ensure valid value
      number_of_people: requestData.numberOfPeople || 2,
      gender_preference: requestData.genderPreference || 'everyone',
      special_requests: requestData.specialRequests,
      status: 'pending',
    })
    .select(`
      *,
      to_user:users!dating_date_requests_to_user_id_fkey(
        id,
        full_name,
        profile_picture
      )
    `)
    .single();

  if (error) {
    const errorMessage = error.message || error.details || error.hint || 'Failed to create date request';
    throw new Error(errorMessage);
  }

  // Create notification
  await supabase.from('notifications').insert({
    user_id: requestData.recipientId,
    type: 'dating_date_request',
    title: 'New Date Request',
    message: `${(await supabase.from('users').select('full_name').eq('id', user.id).single()).data?.full_name || 'Someone'} sent you a date request!`,
    data: { date_request_id: data.id, from_user_id: user.id },
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

  if (!request || request.to_user_id !== user.id) {
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
    user_id: request.from_user_id,
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

  if (!request || request.from_user_id !== user.id) {
    throw new Error('Date request not found or unauthorized');
  }

  if (request.status !== 'pending') {
    throw new Error('Can only update pending date requests');
  }

  // Map field names from API to database columns
  const dbUpdates: any = {};
  if (updates.title !== undefined) dbUpdates.date_title = updates.title;
  if (updates.description !== undefined) dbUpdates.date_description = updates.description;
  if (updates.locationName !== undefined) dbUpdates.date_location = updates.locationName;
  if (updates.locationLatitude !== undefined) dbUpdates.date_location_latitude = updates.locationLatitude;
  if (updates.locationLongitude !== undefined) dbUpdates.date_location_longitude = updates.locationLongitude;
  if (updates.proposedDate !== undefined && updates.proposedTime !== undefined) {
    const dateTime = new Date(`${updates.proposedDate}T${updates.proposedTime}`);
    dbUpdates.date_time = dateTime.toISOString();
  }
  if (updates.durationMinutes !== undefined) dbUpdates.date_duration_hours = Math.ceil(updates.durationMinutes / 60);
  if (updates.suggestedActivities !== undefined) dbUpdates.suggested_activities = updates.suggestedActivities;
  if (updates.dressCode !== undefined) dbUpdates.dress_code = updates.dressCode;
  if (updates.budgetRange !== undefined) dbUpdates.budget_range = updates.budgetRange;
  if (updates.expenseHandling !== undefined) {
    // Ensure valid value for expense_handling
    if (['split', 'initiator_pays', 'acceptor_pays'].includes(updates.expenseHandling)) {
      dbUpdates.expense_handling = updates.expenseHandling;
    } else {
      dbUpdates.expense_handling = 'split'; // Default to split if invalid
    }
  }
  if (updates.numberOfPeople !== undefined) dbUpdates.number_of_people = updates.numberOfPeople;
  if (updates.genderPreference !== undefined) dbUpdates.gender_preference = updates.genderPreference;
  if (updates.specialRequests !== undefined) dbUpdates.special_requests = updates.specialRequests;

  const { data, error } = await supabase
    .from('dating_date_requests')
    .update(dbUpdates)
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    const errorMessage = error.message || error.details || error.hint || 'Failed to update date request';
    throw new Error(errorMessage);
  }
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

  if (!request || request.from_user_id !== user.id) {
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

