import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const cancelDateRequestProcedure = protectedProcedure
  .input(
    z.object({
      dateRequestId: z.string().uuid(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;

    // Get date request
    const { data: dateRequest, error: fetchError } = await supabase
      .from('dating_date_requests')
      .select('*')
      .eq('id', input.dateRequestId)
      .single();

    if (fetchError || !dateRequest) {
      throw new Error('Date request not found');
    }

    // Verify user is the sender
    if (dateRequest.from_user_id !== userId) {
      throw new Error('You can only cancel date requests you sent');
    }

    // Only allow canceling if status is pending
    if (dateRequest.status !== 'pending') {
      throw new Error('You can only cancel pending date requests');
    }

    // Update status to cancelled
    const { error } = await supabase
      .from('dating_date_requests')
      .update({ status: 'cancelled' })
      .eq('id', input.dateRequestId);

    if (error) {
      console.error('Error cancelling date request:', error);
      throw new Error('Failed to cancel date request');
    }

    // Create notification for the recipient
    await supabase.from('notifications').insert({
      user_id: dateRequest.to_user_id,
      type: 'dating_date_declined', // Reuse declined type for cancelled
      title: 'Date Request Cancelled',
      message: `${ctx.user.fullName || 'Someone'} cancelled the date request.`,
      data: { date_request_id: input.dateRequestId, match_id: dateRequest.match_id },
      read: false,
    });

    return { success: true };
  });

