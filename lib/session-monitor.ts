/**
 * Session Monitor Service
 * Monitors professional sessions for timeouts and automatic escalation
 */

import { supabase } from './supabase';
import { checkEscalationRules, escalateSession } from './escalation-service';
import { getActiveSession } from './professional-sessions';
import { detectNonAgreementAndSuggestAlternative } from './ai-service';

/**
 * Check for pending sessions that have timed out
 * This should be called periodically (e.g., every minute via background job)
 */
export async function checkPendingSessionsForTimeout(): Promise<void> {
  try {
    // Get all pending sessions
    const { data: pendingSessions, error } = await supabase
      .from('professional_sessions')
      .select('id, created_at, role_id')
      .eq('status', 'pending_acceptance')
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // 5 minutes ago

    if (error) {
      console.error('Error checking pending sessions:', error);
      return;
    }

    if (!pendingSessions || pendingSessions.length === 0) {
      return;
    }

    // Check each pending session for timeout escalation
    for (const session of pendingSessions) {
      const escalationCheck = await checkEscalationRules(session.id);
      if (escalationCheck.shouldEscalate && escalationCheck.rule) {
        // Auto-escalate to next professional
        await escalateSession(
          session.id,
          'Professional did not respond within timeout period',
          false // Don't require user confirmation for timeout escalations
        );
      }
    }
  } catch (error: any) {
    console.error('Error checking pending sessions for timeout:', error);
  }
}

/**
 * Monitor active sessions for non-agreement patterns
 * This should be called when new messages are received in an active session
 */
export async function monitorActiveSessionForNonAgreement(
  conversationId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ shouldEscalate: boolean; suggestion?: string }> {
  try {
    const session = await getActiveSession(conversationId);
    if (!session || session.status !== 'active') {
      return { shouldEscalate: false };
    }

    // Only monitor if AI is in observer mode
    if (!session.aiObserverMode) {
      return { shouldEscalate: false };
    }

    // Detect non-agreement patterns
    const detection = await detectNonAgreementAndSuggestAlternative(
      conversationHistory,
      conversationId,
      session.userId,
      session.id
    );

    if (detection.shouldEscalate) {
      // Inform user and offer escalation
      // The actual escalation will be handled by the calling code
      return detection;
    }

    return { shouldEscalate: false };
  } catch (error: any) {
    console.error('Error monitoring session for non-agreement:', error);
    return { shouldEscalate: false };
  }
}

/**
 * Check active sessions for inactivity timeout (5 minutes without messages)
 * Ends sessions and triggers professional reassignment if needed
 */
export async function checkActiveSessionsForInactivity(): Promise<void> {
  try {
    // Get all active sessions
    const { data: activeSessions, error } = await supabase
      .from('professional_sessions')
      .select('id, conversation_id, professional_id, role_id, user_id, professional_joined_at')
      .eq('status', 'active')
      .not('professional_joined_at', 'is', null);

    if (error) {
      console.error('Error checking active sessions for inactivity:', error);
      return;
    }

    if (!activeSessions || activeSessions.length === 0) {
      return;
    }

    const now = Date.now();
    const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    for (const session of activeSessions) {
      try {
        // Get last message in conversation
        const { data: lastMessage, error: msgError } = await supabase
          .from('messages')
          .select('created_at')
          .eq('conversation_id', session.conversation_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (msgError) {
          console.error(`Error getting last message for session ${session.id}:`, msgError);
          continue;
        }

        // Use last message time, or professional_joined_at if no messages
        const lastActivityTime = lastMessage?.created_at 
          ? new Date(lastMessage.created_at).getTime()
          : new Date(session.professional_joined_at).getTime();
        
        const timeSinceLastActivity = now - lastActivityTime;

        if (timeSinceLastActivity >= INACTIVITY_TIMEOUT_MS) {
          console.log(`Session ${session.id} inactive for ${Math.round(timeSinceLastActivity / 1000 / 60)} minutes - ending session`);
          
          // End the session
          const { error: endError } = await supabase
            .from('professional_sessions')
            .update({
              status: 'ended',
              ended_by: 'system',
              ended_reason: 'Session inactive for 5+ minutes',
              professional_ended_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', session.id);

          if (endError) {
            console.error(`Error ending inactive session ${session.id}:`, endError);
            continue;
          }

          // Decrement professional session count
          const { error: decrementError } = await supabase.rpc('decrement_professional_session_count', {
            prof_id: session.professional_id,
          });
          if (decrementError) {
            console.error(`Error decrementing session count:`, decrementError);
          }

          // Auto-reassign to new professional
          try {
            const { findMatchingProfessionals } = await import('./professional-matching');
            const { createProfessionalSession } = await import('./professional-sessions');
            const { getOrCreateAIUser } = await import('./ai-service');
            
            // Find alternative professionals (excluding the one who was inactive)
            const alternativeMatches = await findMatchingProfessionals({
              roleId: session.role_id,
              excludeProfessionalId: session.professional_id,
              requiresOnlineOnly: true,
            }, 1); // Get just the best match
            
            if (alternativeMatches.length > 0) {
              const nextProfessional = alternativeMatches[0].profile;
              
              // Create a new session with the next professional
              const newSessionResult = await createProfessionalSession({
                conversationId: session.conversation_id,
                userId: session.user_id,
                professionalId: nextProfessional.id,
                roleId: session.role_id,
                aiSummary: undefined,
                userConsentGiven: true, // User already gave consent for original request
              });
              
              if (newSessionResult.session) {
                console.log(`Auto-reassigned inactive session to professional: ${nextProfessional.id}`);
                
                // Notify user about the reassignment
                const aiUser = await getOrCreateAIUser();
                if (aiUser) {
                  const roleName = alternativeMatches[0].role?.name || 'professional';
                  const { error: msgErr } = await supabase.rpc('send_ai_message', {
                    p_conversation_id: session.conversation_id,
                    p_receiver_id: session.user_id,
                    p_content: `The previous session ended due to inactivity. I've automatically connected you with ${nextProfessional.fullName}, another verified ${roleName}. They'll join shortly if available.`,
                    p_message_type: 'text',
                    p_media_url: null,
                    p_document_url: null,
                    p_document_name: null,
                    p_sticker_id: null,
                    p_status_id: null,
                    p_status_preview_url: null,
                  });
                  if (msgErr) {
                    console.error('Error sending reassignment notification:', msgErr);
                  }
                }
              } else {
                // No professional available for reassignment
                const aiUser = await getOrCreateAIUser();
                if (aiUser) {
                  const { error: msgErr } = await supabase.rpc('send_ai_message', {
                    p_conversation_id: session.conversation_id,
                    p_receiver_id: session.user_id,
                    p_content: 'The session has ended due to inactivity. No other professionals are currently available. I can help you in the meantime, or you can try requesting help again later.',
                    p_message_type: 'text',
                    p_media_url: null,
                    p_document_url: null,
                    p_document_name: null,
                    p_sticker_id: null,
                    p_status_id: null,
                    p_status_preview_url: null,
                  });
                  if (msgErr) {
                    console.error('Error sending no-professional message:', msgErr);
                  }
                }
              }
            } else {
              // No professionals available
              const aiUser = await getOrCreateAIUser();
              if (aiUser) {
                const { error: msgErr } = await supabase.rpc('send_ai_message', {
                  p_conversation_id: session.conversation_id,
                  p_receiver_id: session.user_id,
                  p_content: 'The session has ended due to inactivity. No other professionals are currently available. I can help you in the meantime, or you can try requesting help again later.',
                  p_message_type: 'text',
                  p_media_url: null,
                  p_document_url: null,
                  p_document_name: null,
                  p_sticker_id: null,
                  p_status_id: null,
                  p_status_preview_url: null,
                });
                if (msgErr) {
                  console.error('Error sending no-professional message:', msgErr);
                }
              }
            }
          } catch (reassignError: any) {
            console.error(`Error reassigning inactive session ${session.id}:`, reassignError);
            // Still notify user even if reassignment failed
            const { getOrCreateAIUser } = await import('./ai-service');
            const aiUser = await getOrCreateAIUser();
            if (aiUser) {
              const { error: msgErr } = await supabase.rpc('send_ai_message', {
                p_conversation_id: session.conversation_id,
                p_receiver_id: session.user_id,
                p_content: 'The session has ended due to inactivity. You can request help again if needed.',
                p_message_type: 'text',
                p_media_url: null,
                p_document_url: null,
                p_document_name: null,
                p_sticker_id: null,
                p_status_id: null,
                p_status_preview_url: null,
              });
              if (msgErr) {
                console.error('Error sending inactivity notification:', msgErr);
              }
            }
          }
        }
      } catch (sessionError: any) {
        console.error(`Error processing session ${session.id} for inactivity:`, sessionError);
      }
    }
  } catch (error: any) {
    console.error('Error checking active sessions for inactivity:', error);
  }
}

