import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getDatingProfileProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;

    // Get dating profile
    const { data: profile, error: profileError } = await supabase
      .from('dating_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw new Error('Failed to get dating profile');
    }

    if (!profile) {
      return null;
    }

    // Get photos
    const { data: photos, error: photosError } = await supabase
      .from('dating_photos')
      .select('*')
      .eq('dating_profile_id', profile.id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (photosError) {
      console.error('Error getting photos:', photosError);
    }

    return {
      ...profile,
      photos: photos || [],
    };
  });

