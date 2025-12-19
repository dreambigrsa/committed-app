import { supabase } from './supabase';
import { EscalationRule, ProfessionalSession, ProfessionalProfile } from '@/types';
import { findMatchingProfessionals } from './professional-matching';

/**
 * Check if a session should be escalated based on rules
 */
export async function checkEscalationRules(
  sessionId: string
): Promise<{ shouldEscalate: boolean; rule?: EscalationRule; reason?: string }> {
  try {
    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('professional_sessions')
      .select('*, role:professional_roles(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return { shouldEscalate: false };
    }

    // Get applicable escalation rules (role-specific or global)
    const { data: rules, error: rulesError } = await supabase
      .from('escalation_rules')
      .select('*')
      .eq('is_active', true)
      .or(`role_id.is.null,role_id.eq.${session.role_id}`)
      .order('priority', { ascending: true }); // Lower priority = higher priority

    if (rulesError || !rules || rules.length === 0) {
      return { shouldEscalate: false };
    }

    // Check each rule in priority order
    for (const ruleData of rules) {
      const rule: EscalationRule = {
        id: ruleData.id,
        name: ruleData.name,
        description: ruleData.description,
        roleId: ruleData.role_id,
        triggerType: ruleData.trigger_type,
        timeoutSeconds: ruleData.timeout_seconds,
        maxEscalationAttempts: ruleData.max_escalation_attempts || 3,
        escalationStrategy: ruleData.escalation_strategy,
        fallbackRules: ruleData.fallback_rules || {},
        requireUserConfirmation: ruleData.require_user_confirmation ?? true,
        isActive: ruleData.is_active ?? true,
        priority: ruleData.priority || 0,
        createdAt: ruleData.created_at,
        updatedAt: ruleData.updated_at,
      };

      const shouldEscalate = await evaluateEscalationRule(rule, session);
      if (shouldEscalate.shouldEscalate) {
        return {
          shouldEscalate: true,
          rule,
          reason: shouldEscalate.reason,
        };
      }
    }

    return { shouldEscalate: false };
  } catch (error: any) {
    console.error('Error checking escalation rules:', error);
    return { shouldEscalate: false };
  }
}

/**
 * Evaluate if a specific escalation rule should trigger
 */
async function evaluateEscalationRule(
  rule: EscalationRule,
  session: any
): Promise<{ shouldEscalate: boolean; reason?: string }> {
  // Check if max escalation attempts reached
  if (session.escalation_level >= rule.maxEscalationAttempts) {
    return { shouldEscalate: false };
  }

  switch (rule.triggerType) {
    case 'timeout':
      return evaluateTimeoutRule(rule, session);
    case 'user_request':
      // User-requested escalations are handled explicitly
      return { shouldEscalate: false };
    case 'ai_detection':
      // AI detection escalations are handled separately
      return { shouldEscalate: false };
    case 'manual':
      // Manual escalations are handled explicitly
      return { shouldEscalate: false };
    default:
      return { shouldEscalate: false };
  }
}

/**
 * Evaluate timeout-based escalation
 */
async function evaluateTimeoutRule(
  rule: EscalationRule,
  session: any
): Promise<{ shouldEscalate: boolean; reason?: string }> {
  if (!rule.timeoutSeconds || !session.professional_joined_at) {
    return { shouldEscalate: false };
  }

  const joinedAt = new Date(session.professional_joined_at).getTime();
  const now = Date.now();
  const elapsedSeconds = (now - joinedAt) / 1000;

  if (elapsedSeconds >= rule.timeoutSeconds) {
    return {
      shouldEscalate: true,
      reason: `Session timeout after ${rule.timeoutSeconds} seconds`,
    };
  }

  return { shouldEscalate: false };
}

/**
 * Escalate a session to a new professional
 */
export async function escalateSession(
  sessionId: string,
  escalationReason: string,
  requireUserConfirmation: boolean = true
): Promise<{ success: boolean; newSessionId?: string; error?: string }> {
  try {
    // Get current session
    const { data: session, error: sessionError } = await supabase
      .from('professional_sessions')
      .select('*, role:professional_roles(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return { success: false, error: 'Session not found' };
    }

    // Check escalation rules
    const escalationCheck = await checkEscalationRules(sessionId);
    if (!escalationCheck.shouldEscalate) {
      return { success: false, error: 'Escalation not allowed by rules' };
    }

    const rule = escalationCheck.rule!;

    // Find alternative professional
    const alternativeProfessionals = await findMatchingProfessionals({
      roleId: session.role_id,
      excludeProfessionalId: session.professional_id,
      escalationLevel: session.escalation_level + 1,
    });

    if (alternativeProfessionals.length === 0) {
      // Apply fallback rules
      const fallbackResult = await applyFallbackRules(session, rule);
      if (!fallbackResult.success) {
        return { success: false, error: 'No available professionals for escalation' };
      }
      return fallbackResult;
    }

    // Select professional based on escalation strategy
    const selectedProfessional = selectProfessionalByStrategy(
      alternativeProfessionals,
      rule.escalationStrategy
    );

    if (!selectedProfessional) {
      return { success: false, error: 'Failed to select professional' };
    }

    // Create escalation event
    const { data: escalationEvent, error: escalationError } = await supabase
      .from('escalation_events')
      .insert({
        session_id: sessionId,
        rule_id: rule.id,
        from_professional_id: session.professional_id,
        to_professional_id: selectedProfessional.id,
        escalation_level: session.escalation_level + 1,
        reason: escalationReason,
        user_notified: !requireUserConfirmation, // If confirmation required, notify after confirmation
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (escalationError) {
      console.error('Error creating escalation event:', escalationError);
      return { success: false, error: 'Failed to create escalation event' };
    }

    // If user confirmation is required, return the escalation event for confirmation
    if (requireUserConfirmation) {
      return {
        success: true,
        newSessionId: selectedProfessional.id, // Return professional ID for confirmation
      };
    }

    // Automatically accept escalation
    return await acceptEscalation(sessionId, selectedProfessional.id, escalationEvent.id);
  } catch (error: any) {
    console.error('Error escalating session:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Apply fallback rules when no professionals available
 */
async function applyFallbackRules(
  session: any,
  rule: EscalationRule
): Promise<{ success: boolean; newSessionId?: string; error?: string }> {
  const fallbackRules = rule.fallbackRules || {};

  // Local to online fallback
  if (fallbackRules.local_to_online) {
    // Try to find any available professional online (ignoring location)
    const onlineProfessionals = await findMatchingProfessionals({
      roleId: session.role_id,
      excludeProfessionalId: session.professional_id,
      escalationLevel: session.escalation_level + 1,
      requireOnline: true,
    });

    if (onlineProfessionals.length > 0) {
      const selected = selectProfessionalByStrategy(onlineProfessionals, rule.escalationStrategy);
      if (selected) {
        // Create escalation event and accept
        const { data: escalationEvent } = await supabase
          .from('escalation_events')
          .insert({
            session_id: session.id,
            rule_id: rule.id,
            from_professional_id: session.professional_id,
            to_professional_id: selected.id,
            escalation_level: session.escalation_level + 1,
            reason: 'Fallback: Local to online escalation',
            user_notified: true,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (escalationEvent) {
          return await acceptEscalation(session.id, selected.id, escalationEvent.id);
        }
      }
    }
  }

  return { success: false, error: 'No fallback options available' };
}

/**
 * Select professional based on escalation strategy
 */
function selectProfessionalByStrategy(
  professionals: ProfessionalProfile[],
  strategy: 'sequential' | 'broadcast' | 'round_robin'
): ProfessionalProfile | null {
  if (professionals.length === 0) return null;

  switch (strategy) {
    case 'sequential':
      // Return first available (highest rated or first in list)
      return professionals[0];
    case 'round_robin':
      // For simplicity, return first (in production, track last assigned)
      return professionals[0];
    case 'broadcast':
      // For broadcast, still return first (actual broadcast handled separately)
      return professionals[0];
    default:
      return professionals[0];
  }
}

/**
 * Accept an escalation and transfer session
 */
export async function acceptEscalation(
  sessionId: string,
  newProfessionalId: string,
  escalationEventId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update escalation event
    const { error: eventError } = await supabase
      .from('escalation_events')
      .update({
        user_confirmed: true,
        result: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', escalationEventId);

    if (eventError) {
      console.error('Error updating escalation event:', eventError);
    }

    // Update session with new professional
    const { error: sessionError } = await supabase
      .from('professional_sessions')
      .update({
        professional_id: newProfessionalId,
        escalation_level: supabase.raw('escalation_level + 1'),
        escalation_reason: 'Session escalated',
        professional_joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (sessionError) {
      console.error('Error updating session:', sessionError);
      return { success: false, error: 'Failed to update session' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error accepting escalation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Decline an escalation
 */
export async function declineEscalation(
  escalationEventId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('escalation_events')
      .update({
        user_confirmed: false,
        result: 'declined',
        reason: reason || 'User declined escalation',
        updated_at: new Date().toISOString(),
      })
      .eq('id', escalationEventId);

    if (error) {
      console.error('Error declining escalation:', error);
      return { success: false, error: 'Failed to decline escalation' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error declining escalation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify user about escalation
 */
export async function notifyUserOfEscalation(
  sessionId: string,
  escalationEventId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('escalation_events')
      .update({
        user_notified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', escalationEventId);

    if (error) {
      console.error('Error notifying user:', error);
      return { success: false, error: 'Failed to mark as notified' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error notifying user:', error);
    return { success: false, error: error.message };
  }
}

