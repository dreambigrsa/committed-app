import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const submitPaymentProcedure = protectedProcedure
  .input(
    z.object({
      subscriptionPlanId: z.string().uuid(),
      paymentMethodId: z.string().uuid(),
      amount: z.number().positive(),
      currency: z.string().default('USD'),
      paymentProofUrl: z.string().url().optional(),
      transactionReference: z.string().optional(),
      paymentDate: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;

    // Verify subscription plan exists
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, price')
      .eq('id', input.subscriptionPlanId)
      .single();

    if (planError || !plan) {
      throw new Error('Subscription plan not found');
    }

    // Verify payment method exists and is active
    const { data: paymentMethod, error: methodError } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('id', input.paymentMethodId)
      .eq('is_active', true)
      .single();

    if (methodError || !paymentMethod) {
      throw new Error('Payment method not found or inactive');
    }

    // Create payment submission
    const { data: submission, error } = await supabase
      .from('payment_submissions')
      .insert({
        user_id: userId,
        subscription_plan_id: input.subscriptionPlanId,
        payment_method_id: input.paymentMethodId,
        amount: input.amount,
        currency: input.currency,
        payment_proof_url: input.paymentProofUrl,
        transaction_reference: input.transactionReference,
        payment_date: input.paymentDate ? new Date(input.paymentDate).toISOString().split('T')[0] : null,
        notes: input.notes,
        status: 'pending',
      })
      .select(`
        *,
        subscription_plan:subscription_plans(id, name, price),
        payment_method:payment_methods(id, name, icon_emoji)
      `)
      .single();

    if (error) {
      console.error('Error submitting payment:', error);
      throw new Error('Failed to submit payment');
    }

    // Create notification for admins
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .in('role', ['admin', 'super_admin']);

    if (admins && admins.length > 0) {
      const notifications = admins.map((admin) => ({
        user_id: admin.id,
        type: 'payment_submission',
        title: 'New Payment Submission',
        message: `${ctx.user.fullName || 'A user'} submitted a payment for verification`,
        data: { payment_submission_id: submission.id, user_id: userId },
        read: false,
      }));

      await supabase.from('notifications').insert(notifications);
    }

    return submission;
  });

