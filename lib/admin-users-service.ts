/**
 * Admin Users Service
 * Calls Edge Function to permanently delete a user (auth + DB cascade).
 */

import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export type AdminDeleteUserResult =
  | { success: true; deletedUserId: string }
  | { success: false; error: string };

/**
 * Permanently delete a user. Requires admin/super_admin role.
 * Deletes the auth user so DB cascade removes public.users and related rows.
 */
export async function adminDeleteUser(userId: string): Promise<AdminDeleteUserResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { success: false, error: 'You must be logged in' };
  }

  const functionUrl = `${SUPABASE_URL}/functions/v1/admin-delete-user`;
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ userId }),
  });

  const text = await response.text();
  let data: { success?: boolean; error?: string; deletedUserId?: string };
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: response.ok ? 'Invalid response' : text || `HTTP ${response.status}` };
  }

  if (!response.ok) {
    return { success: false, error: data.error || text || `HTTP ${response.status}` };
  }

  if (data.success && data.deletedUserId) {
    return { success: true, deletedUserId: data.deletedUserId };
  }
  return { success: false, error: data.error || 'Delete failed' };
}
