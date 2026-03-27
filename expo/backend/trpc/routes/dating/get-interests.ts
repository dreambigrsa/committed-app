import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getDatingInterestsProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);

    // Get all active interests, grouped by category
    const { data: interests, error } = await supabase
      .from('dating_interests')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error getting interests:', error);
      throw new Error('Failed to get interests');
    }

    // Group by category
    const grouped: Record<string, any[]> = {};
    (interests || []).forEach((interest) => {
      const category = interest.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(interest);
    });

    return {
      all: interests || [],
      grouped,
      categories: Object.keys(grouped),
    };
  });

