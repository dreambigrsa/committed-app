import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getPaymentMethodsProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);

    // Get all active payment methods
    const { data: paymentMethods, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error getting payment methods:', error);
      throw new Error('Failed to get payment methods');
    }

    return paymentMethods || [];
  });

