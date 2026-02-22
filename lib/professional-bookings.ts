/**
 * Professional Bookings Service
 * Handles booking management for offline/in-person sessions
 */

import { supabase } from './supabase';
import { ProfessionalSession } from '@/types';

export interface CreateBookingRequest {
  conversationId: string;
  userId: string;
  professionalId: string;
  roleId: string;
  scheduledDate: string; // ISO date string
  scheduledDurationMinutes: number;
  locationType: 'online' | 'in_person' | 'phone' | 'video';
  locationAddress?: string;
  locationNotes?: string;
  bookingNotes?: string;
}

export interface RescheduleBookingRequest {
  sessionId: string;
  newScheduledDate: string;
  reason?: string;
  requestedBy: 'user' | 'professional';
}

export interface CancelBookingRequest {
  sessionId: string;
  reason?: string;
  requestedBy: 'user' | 'professional';
}

/**
 * Create a new booking for an offline/in-person session
 */
export async function createProfessionalBooking(
  request: CreateBookingRequest
): Promise<{ session: ProfessionalSession | null; error?: string }> {
  try {
    // Get professional pricing info
    const { data: profile, error: profileError } = await supabase
      .from('professional_profiles')
      .select('pricing_info')
      .eq('id', request.professionalId)
      .single();

    if (profileError) throw profileError;

    const pricingInfo = profile?.pricing_info;
    let bookingFeeAmount: number | null = null;
    let bookingFeeCurrency: string | null = null;

    if (pricingInfo && pricingInfo.rate) {
      bookingFeeAmount = pricingInfo.rate;
      bookingFeeCurrency = pricingInfo.currency || 'USD';
    }

    const { data, error } = await supabase
      .from('professional_sessions')
      .insert({
        conversation_id: request.conversationId,
        user_id: request.userId,
        professional_id: request.professionalId,
        role_id: request.roleId,
        session_type: 'offline_booking',
        status: 'scheduled',
        scheduled_date: request.scheduledDate,
        scheduled_duration_minutes: request.scheduledDurationMinutes,
        location_type: request.locationType,
        location_address: request.locationAddress || null,
        location_notes: request.locationNotes || null,
        booking_fee_amount: bookingFeeAmount,
        booking_fee_currency: bookingFeeCurrency,
        payment_status: bookingFeeAmount ? 'pending' : null,
        booking_notes: request.bookingNotes || null,
      })
      .select(`
        *,
        professional:professional_profiles!professional_sessions_professional_id_fkey(
          id,
          full_name,
          role:professional_roles(id, name, category)
        ),
        user:users!professional_sessions_user_id_fkey(id, full_name, profile_picture),
        role:professional_roles(*)
      `)
      .single();

    if (error) throw error;

    const session: ProfessionalSession = {
      id: data.id,
      conversationId: data.conversation_id,
      userId: data.user_id,
      professionalId: data.professional_id,
      roleId: data.role_id,
      sessionType: data.session_type,
      status: data.status,
      userConsentGiven: data.user_consent_given || false,
      escalationLevel: data.escalation_level || 0,
      aiObserverMode: data.ai_observer_mode || false,
      scheduledDate: data.scheduled_date,
      scheduledDurationMinutes: data.scheduled_duration_minutes,
      locationType: data.location_type,
      locationAddress: data.location_address,
      locationNotes: data.location_notes,
      bookingFeeAmount: data.booking_fee_amount ? parseFloat(data.booking_fee_amount) : undefined,
      bookingFeeCurrency: data.booking_fee_currency,
      paymentStatus: data.payment_status,
      bookingNotes: data.booking_notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      professional: data.professional ? {
        id: data.professional.id,
        fullName: data.professional.full_name,
        role: data.professional.role,
      } as any : undefined,
      user: data.user as any,
      role: data.role as any,
    };

    return { session };
  } catch (error: any) {
    console.error('Error creating booking:', error);
    return { session: null, error: error.message || 'Failed to create booking' };
  }
}

/**
 * Get user's bookings
 */
export async function getUserBookings(userId: string): Promise<ProfessionalSession[]> {
  try {
    const { data, error } = await supabase
      .from('professional_sessions')
      .select(`
        *,
        professional:professional_profiles!professional_sessions_professional_id_fkey(
          id,
          full_name,
          profile_picture:users!professional_profiles_user_id_fkey(profile_picture),
          role:professional_roles(id, name, category)
        ),
        role:professional_roles(*)
      `)
      .eq('user_id', userId)
      .in('session_type', ['offline_booking', 'scheduled'])
      .order('scheduled_date', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapBooking);
  } catch (error: any) {
    console.error('Error getting user bookings:', error);
    return [];
  }
}

/**
 * Get professional's bookings
 */
export async function getProfessionalBookings(professionalId: string): Promise<ProfessionalSession[]> {
  try {
    const { data, error } = await supabase
      .from('professional_sessions')
      .select(`
        *,
        user:users!professional_sessions_user_id_fkey(id, full_name, profile_picture),
        role:professional_roles(*)
      `)
      .eq('professional_id', professionalId)
      .in('session_type', ['offline_booking', 'scheduled'])
      .order('scheduled_date', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapBooking);
  } catch (error: any) {
    console.error('Error getting professional bookings:', error);
    return [];
  }
}

/**
 * Reschedule a booking
 */
export async function rescheduleBooking(
  request: RescheduleBookingRequest
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get original session
    const { error: fetchError } = await supabase
      .from('professional_sessions')
      .select('*')
      .eq('id', request.sessionId)
      .single();

    if (fetchError) throw fetchError;

    // Create new session with rescheduled date
    const { error: updateError } = await supabase
      .from('professional_sessions')
      .update({
        scheduled_date: request.newScheduledDate,
        reschedule_reason: request.reason || null,
        reschedule_requested_by: request.requestedBy,
        reschedule_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.sessionId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error: any) {
    console.error('Error rescheduling booking:', error);
    return { success: false, error: error.message || 'Failed to reschedule booking' };
  }
}

/**
 * Cancel a booking
 */
export async function cancelBooking(
  request: CancelBookingRequest
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('professional_sessions')
      .update({
        status: 'cancelled',
        cancellation_reason: request.reason || null,
        cancellation_requested_by: request.requestedBy,
        cancellation_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.sessionId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error cancelling booking:', error);
    return { success: false, error: error.message || 'Failed to cancel booking' };
  }
}

/**
 * Confirm a booking (professional accepts)
 */
export async function confirmBooking(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('professional_sessions')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error confirming booking:', error);
    return { success: false, error: error.message || 'Failed to confirm booking' };
  }
}

/**
 * Mark booking as completed
 */
export async function completeBooking(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('professional_sessions')
      .update({
        status: 'completed',
        professional_ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error completing booking:', error);
    return { success: false, error: error.message || 'Failed to complete booking' };
  }
}

/**
 * Map database booking to TypeScript type
 */
function mapBooking(session: any): ProfessionalSession {
  return {
    id: session.id,
    conversationId: session.conversation_id,
    userId: session.user_id,
    professionalId: session.professional_id,
    roleId: session.role_id,
    sessionType: session.session_type,
    status: session.status,
    userConsentGiven: session.user_consent_given || false,
    escalationLevel: session.escalation_level || 0,
    aiObserverMode: session.ai_observer_mode || false,
    scheduledDate: session.scheduled_date,
    scheduledDurationMinutes: session.scheduled_duration_minutes,
    locationType: session.location_type,
    locationAddress: session.location_address,
    locationNotes: session.location_notes,
    bookingFeeAmount: session.booking_fee_amount ? parseFloat(session.booking_fee_amount) : undefined,
    bookingFeeCurrency: session.booking_fee_currency,
    paymentStatus: session.payment_status,
    rescheduledFromSessionId: session.rescheduled_from_session_id,
    rescheduleReason: session.reschedule_reason,
    rescheduleRequestedBy: session.reschedule_requested_by,
    rescheduleRequestedAt: session.reschedule_requested_at,
    cancellationReason: session.cancellation_reason,
    cancellationRequestedBy: session.cancellation_requested_by,
    cancellationRequestedAt: session.cancellation_requested_at,
    bookingNotes: session.booking_notes,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    professional: session.professional ? {
      id: session.professional.id,
      fullName: session.professional.full_name,
      profilePicture: session.professional.profile_picture,
      role: session.professional.role,
    } as any : undefined,
    user: session.user as any,
    role: session.role as any,
  };
}

