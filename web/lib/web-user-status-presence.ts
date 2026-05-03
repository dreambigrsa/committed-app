/**
 * Web parity with native `AppContext` user_status writes so `user_status.status_type`
 * reflects an active browser session (online / away / offline).
 */

export async function syncWebViewerOnline(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<'online' | 'busy' | null> {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return null;
  const now = new Date().toISOString();
  const { data: row } = await supabase.from('user_status').select('status_type').eq('user_id', userId).maybeSingle();
  const nextType = row?.status_type === 'busy' ? 'busy' : 'online';
  const { error } = await supabase.from('user_status').upsert(
    {
      user_id: userId,
      status_type: nextType,
      last_active_at: now,
      updated_at: now,
      status_visibility: 'everyone',
      last_seen_visibility: 'everyone',
    },
    { onConflict: 'user_id' },
  );
  if (error) return null;
  return nextType as 'online' | 'busy';
}

export async function syncWebViewerAway(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('user_status').upsert(
    {
      user_id: userId,
      status_type: 'away',
      last_active_at: now,
      updated_at: now,
      status_visibility: 'everyone',
      last_seen_visibility: 'everyone',
    },
    { onConflict: 'user_id' },
  );
  return !error;
}

export async function syncWebViewerOffline(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from('user_status').upsert(
    {
      user_id: userId,
      status_type: 'offline',
      last_active_at: now,
      updated_at: now,
      status_visibility: 'everyone',
      last_seen_visibility: 'everyone',
    },
    { onConflict: 'user_id' },
  );
}
