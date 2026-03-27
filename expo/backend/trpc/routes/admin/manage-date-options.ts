import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getDateOptionsAdminProcedure = protectedProcedure
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

    // Get all options (including inactive)
    const { data: options, error } = await supabase
      .from('dating_date_options')
      .select('*')
      .order('option_type', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error getting date options:', error);
      throw new Error('Failed to get date options');
    }

    // Group by option type
    const grouped: Record<string, any[]> = {};

    (options || []).forEach((option) => {
      if (!grouped[option.option_type]) {
        grouped[option.option_type] = [];
      }
      grouped[option.option_type].push(option);
    });

    return {
      all: options || [],
      grouped,
    };
  });

export const createDateOptionProcedure = protectedProcedure
  .input(
    z.object({
      optionType: z.enum(['dress_code', 'budget_range', 'suggested_activity', 'expense_handling']),
      optionValue: z.string().min(1),
      displayLabel: z.string().min(1),
      displayOrder: z.number().default(0),
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

    const { data: option, error } = await supabase
      .from('dating_date_options')
      .insert({
        option_type: input.optionType,
        option_value: input.optionValue,
        display_label: input.displayLabel,
        display_order: input.displayOrder,
        is_active: true,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating date option:', error);
      throw new Error('Failed to create date option');
    }

    return option;
  });

export const updateDateOptionProcedure = protectedProcedure
  .input(
    z.object({
      optionId: z.string().uuid(),
      displayLabel: z.string().min(1).optional(),
      displayOrder: z.number().optional(),
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
    if (input.displayLabel !== undefined) updateData.display_label = input.displayLabel;
    if (input.displayOrder !== undefined) updateData.display_order = input.displayOrder;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;

    const { data: option, error } = await supabase
      .from('dating_date_options')
      .update(updateData)
      .eq('id', input.optionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating date option:', error);
      throw new Error('Failed to update date option');
    }

    return option;
  });

export const deleteDateOptionProcedure = protectedProcedure
  .input(
    z.object({
      optionId: z.string().uuid(),
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
      .from('dating_date_options')
      .delete()
      .eq('id', input.optionId);

    if (error) {
      console.error('Error deleting date option:', error);
      throw new Error('Failed to delete date option');
    }

    return { success: true };
  });

