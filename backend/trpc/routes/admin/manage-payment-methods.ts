import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getPaymentMethodsAdminProcedure = protectedProcedure
  .query(async ({ ctx }) => {
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

    // Get all payment methods (including inactive)
    const { data: paymentMethods, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error getting payment methods:', error);
      throw new Error('Failed to get payment methods');
    }

    return paymentMethods || [];
  });

export const createPaymentMethodProcedure = protectedProcedure
  .input(
    z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      paymentType: z.enum(['bank_transfer', 'mobile_money', 'cash', 'crypto', 'other']),
      accountDetails: z.record(z.string(), z.any()).optional(),
      instructions: z.string().optional(),
      displayOrder: z.number().default(0),
      iconEmoji: z.string().optional(),
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

    const { data: paymentMethod, error } = await supabase
      .from('payment_methods')
      .insert({
        name: input.name,
        description: input.description,
        payment_type: input.paymentType,
        account_details: input.accountDetails || {},
        instructions: input.instructions,
        display_order: input.displayOrder,
        icon_emoji: input.iconEmoji,
        is_active: true,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payment method:', error);
      throw new Error('Failed to create payment method');
    }

    return paymentMethod;
  });

export const updatePaymentMethodProcedure = protectedProcedure
  .input(
    z.object({
      paymentMethodId: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      accountDetails: z.record(z.string(), z.any()).optional(),
      instructions: z.string().optional(),
      displayOrder: z.number().optional(),
      iconEmoji: z.string().optional(),
      isActive: z.boolean().optional(),
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

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.accountDetails !== undefined) updateData.account_details = input.accountDetails;
    if (input.instructions !== undefined) updateData.instructions = input.instructions;
    if (input.displayOrder !== undefined) updateData.display_order = input.displayOrder;
    if (input.iconEmoji !== undefined) updateData.icon_emoji = input.iconEmoji;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;

    const { data: paymentMethod, error } = await supabase
      .from('payment_methods')
      .update(updateData)
      .eq('id', input.paymentMethodId)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment method:', error);
      throw new Error('Failed to update payment method');
    }

    return paymentMethod;
  });

export const deletePaymentMethodProcedure = protectedProcedure
  .input(
    z.object({
      paymentMethodId: z.string().uuid(),
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

    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', input.paymentMethodId);

    if (error) {
      console.error('Error deleting payment method:', error);
      throw new Error('Failed to delete payment method');
    }

    return { success: true };
  });

