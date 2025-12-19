/**
 * Professional Sessions Service
 * Manages professional session creation, handoffs, and status
 */

import { supabase } from './supabase';
import { ProfessionalSession } from '@/types';

export interface CreateSessionParams {
  conversationId: string;
  userId: string;
  professionalId: string;
  roleId: string;
  aiSummary?: string;
  userConsentGiven: boolean;
}

/**
 * Create a new professional session
 */
export async function createProfessionalSession(
  params: CreateSessionParams
): Promise<ProfessionalSession | null> {
  try {
    const { data, error } = await supabase
      .from('professional_sessions')
      .insert({
        conversation_id: params.conversationId,
        user_id: params.userId,
        professional_id: params.professionalId,
        role_id: params.roleId,
        ai_summary: params.aiSummary,
        user_consent_given: params.userConsentGiven,
        consent_given_at: params.userConsentGiven ? new Date().toISOString() : null,
        status: 'pending_acceptance',
        session_type: 'live_chat',
      })
      .select()
      .single();

    if (error) throw error;
    return mapSession(data);
  } catch (error: any) {
    console.error('Error creating professional session:', error);
    return null;
  }
}

/**
 * Get active session for a conversation
 */
export async function getActiveSession(
  conversationId: string
): Promise<ProfessionalSession | null> {
  try {
    const { data, error } = await supabase
      .from('professional_sessions')
      .select('*')
      .eq('conversation_id', conversationId)
      .in('status', ['pending_acceptance', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? mapSession(data) : null;
  } catch (error: any) {
    console.error('Error getting active session:', error);
    return null;
  }
}

/**
 * Professional accepts a session request
 */
export async function acceptProfessionalSession(
  sessionId: string,
  professionalId: string
): Promise<boolean> {
  try {
    // Verify the professional owns this session
    const { data: session } = await supabase
      .from('professional_sessions')
      .select('professional_id, status')
      .eq('id', sessionId)
      .single();

    if (!session || session.professional_id !== professionalId) {
      throw new Error('Unauthorized');
    }

    if (session.status !== 'pending_acceptance') {
      throw new Error('Session already processed');
    }

    // Update session to active
    const { error: updateError } = await supabase
      .from('professional_sessions')
      .update({
        status: 'active',
        professional_joined_at: new Date().toISOString(),
        ai_observer_mode: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    // Update professional status session count
    const { data: profile } = await supabase
      .from('professional_profiles')
      .select('id')
      .eq('id', professionalId)
      .single();

    if (profile) {
      // Increment session count
      await supabase.rpc('increment_professional_session_count', {
        prof_id: professionalId,
      });
    }

    return true;
  } catch (error: any) {
    console.error('Error accepting session:', error);
    return false;
  }
}

/**
 * Professional declines a session request
 */
export async function declineProfessionalSession(
  sessionId: string,
  professionalId: string
): Promise<boolean> {
  try {
    // Verify the professional owns this session
    const { data: session } = await supabase
      .from('professional_sessions')
      .select('professional_id, status')
      .eq('id', sessionId)
      .single();

    if (!session || session.professional_id !== professionalId) {
      throw new Error('Unauthorized');
    }

    if (session.status !== 'pending_acceptance') {
      throw new Error('Session already processed');
    }

    // Update session to declined
    const { error } = await supabase
      .from('professional_sessions')
      .update({
        status: 'declined',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error('Error declining session:', error);
    return false;
  }
}

/**
 * End a professional session
 */
export async function endProfessionalSession(
  sessionId: string,
  endedBy: 'user' | 'professional' | 'system' | 'admin',
  reason?: string
): Promise<boolean> {
  try {
    const { data: session } = await supabase
      .from('professional_sessions')
      .select('professional_id, status')
      .eq('id', sessionId)
      .single();

    if (!session || session.status !== 'active') {
      return false;
    }

    // Update session to ended
    const { error } = await supabase
      .from('professional_sessions')
      .update({
        status: 'ended',
        professional_ended_at: new Date().toISOString(),
        ended_by: endedBy,
        ended_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;

    // Decrement professional session count
    if (session.professional_id) {
      await supabase.rpc('decrement_professional_session_count', {
        prof_id: session.professional_id,
      });
    }

    return true;
  } catch (error: any) {
    console.error('Error ending session:', error);
    return false;
  }
}

/**
 * Get pending session requests for a professional
 */
export async function getPendingSessionRequests(
  professionalId: string
): Promise<ProfessionalSession[]> {
  try {
    const { data, error } = await supabase
      .from('professional_sessions')
      .select(`
        *,
        user:users!professional_sessions_user_id_fkey(id, full_name, profile_picture),
        role:professional_roles(*),
        conversation:conversations(*)
      `)
      .eq('professional_id', professionalId)
      .eq('status', 'pending_acceptance')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapSession);
  } catch (error: any) {
    console.error('Error getting pending sessions:', error);
    return [];
  }
}

/**
 * Map database session to TypeScript type
 */
function mapSession(session: any): ProfessionalSession {
  const mapped: ProfessionalSession = {
    id: session.id,
    conversationId: session.conversation_id,
    userId: session.user_id,
    professionalId: session.professional_id,
    roleId: session.role_id,
    sessionType: session.session_type,
    status: session.status,
    aiSummary: session.ai_summary,
    userConsentGiven: session.user_consent_given || false,
    consentGivenAt: session.consent_given_at,
    professionalJoinedAt: session.professional_joined_at,
    professionalEndedAt: session.professional_ended_at,
    escalationLevel: session.escalation_level || 0,
    escalationReason: session.escalation_reason,
    aiObserverMode: session.ai_observer_mode || false,
    endedBy: session.ended_by,
    endedReason: session.ended_reason,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };

  // Map joined user data if present
  if (session.user) {
    mapped.user = {
      id: session.user.id,
      fullName: session.user.full_name,
      profilePicture: session.user.profile_picture,
    } as any; // Partial User type
  }

  // Map joined role data if present
  if (session.role) {
    mapped.role = {
      id: session.role.id,
      name: session.role.name,
      category: session.role.category,
    } as any; // Partial ProfessionalRole type
  }

  return mapped;
}

