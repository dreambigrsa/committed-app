import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getDateOptionsProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);

    // Get all active options, grouped by type
    const { data: options, error } = await supabase
      .from('dating_date_options')
      .select('*')
      .eq('is_active', true)
      .order('option_type', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error getting date options:', error);
      throw new Error('Failed to get date options');
    }

    // Group by option type
    const grouped: Record<string, any[]> = {
      dress_code: [],
      budget_range: [],
      suggested_activity: [],
      expense_handling: [],
    };

    (options || []).forEach((option) => {
      if (grouped[option.option_type]) {
        grouped[option.option_type].push(option);
      }
    });

    return {
      all: options || [],
      grouped,
      dressCodes: grouped.dress_code || [],
      budgetRanges: grouped.budget_range || [],
      suggestedActivities: grouped.suggested_activity || [],
      expenseHandling: grouped.expense_handling || [],
    };
  });

