/**
 * Professional Sessions Service
 * Manages professional session creation, handoffs, and status
 */

import { supabase } from './supabase';
import { ProfessionalSession } from '@/types';
import { getOrCreateAIUser } from './ai-service';

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
): Promise<{ session: ProfessionalSession | null; error?: string }> {
  try {
    console.log('[Professional Sessions] Creating session with params:', {
      conversationId: params.conversationId,
      userId: params.userId,
      professionalId: params.professionalId,
      roleId: params.roleId,
      hasAiSummary: !!params.aiSummary,
      userConsentGiven: params.userConsentGiven,
    });

    const { data, error } = await supabase
      .from('professional_sessions')
      .insert({
        conversation_id: params.conversationId,
        user_id: params.userId,
        professional_id: params.professionalId,
        role_id: params.roleId,
        ai_summary: params.aiSummary || null,
        user_consent_given: params.userConsentGiven,
        consent_given_at: params.userConsentGiven ? new Date().toISOString() : null,
        status: 'pending_acceptance',
        session_type: 'live_chat',
      })
      .select()
      .single();

    if (error) {
      console.error('[Professional Sessions] Database error:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No data returned from insert');
    }

    const session = mapSession(data);
    console.log('[Professional Sessions] Session created successfully:', session?.id);
    return { session };
  } catch (error: any) {
    console.error('[Professional Sessions] Error creating professional session:', error);
    const errorMessage = error?.message || error?.code || 'Unknown error occurred';
    console.error('[Professional Sessions] Error details:', {
      message: errorMessage,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    return { session: null, error: errorMessage };
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

    // Get session details with professional and role info for introduction
    const { data: fullSession } = await supabase
      .from('professional_sessions')
      .select(`
        conversation_id,
        user_id,
        professional:professional_profiles(full_name),
        role:professional_roles(name)
      `)
      .eq('id', sessionId)
      .single();

    if (fullSession && fullSession.professional && fullSession.role) {
      // Send AI introduction message
      await sendProfessionalIntroductionMessage(
        fullSession.conversation_id,
        fullSession.user_id,
        (fullSession.professional as any).full_name || 'a professional',
        (fullSession.role as any).name || 'professional'
      );
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
      .select('professional_id, status, conversation_id, user_id, role_id, escalation_level')
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

    // Attempt automatic escalation to next professional
    try {
      const { findMatchingProfessionals } = await import('./professional-matching');
      
      // Find alternative professionals (excluding the one who declined)
      const alternativeMatches = await findMatchingProfessionals({
        roleId: session.role_id,
        excludeProfessionalId: session.professional_id,
        requiresOnlineOnly: true,
      }, 1); // Get just the best match

      if (alternativeMatches.length > 0) {
        const nextProfessional = alternativeMatches[0].profile;
        
        // Create a new session with the next professional
        const escalationResult = await createProfessionalSession({
          conversationId: session.conversation_id,
          userId: session.user_id,
          professionalId: nextProfessional.id,
          roleId: session.role_id,
          aiSummary: undefined, // Could preserve original summary if needed
          userConsentGiven: true, // User already gave consent for original request
        });

        if (escalationResult.session) {
          console.log(`Auto-escalated to next professional: ${nextProfessional.id}`);
          
          // Send notification to user that a new professional has been requested
          const aiUser = await getOrCreateAIUser();
          if (aiUser) {
            try {
              const roleName = alternativeMatches[0].role?.name || 'professional';
              await supabase.rpc('send_ai_message', {
                p_conversation_id: session.conversation_id,
                p_receiver_id: session.user_id,
                p_content: `The previous professional wasn't available, but I've automatically requested help from ${nextProfessional.fullName}, another verified ${roleName}. They'll join shortly if available.`,
                p_message_type: 'text',
                p_media_url: null,
                p_document_url: null,
                p_document_name: null,
                p_sticker_id: null,
                p_status_id: null,
                p_status_preview_url: null,
              });
            } catch (msgError) {
              console.error('Error sending escalation notification:', msgError);
            }
          }
        }
      } else {
        console.log('No alternative professionals available for auto-escalation');
        // Send message to user that no professionals are available
        const aiUser = await getOrCreateAIUser();
        if (aiUser) {
          try {
            await supabase.rpc('send_ai_message', {
              p_conversation_id: session.conversation_id,
              p_receiver_id: session.user_id,
              p_content: 'I\'m sorry, but no other professionals are currently available. Please try again later, or I can help you in the meantime.',
              p_message_type: 'text',
              p_media_url: null,
              p_document_url: null,
              p_document_name: null,
              p_sticker_id: null,
              p_status_id: null,
              p_status_preview_url: null,
            });
          } catch (msgError) {
            console.error('Error sending no-professional message:', msgError);
          }
        }
      }
    } catch (escalationError) {
      console.error('Error attempting automatic escalation after decline:', escalationError);
      // Don't fail the decline if escalation fails
    }

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
      description: session.role.description,
      requiresCredentials: session.role.requires_credentials ?? true,
      requiresVerification: session.role.requires_verification ?? true,
      eligibleForLiveChat: session.role.eligible_for_live_chat ?? true,
      approvalRequired: session.role.approval_required ?? true,
      disclaimerText: session.role.disclaimer_text,
      aiMatchingRules: session.role.ai_matching_rules || {},
      isActive: session.role.is_active ?? true,
      displayOrder: session.role.display_order ?? 0,
      createdAt: session.role.created_at,
      updatedAt: session.role.updated_at,
    };
  }

  return mapped;
}

/**
 * Send AI introduction message when professional joins
 */
async function sendProfessionalIntroductionMessage(
  conversationId: string,
  userId: string,
  professionalName: string,
  roleName: string
): Promise<void> {
  try {
    const aiUser = await getOrCreateAIUser();
    if (!aiUser) {
      console.error('AI user not found - cannot send introduction message');
      return;
    }

    const introductionMessage = `Great news! ${professionalName}, a verified ${roleName}, has joined our conversation to help you. I'll be observing in the background, and they'll be leading the conversation from here. Feel free to continue chatting, and I'm here if you need anything else!`;

    // Try direct insert first
    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: aiUser.id,
        receiver_id: userId,
        content: introductionMessage,
        message_type: 'text',
      });

    if (insertError) {
      // If direct insert fails, try using the RPC function
      await supabase.rpc('send_ai_message', {
        p_conversation_id: conversationId,
        p_receiver_id: userId,
        p_content: introductionMessage,
        p_message_type: 'text',
        p_media_url: null,
        p_document_url: null,
        p_document_name: null,
        p_sticker_id: null,
        p_status_id: null,
        p_status_preview_url: null,
      });
    }
  } catch (error: any) {
    console.error('Error sending professional introduction message:', error);
    // Don't throw - this is a nice-to-have feature
  }
}

