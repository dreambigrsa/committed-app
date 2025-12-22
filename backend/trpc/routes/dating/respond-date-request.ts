import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const respondDateRequestProcedure = protectedProcedure
  .input(
    z.object({
      dateRequestId: z.string().uuid(),
      response: z.enum(['accepted', 'declined']),
      responseMessage: z.string().optional(),
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

    // Verify user is the recipient
    if (dateRequest.to_user_id !== userId) {
      throw new Error('You are not authorized to respond to this date request');
    }

    // Verify status is pending
    if (dateRequest.status !== 'pending') {
      throw new Error('Date request has already been responded to');
    }

    // Update date request
    const { data: updatedRequest, error } = await supabase
      .from('dating_date_requests')
      .update({
        status: input.response,
        response_message: input.responseMessage,
        responded_at: new Date().toISOString(),
      })
      .eq('id', input.dateRequestId)
      .select(`
        *,
        from_user:users!dating_date_requests_from_user_id_fkey(id, full_name, profile_picture),
        to_user:users!dating_date_requests_to_user_id_fkey(id, full_name, profile_picture)
      `)
      .single();

    if (error) {
      console.error('Error responding to date request:', error);
      throw new Error('Failed to respond to date request');
    }

    // Create notification for the sender
    await supabase.from('notifications').insert({
      user_id: dateRequest.from_user_id,
      type: input.response === 'accepted' ? 'dating_date_accepted' : 'dating_date_declined',
      title: input.response === 'accepted' ? 'Date Request Accepted!' : 'Date Request Declined',
      message: input.response === 'accepted'
        ? `${ctx.user.fullName || 'Someone'} accepted your date request!`
        : `${ctx.user.fullName || 'Someone'} declined your date request.`,
      data: { date_request_id: input.dateRequestId, match_id: dateRequest.match_id },
      read: false,
    });

    return updatedRequest;
  });

