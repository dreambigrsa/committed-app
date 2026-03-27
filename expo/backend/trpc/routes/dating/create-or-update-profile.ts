import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const createOrUpdateDatingProfileProcedure = protectedProcedure
  .input(
    z.object({
      bio: z.string().optional(),
      age: z.number().min(18).max(120).optional(),
      dateOfBirth: z.string().optional(),
      locationCity: z.string().optional(),
      locationCountry: z.string().optional(),
      locationLatitude: z.number().optional(),
      locationLongitude: z.number().optional(),
      relationshipGoals: z.array(z.string()).default([]),
      interests: z.array(z.string()).default([]),
      lookingFor: z.enum(['men', 'women', 'everyone']).optional(),
      ageRangeMin: z.number().min(18).max(99).optional(),
      ageRangeMax: z.number().min(18).max(99).optional(),
      maxDistanceKm: z.number().min(1).max(1000).optional(),
      isActive: z.boolean().optional(),
      showMe: z.boolean().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('dating_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    const profileData: any = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    if (input.bio !== undefined) profileData.bio = input.bio;
    if (input.age !== undefined) profileData.age = input.age;
    if (input.dateOfBirth) profileData.date_of_birth = input.dateOfBirth;
    if (input.locationCity !== undefined) profileData.location_city = input.locationCity;
    if (input.locationCountry !== undefined) profileData.location_country = input.locationCountry;
    if (input.locationLatitude !== undefined) profileData.location_latitude = input.locationLatitude;
    if (input.locationLongitude !== undefined) profileData.location_longitude = input.locationLongitude;
    if (input.locationLatitude !== undefined || input.locationLongitude !== undefined) {
      profileData.location_updated_at = new Date().toISOString();
    }
    if (input.relationshipGoals !== undefined) profileData.relationship_goals = input.relationshipGoals;
    if (input.interests !== undefined) profileData.interests = input.interests;
    if (input.lookingFor !== undefined) profileData.looking_for = input.lookingFor;
    if (input.ageRangeMin !== undefined) profileData.age_range_min = input.ageRangeMin;
    if (input.ageRangeMax !== undefined) profileData.age_range_max = input.ageRangeMax;
    if (input.maxDistanceKm !== undefined) profileData.max_distance_km = input.maxDistanceKm;
    if (input.isActive !== undefined) profileData.is_active = input.isActive;
    if (input.showMe !== undefined) profileData.show_me = input.showMe;

    let result;
    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabase
        .from('dating_profiles')
        .update(profileData)
        .eq('id', existingProfile.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new profile
      profileData.is_active = input.isActive ?? true;
      profileData.show_me = input.showMe ?? true;
      profileData.last_active_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('dating_profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return result;
  });

