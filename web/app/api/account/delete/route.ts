import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function createTraceId() {
  return `account-delete-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function errorDetails(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { message: error instanceof Error ? error.message : String(error || 'Unknown error') };
  }
  const maybeError = error as { message?: string; code?: string; details?: string; hint?: string; status?: number };
  return {
    message: maybeError.message || 'Unknown error',
    code: maybeError.code,
    details: maybeError.details,
    hint: maybeError.hint,
    status: maybeError.status,
  };
}

export async function POST(req: NextRequest) {
  const traceId = createTraceId();
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'Missing auth session.', traceId }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    console.log(`[account-delete:${traceId}] auth checked`, {
      hasUser: Boolean(user?.id),
      userId: user?.id ?? null,
      userError: userError ? errorDetails(userError) : null,
    });

    if (userError || !user?.id) {
      return NextResponse.json({ success: false, error: 'Invalid or expired auth session.', traceId }, { status: 401 });
    }

    let appDataMode: 'deleted' | 'anonymized' = 'deleted';
    const { error: userDeleteError } = await supabase.from('users').delete().eq('id', user.id);
    if (userDeleteError) {
      const suffix = user.id.replace(/-/g, '').slice(0, 12);
      console.warn(`[account-delete:${traceId}] users delete failed; anonymizing row before auth delete`, {
        userId: user.id,
        error: errorDetails(userDeleteError),
      });
      const { error: anonymizeError } = await supabase
        .from('users')
        .update({
          full_name: 'Deleted account',
          username: `deleted_${suffix}`,
          email: `deleted_${suffix}@deleted.com`,
          phone_number: `+000${Date.now().toString().slice(-10)}`,
          profile_picture: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (anonymizeError) {
        console.error(`[account-delete:${traceId}] users anonymize fallback failed`, errorDetails(anonymizeError));
        throw anonymizeError;
      }
      appDataMode = 'anonymized';
    }
    console.log(`[account-delete:${traceId}] app user row handled`, { userId: user.id, appDataMode });

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (authDeleteError) {
      console.error(`[account-delete:${traceId}] auth user delete failed`, errorDetails(authDeleteError));
      throw authDeleteError;
    }

    return NextResponse.json({ success: true, appDataMode, traceId }, { status: 200 });
  } catch (error) {
    console.error(`[account-delete:${traceId}] delete failed`, errorDetails(error));
    return NextResponse.json(
      { success: false, error: 'Could not delete account. Please try again or contact support.', traceId },
      { status: 500 }
    );
  }
}
