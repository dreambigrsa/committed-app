import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const detectDuplicateRelationshipsProcedure = protectedProcedure
  .input(
    z.object({
      userId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const { userId } = input;

    const { data: relationships } = await supabase
      .from('relationships')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'verified']);

    if (!relationships || relationships.length <= 1) {
      return {
        hasDuplicates: false,
        relationships: [],
      };
    }

    return {
      hasDuplicates: true,
      relationships,
    };
  });

export const checkCheatingPatternProcedure = protectedProcedure
  .input(
    z.object({
      userId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const { userId } = input;

    const { data: activeRelationships } = await supabase
      .from('relationships')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'verified']);

    const { data: cheatingAlerts } = await supabase
      .from('cheating_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data: endedRelationships } = await supabase
      .from('relationships')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ended')
      .gte(
        'end_date',
        new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
      );

    const suspicionScore =
      (activeRelationships?.length || 0) * 50 +
      (cheatingAlerts?.length || 0) * 30 +
      (endedRelationships?.length || 0) * 10;

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (suspicionScore >= 100) riskLevel = 'high';
    else if (suspicionScore >= 50) riskLevel = 'medium';

    return {
      riskLevel,
      suspicionScore,
      activeRelationshipsCount: activeRelationships?.length || 0,
      cheatingAlertsCount: cheatingAlerts?.length || 0,
      recentEndedRelationshipsCount: endedRelationships?.length || 0,
    };
  });
