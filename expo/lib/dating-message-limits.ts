/**
 * Dating Message Limits Service
 * Handles checking and enforcing message limits for dating conversations
 */

import { supabase } from './supabase';

/**
 * Check if user can send a conversation starter to another user
 * Returns true if allowed, false if limit reached
 */
export async function checkConversationStarterLimit(
  receiverId: string
): Promise<{ allowed: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { allowed: false, error: 'User not authenticated' };
    }

    const { data: allowed, error } = await supabase.rpc('check_conversation_starter_limit', {
      sender_id_param: user.id,
      receiver_id_param: receiverId,
    });

    if (error) {
      // Properly extract error message
      const errorMessage = error?.message || error?.details || error?.hint || String(error);
      console.error('Error checking conversation starter limit:', {
        message: errorMessage,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        fullError: error,
      });
      // Allow by default if check fails (fail open)
      return { allowed: true };
    }

    // The function returns a boolean
    if (allowed === false) {
      return {
        allowed: false,
        error: 'You can only send one conversation starter per person. Upgrade to Premium for unlimited messaging!',
      };
    }

    return { allowed: true };
  } catch (error: any) {
    console.error('Exception checking conversation starter limit:', error);
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    console.error('Exception details:', errorMessage);
    // Allow by default if check fails
    return { allowed: true };
  }
}

/**
 * Check if user can send a message in a dating conversation
 * Returns object with allowed status and reason
 */
export async function checkDatingMessageLimit(
  conversationId: string
): Promise<{
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { allowed: false, error: 'User not authenticated' };
    }

    const { data: result, error } = await supabase.rpc('check_dating_message_limit', {
      sender_id_param: user.id,
      conversation_id_param: conversationId,
    });

    if (error) {
      console.error('Error checking dating message limit:', error);
      // Allow by default if check fails (fail open)
      return { allowed: true };
    }

    if (!result || !result.allowed) {
      const reason = result?.reason || 'limit_reached';
      let errorMessage = 'Message limit reached. ';
      
      if (reason === 'pre_match_limit_reached') {
        errorMessage += `You've sent ${result.current || 0} messages. `;
        errorMessage += 'Match with this person or upgrade to Premium for unlimited messaging!';
      } else if (reason === 'conversation_limit_reached') {
        errorMessage += `You've sent ${result.current || 0} messages in this conversation. `;
        errorMessage += 'Upgrade to Premium for unlimited messaging!';
      } else {
        errorMessage += 'Upgrade to Premium for unlimited messaging!';
      }

      return {
        allowed: false,
        reason: reason,
        limit: result?.limit,
        current: result?.current,
        error: errorMessage,
      };
    }

    return {
      allowed: true,
      reason: result.reason,
    };
  } catch (error: any) {
    console.error('Error checking dating message limit:', error);
    // Allow by default if check fails
    return { allowed: true };
  }
}

