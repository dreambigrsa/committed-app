import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const updateDateRequestProcedure = protectedProcedure
  .input(
    z.object({
      dateRequestId: z.string().uuid(),
      dateTitle: z.string().min(1).max(100).optional(),
      dateDescription: z.string().optional(),
      dateLocation: z.string().min(1).optional(),
      dateLocationLatitude: z.number().optional(),
      dateLocationLongitude: z.number().optional(),
      dateTime: z.string().datetime().optional(),
      dateDurationHours: z.number().min(1).max(24).optional(),
      suggestedActivities: z.array(z.string()).optional(),
      dressCode: z.enum(['casual', 'smart_casual', 'formal', 'beach', 'outdoor']).optional(),
      budgetRange: z.enum(['low', 'medium', 'high']).optional(),
      expenseHandling: z.enum(['split', 'initiator_pays', 'acceptor_pays']).optional(),
      numberOfPeople: z.number().min(2).max(20).optional(),
      genderPreference: z.enum(['men', 'women', 'everyone']).optional(),
      specialRequests: z.string().optional(),
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

    // Verify user is the sender and status is pending
    if (dateRequest.from_user_id !== userId) {
      throw new Error('You can only edit date requests you sent');
    }

    if (dateRequest.status !== 'pending') {
      throw new Error('You can only edit pending date requests');
    }

    // Build update object
    const updateData: any = {};
    if (input.dateTitle !== undefined) updateData.date_title = input.dateTitle;
    if (input.dateDescription !== undefined) updateData.date_description = input.dateDescription;
    if (input.dateLocation !== undefined) updateData.date_location = input.dateLocation;
    if (input.dateLocationLatitude !== undefined) updateData.date_location_latitude = input.dateLocationLatitude;
    if (input.dateLocationLongitude !== undefined) updateData.date_location_longitude = input.dateLocationLongitude;
    if (input.dateTime !== undefined) updateData.date_time = input.dateTime;
    if (input.dateDurationHours !== undefined) updateData.date_duration_hours = input.dateDurationHours;
    if (input.suggestedActivities !== undefined) updateData.suggested_activities = input.suggestedActivities;
    if (input.dressCode !== undefined) updateData.dress_code = input.dressCode;
    if (input.budgetRange !== undefined) updateData.budget_range = input.budgetRange;
    if (input.expenseHandling !== undefined) updateData.expense_handling = input.expenseHandling;
    if (input.numberOfPeople !== undefined) updateData.number_of_people = input.numberOfPeople;
    if (input.genderPreference !== undefined) updateData.gender_preference = input.genderPreference;
    if (input.specialRequests !== undefined) updateData.special_requests = input.specialRequests;

    // Update date request
    const { data: updatedRequest, error } = await supabase
      .from('dating_date_requests')
      .update(updateData)
      .eq('id', input.dateRequestId)
      .select(`
        *,
        from_user:users!dating_date_requests_from_user_id_fkey(id, full_name, profile_picture),
        to_user:users!dating_date_requests_to_user_id_fkey(id, full_name, profile_picture),
        match:dating_matches(id, user1_id, user2_id, matched_at)
      `)
      .single();

    if (error) {
      console.error('Error updating date request:', error);
      throw new Error('Failed to update date request');
    }

    return updatedRequest;
  });

