import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type AcceptLegalBody = {
  documents?: Array<{
    documentId?: string;
    documentVersion?: string;
  }>;
};

type LegalAcceptanceRow = {
  user_id: string;
  document_id: string;
  document_version: string;
  context: string;
  accepted_at: string;
};

function createTraceId() {
  return `legal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

function logLegal(traceId: string, message: string, payload: Record<string, unknown> = {}) {
  console.log(`[legal-acceptances:${traceId}] ${message}`, payload);
}

async function requireUser(req: NextRequest, traceId: string) {
  const authHeader = req.headers.get('Authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  logLegal(traceId, 'auth header received', { hasBearerToken: Boolean(accessToken) });

  if (!accessToken) {
    return {
      response: NextResponse.json({ success: false, error: 'Missing auth session.', traceId }, { status: 401 }),
    };
  }

  const supabase = createSupabaseAdmin();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  logLegal(traceId, 'auth token checked', {
    hasUser: Boolean(user?.id),
    userId: user?.id ?? null,
    userError: userError ? errorDetails(userError) : null,
  });

  if (userError || !user?.id) {
    return {
      response: NextResponse.json({ success: false, error: 'Invalid or expired auth session.', traceId }, { status: 401 }),
    };
  }

  return { supabase, user };
}

async function saveRows(supabase: ReturnType<typeof createSupabaseAdmin>, rows: LegalAcceptanceRow[], traceId: string) {
  const upsertResult = await supabase
    .from('user_legal_acceptances')
    .upsert(rows, { onConflict: 'user_id,document_id' });

  if (!upsertResult.error) {
    logLegal(traceId, 'acceptances saved through bulk upsert', { count: rows.length });
    return 'bulk_upsert';
  }

  logLegal(traceId, 'bulk upsert failed; falling back to per-document save', {
    error: errorDetails(upsertResult.error),
    count: rows.length,
  });

  for (const row of rows) {
    const existingResult = await supabase
      .from('user_legal_acceptances')
      .select('id')
      .eq('user_id', row.user_id)
      .eq('document_id', row.document_id)
      .order('accepted_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (existingResult.error) {
      logLegal(traceId, 'existing acceptance lookup failed', {
        documentId: row.document_id,
        error: errorDetails(existingResult.error),
      });
      throw existingResult.error;
    }

    if (existingResult.data?.id) {
      const updateResult = await supabase
        .from('user_legal_acceptances')
        .update({
          document_version: row.document_version,
          context: row.context,
          accepted_at: row.accepted_at,
        })
        .eq('id', existingResult.data.id);

      if (updateResult.error) {
        logLegal(traceId, 'acceptance update failed', {
          documentId: row.document_id,
          acceptanceId: existingResult.data.id,
          error: errorDetails(updateResult.error),
        });
        throw updateResult.error;
      }
      continue;
    }

    const insertResult = await supabase.from('user_legal_acceptances').insert(row);
    if (insertResult.error) {
      logLegal(traceId, 'acceptance insert failed', {
        documentId: row.document_id,
        error: errorDetails(insertResult.error),
      });
      throw insertResult.error;
    }
  }

  logLegal(traceId, 'acceptances saved through row fallback', { count: rows.length });
  return 'row_fallback';
}

export async function GET(req: NextRequest) {
  const traceId = createTraceId();
  try {
    const auth = await requireUser(req, traceId);
    if ('response' in auth) return auth.response;

    const { data, error } = await auth.supabase
      .from('user_legal_acceptances')
      .select('document_id,document_version,accepted_at,context')
      .eq('user_id', auth.user.id);

    logLegal(traceId, 'acceptance status loaded', {
      userId: auth.user.id,
      count: data?.length ?? 0,
      error: error ? errorDetails(error) : null,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, acceptances: data ?? [], traceId }, { status: 200 });
  } catch (error) {
    console.error(`[legal-acceptances:${traceId}] status error`, errorDetails(error));
    return NextResponse.json(
      { success: false, error: 'Unable to load legal acceptance status.', traceId },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const traceId = createTraceId();
  try {
    const auth = await requireUser(req, traceId);
    if ('response' in auth) return auth.response;

    const body = (await req.json().catch(() => ({}))) as AcceptLegalBody;
    const requestedDocs = Array.isArray(body.documents) ? body.documents : [];
    const requestedIds = Array.from(
      new Set(
        requestedDocs
          .map((doc) => (typeof doc.documentId === 'string' ? doc.documentId.trim() : ''))
          .filter(Boolean)
      )
    );

    logLegal(traceId, 'acceptance payload received', {
      userId: auth.user.id,
      requestedCount: requestedIds.length,
      requestedIds,
    });

    if (requestedIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No legal documents selected.', traceId }, { status: 400 });
    }

    const { data: legalDocs, error: docsError } = await auth.supabase
      .from('legal_documents')
      .select('id,version,is_active,is_required')
      .in('id', requestedIds)
      .eq('is_active', true)
      .eq('is_required', true);

    logLegal(traceId, 'required legal documents validated', {
      requestedCount: requestedIds.length,
      foundCount: legalDocs?.length ?? 0,
      error: docsError ? errorDetails(docsError) : null,
    });

    if (docsError) throw docsError;
    if (!legalDocs || legalDocs.length !== requestedIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more legal documents are no longer available.', traceId },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const rows: LegalAcceptanceRow[] = legalDocs.map((doc) => ({
      user_id: auth.user.id,
      document_id: doc.id,
      document_version: doc.version || '1.0.0',
      context: 'manual',
      accepted_at: now,
    }));

    const saveStrategy = await saveRows(auth.supabase, rows, traceId);

    return NextResponse.json(
      {
        success: true,
        acceptedCount: rows.length,
        saveStrategy,
        traceId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[legal-acceptances:${traceId}] save error`, errorDetails(error));
    return NextResponse.json(
      { success: false, error: 'Unable to save legal acceptance.', traceId },
      { status: 500 }
    );
  }
}
