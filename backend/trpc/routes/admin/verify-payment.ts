import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getPaymentSubmissionsProcedure = protectedProcedure
  .input(
    z.object({
      status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('all'),
    })
  )
  .query(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;

    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      throw new Error('Unauthorized: Admin access required');
    }

    // Build query
    let query = supabase
      .from('payment_submissions')
      .select(`
        *,
        user:users!payment_submissions_user_id_fkey(id, full_name, email, profile_picture),
        subscription_plan:subscription_plans(id, name, price, duration_months),
        payment_method:payment_methods(id, name, icon_emoji, payment_type)
      `)
      .order('created_at', { ascending: false });

    // Filter by status if not 'all'
    if (input.status !== 'all') {
      query = query.eq('status', input.status);
    }

    const { data: submissions, error } = await query;

    if (error) {
      console.error('Error getting payment submissions:', error);
      throw new Error('Failed to get payment submissions');
    }

    return submissions || [];
  });

export const verifyPaymentProcedure = protectedProcedure
  .input(
    z.object({
      paymentSubmissionId: z.string().uuid(),
      status: z.enum(['approved', 'rejected']),
      rejectionReason: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;

    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      throw new Error('Unauthorized: Admin access required');
    }

    // Get payment submission
    const { data: submission, error: fetchError } = await supabase
      .from('payment_submissions')
      .select('*')
      .eq('id', input.paymentSubmissionId)
      .single();

    if (fetchError || !submission) {
      throw new Error('Payment submission not found');
    }

    // Only allow verifying pending submissions
    if (submission.status !== 'pending') {
      throw new Error('Payment submission has already been processed');
    }

    // Update payment submission
    const updateData: any = {
      status: input.status,
      verified_by: userId,
      verified_at: new Date().toISOString(),
    };

    if (input.status === 'rejected' && input.rejectionReason) {
      updateData.rejection_reason = input.rejectionReason;
    }

    const { data: updatedSubmission, error } = await supabase
      .from('payment_submissions')
      .update(updateData)
      .eq('id', input.paymentSubmissionId)
      .select(`
        *,
        user:users!payment_submissions_user_id_fkey(id, full_name, email),
        subscription_plan:subscription_plans(id, name, price),
        payment_method:payment_methods(id, name, icon_emoji)
      `)
      .single();

    if (error) {
      console.error('Error verifying payment:', error);
      throw new Error('Failed to verify payment');
    }

    // Create notification for the user
    await supabase.from('notifications').insert({
      user_id: submission.user_id,
      type: input.status === 'approved' ? 'payment_approved' : 'payment_rejected',
      title: input.status === 'approved' ? 'Payment Approved!' : 'Payment Rejected',
      message: input.status === 'approved'
        ? 'Your payment has been verified and your subscription is now active!'
        : `Your payment was rejected. ${input.rejectionReason || 'Please contact support for more information.'}`,
      data: { payment_submission_id: input.paymentSubmissionId },
      read: false,
    });

    return updatedSubmission;
  });

