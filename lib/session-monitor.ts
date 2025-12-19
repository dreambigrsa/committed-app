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

