import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getCoupleLevelProcedure = protectedProcedure
  .input(
    z.object({
      relationshipId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const { relationshipId } = input;

    const { data: relationship } = await supabase
      .from('relationships')
      .select('*')
      .eq('id', relationshipId)
      .single();

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    const { count: milestoneCount } = await supabase
      .from('relationship_milestones')
      .select('*', { count: 'exact', head: true })
      .eq('relationship_id', relationshipId);

    const { count: achievementCount } = await supabase
      .from('couple_achievements')
      .select('*', { count: 'exact', head: true })
      .eq('relationship_id', relationshipId);

    const daysTogether = Math.floor(
      (Date.now() - new Date(relationship.start_date).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const points =
      (milestoneCount || 0) * 10 +
      (achievementCount || 0) * 20 +
      Math.floor(daysTogether / 30) * 5;

    let level = 1;
    let levelName = 'New Couple';

    if (points >= 1000) {
      level = 10;
      levelName = 'Legendary';
    } else if (points >= 750) {
      level = 9;
      levelName = 'Inseparable';
    } else if (points >= 500) {
      level = 8;
      levelName = 'Soulmates';
    } else if (points >= 350) {
      level = 7;
      levelName = 'Power Couple';
    } else if (points >= 250) {
      level = 6;
      levelName = 'Devoted';
    } else if (points >= 150) {
      level = 5;
      levelName = 'Committed';
    } else if (points >= 100) {
      level = 4;
      levelName = 'Serious';
    } else if (points >= 50) {
      level = 3;
      levelName = 'Growing';
    } else if (points >= 20) {
      level = 2;
      levelName = 'Starting';
    }

    return {
      level,
      levelName,
      points,
      nextLevelPoints: level * 50,
      daysTogether,
      milestoneCount: milestoneCount || 0,
      achievementCount: achievementCount || 0,
    };
  });
