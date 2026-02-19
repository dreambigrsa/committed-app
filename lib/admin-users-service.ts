/**
 * Admin users service – delete user via Edge Function (service role).
 * Frontend cannot delete users directly (no RLS DELETE on users; auth must be deleted server-side).
 */

import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dizcuexznganwgddsrfo.supabase.co';

export interface AdminDeleteUserResult {
  success: boolean;
  message?: string;
  error?: string;
  deletedUserId?: string;
}

/**
 * Permanently delete a user (admin only).
 * Calls Edge Function which uses service role to auth.admin.deleteUser(userId).
 * public.users and all related data are removed via DB CASCADE.
 */
export async function adminDeleteUser(userId: string): Promise<AdminDeleteUserResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'You must be logged in' };
    }

    const functionUrl = `${SUPABASE_URL}/functions/v1/admin-delete-user`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({ userId }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: result.error || result.message || `HTTP ${response.status}`,
      };
    }

    if (result.success) {
      return {
        success: true,
        message: result.message || 'User permanently deleted',
        deletedUserId: result.deletedUserId,
      };
    }

    return {
      success: false,
      error: result.error || result.message || 'Delete failed',
    };
  } catch (error: any) {
    console.error('adminDeleteUser error:', error);
    return {
      success: false,
      error: error?.message || 'Failed to delete user',
    };
  }
}
