import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const createDateRequestProcedure = protectedProcedure
  .input(
    z.object({
      matchId: z.string().uuid(),
      dateTitle: z.string().min(1).max(100),
      dateDescription: z.string().optional(),
      dateLocation: z.string().min(1),
      dateLocationLatitude: z.number().optional(),
      dateLocationLongitude: z.number().optional(),
      dateTime: z.string().datetime(),
      dateDurationHours: z.number().min(1).max(24).default(2),
      suggestedActivities: z.array(z.string()).optional(),
      dressCode: z.enum(['casual', 'smart_casual', 'formal', 'beach', 'outdoor']).optional(),
      budgetRange: z.enum(['low', 'medium', 'high']).optional(),
      expenseHandling: z.enum(['split', 'initiator_pays', 'acceptor_pays']).default('split'),
      numberOfPeople: z.number().min(2).max(20).default(2),
      genderPreference: z.enum(['men', 'women', 'everyone']).default('everyone'),
      specialRequests: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;

    // Verify match exists and user is part of it
    const { data: match, error: matchError } = await supabase
      .from('dating_matches')
      .select('user1_id, user2_id')
      .eq('id', input.matchId)
      .single();

    if (matchError || !match) {
      throw new Error('Match not found');
    }

    if (match.user1_id !== userId && match.user2_id !== userId) {
      throw new Error('You are not part of this match');
    }

    const toUserId = match.user1_id === userId ? match.user2_id : match.user1_id;

    // Create date request
    const { data: dateRequest, error } = await supabase
      .from('dating_date_requests')
      .insert({
        match_id: input.matchId,
        from_user_id: userId,
        to_user_id: toUserId,
        date_title: input.dateTitle,
        date_description: input.dateDescription,
        date_location: input.dateLocation,
        date_location_latitude: input.dateLocationLatitude,
        date_location_longitude: input.dateLocationLongitude,
        date_time: input.dateTime,
        date_duration_hours: input.dateDurationHours,
        suggested_activities: input.suggestedActivities,
        dress_code: input.dressCode,
        budget_range: input.budgetRange,
        expense_handling: input.expenseHandling,
        number_of_people: input.numberOfPeople,
        gender_preference: input.genderPreference,
        special_requests: input.specialRequests,
        status: 'pending',
      })
      .select(`
        *,
        from_user:users!dating_date_requests_from_user_id_fkey(id, full_name, profile_picture),
        to_user:users!dating_date_requests_to_user_id_fkey(id, full_name, profile_picture)
      `)
      .single();

    if (error) {
      console.error('Error creating date request:', error);
      throw new Error('Failed to create date request');
    }

    // Create notification for the recipient
    await supabase.from('notifications').insert({
      user_id: toUserId,
      type: 'dating_date_request',
      title: 'New Date Request',
      message: `${ctx.user.fullName || 'Someone'} wants to go on a date with you!`,
      data: { date_request_id: dateRequest.id, match_id: input.matchId },
      read: false,
    });

    return dateRequest;
  });

