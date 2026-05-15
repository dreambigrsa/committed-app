import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient, type User as SupabaseUser } from '@supabase/supabase-js';
import { createSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://dizcuexznganwgddsrfo.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkaXpjdWV4em5nYW53Z2Rkc3JmbyIsInJlZiI6ImRpemN1ZXh6bmdhbndnZGRzcmZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjcxODcsImV4cCI6MjA4MDg0MzE4N30.cvnt9KN4rz2u9QbDQjFcA_Q7WDz2M_lGln3RCJ-hJQ';

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

type AuthedSupabase = {
  userClient: SupabaseClient;
  adminClient: SupabaseClient | null;
  user: SupabaseUser;
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

function createUserClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function tryCreateAdmin(traceId: string) {
  try {
    return createSupabaseAdmin();
  } catch (error) {
    logLegal(traceId, 'service role unavailable; continuing with user-scoped client', {
      error: errorDetails(error),
    });
    return null;
  }
}

async function requireUser(req: NextRequest, traceId: string): Promise<AuthedSupabase | { response: NextResponse }> {
  const authHeader = req.headers.get('Authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  logLegal(traceId, 'auth header received', { hasBearerToken: Boolean(accessToken) });

  if (!accessToken) {
    return {
      response: NextResponse.json({ success: false, error: 'Missing auth session.', traceId }, { status: 401 }),
    };
  }

  const userClient = createUserClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(accessToken);

  logLegal(traceId, 'auth token checked with user client', {
    hasUser: Boolean(user?.id),
    userId: user?.id ?? null,
    userError: userError ? errorDetails(userError) : null,
  });

  if (userError || !user?.id) {
    return {
      response: NextResponse.json({ success: false, error: 'Invalid or expired auth session.', traceId }, { status: 401 }),
    };
  }

  return {
    userClient,
    adminClient: tryCreateAdmin(traceId),
    user,
  };
}

function requireVerifiedEmail(auth: AuthedSupabase, traceId: string): NextResponse | null {
  const verified = Boolean(auth.user.email_confirmed_at);
  logLegal(traceId, 'email verification checked before legal acceptance', {
    userId: auth.user.id,
    email: auth.user.email ?? null,
    emailConfirmedAt: auth.user.email_confirmed_at ?? null,
    verified,
  });

  if (verified) return null;

  return NextResponse.json(
    {
      success: false,
      error: 'Please verify your email before accepting legal documents.',
      traceId,
    },
    { status: 403 }
  );
}

function buildFallbackPhone(user: SupabaseUser) {
  const metaPhone = typeof user.user_metadata?.phone_number === 'string' ? user.user_metadata.phone_number.trim() : '';
  const metaPhoneAlt = typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone.trim() : '';
  const metaPhoneCamel = typeof user.user_metadata?.phoneNumber === 'string' ? user.user_metadata.phoneNumber.trim() : '';
  const authPhone = typeof user.phone === 'string' ? user.phone.trim() : '';
  if (metaPhone) return metaPhone;
  if (metaPhoneAlt) return metaPhoneAlt;
  if (metaPhoneCamel) return metaPhoneCamel;
  if (authPhone) return authPhone;
  return `+0000000${user.id.replace(/-/g, '').slice(-4).padStart(4, '0')}`;
}

function buildUserRow(user: SupabaseUser) {
  const email = (user.email || '').trim().toLowerCase();
  const metaName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  const fallbackName = email ? email.split('@')[0] : 'User';

  return {
    id: user.id,
    full_name: metaName || fallbackName || 'User',
    email,
    phone_number: buildFallbackPhone(user),
    role: email === 'nashiezw@gmail.com' ? 'super_admin' : 'user',
    phone_verified: false,
    email_verified: Boolean(user.email_confirmed_at),
    id_verified: false,
  };
}

async function findUserRow(client: SupabaseClient, userId: string, traceId: string, source: string) {
  const result = await client
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  logLegal(traceId, `users row checked with ${source}`, {
    userId,
    found: Boolean(result.data?.id),
    error: result.error ? errorDetails(result.error) : null,
  });

  return result;
}

async function insertUserRow(client: SupabaseClient, user: SupabaseUser, traceId: string, source: string) {
  const row = buildUserRow(user);
  const result = await client
    .from('users')
    .upsert(row, { onConflict: 'id', ignoreDuplicates: true })
    .select('id')
    .maybeSingle();

  logLegal(traceId, `users row repair attempted with ${source}`, {
    userId: user.id,
    email: row.email,
    hasFullName: Boolean(row.full_name),
    hasPhoneNumber: Boolean(row.phone_number),
    inserted: Boolean(result.data?.id),
    error: result.error ? errorDetails(result.error) : null,
  });

  return result;
}

async function ensureUserRow(auth: AuthedSupabase, traceId: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const userResult = await findUserRow(auth.userClient, auth.user.id, traceId, `user attempt ${attempt + 1}`);
    if (userResult.data?.id) return 'existing_user';
    if (userResult.error && userResult.error.code !== 'PGRST116') {
      logLegal(traceId, 'users row lookup through user client failed', {
        error: errorDetails(userResult.error),
      });
    }

    if (auth.adminClient) {
      const adminResult = await findUserRow(auth.adminClient, auth.user.id, traceId, `admin attempt ${attempt + 1}`);
      if (adminResult.data?.id) return 'existing_admin';
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  const failures: Array<{ strategy: string; error: ReturnType<typeof errorDetails> }> = [];

  try {
    const insertResult = await insertUserRow(auth.userClient, auth.user, traceId, 'user');
    if (insertResult.data?.id || !insertResult.error) return 'created_user';
    failures.push({ strategy: 'user_insert', error: errorDetails(insertResult.error) });
  } catch (error) {
    failures.push({ strategy: 'user_insert', error: errorDetails(error) });
  }

  if (auth.adminClient) {
    try {
      const insertResult = await insertUserRow(auth.adminClient, auth.user, traceId, 'admin');
      if (insertResult.data?.id || !insertResult.error) return 'created_admin';
      failures.push({ strategy: 'admin_insert', error: errorDetails(insertResult.error) });
    } catch (error) {
      failures.push({ strategy: 'admin_insert', error: errorDetails(error) });
    }
  }

  const finalUserResult = await findUserRow(auth.adminClient ?? auth.userClient, auth.user.id, traceId, 'final');
  if (finalUserResult.data?.id) return 'created_race';

  logLegal(traceId, 'unable to ensure users row before legal acceptance save', { failures });
  throw new Error(`Unable to create users row required by legal acceptances: ${JSON.stringify(failures)}`);
}

async function selectRequiredDocs(client: SupabaseClient, requestedIds: string[], traceId: string, source: string) {
  const { data, error } = await client
    .from('legal_documents')
    .select('id,version,is_active,is_required')
    .in('id', requestedIds)
    .eq('is_active', true)
    .eq('is_required', true);

  logLegal(traceId, `required legal documents checked with ${source}`, {
    requestedCount: requestedIds.length,
    foundCount: data?.length ?? 0,
    error: error ? errorDetails(error) : null,
  });

  return { data, error };
}

async function saveRowsWithRpc(client: SupabaseClient, rows: LegalAcceptanceRow[], traceId: string) {
  for (const row of rows) {
    const result = await client.rpc('insert_user_legal_acceptance', {
      p_user_id: row.user_id,
      p_document_id: row.document_id,
      p_document_version: row.document_version,
      p_context: row.context,
    });

    if (result.error) {
      logLegal(traceId, 'rpc acceptance save failed', {
        documentId: row.document_id,
        error: errorDetails(result.error),
      });
      throw result.error;
    }

    logLegal(traceId, 'rpc acceptance save succeeded', {
      documentId: row.document_id,
      result: result.data ?? null,
    });
  }

  return 'rpc';
}

async function saveRowsWithTable(client: SupabaseClient, rows: LegalAcceptanceRow[], traceId: string, source: string) {
  const upsertResult = await client
    .from('user_legal_acceptances')
    .upsert(rows, { onConflict: 'user_id,document_id' });

  if (!upsertResult.error) {
    logLegal(traceId, `acceptances saved through ${source} bulk upsert`, { count: rows.length });
    return `${source}_bulk_upsert`;
  }

  logLegal(traceId, `${source} bulk upsert failed; trying row update/insert`, {
    error: errorDetails(upsertResult.error),
    count: rows.length,
  });

  for (const row of rows) {
    const existingResult = await client
      .from('user_legal_acceptances')
      .select('id')
      .eq('user_id', row.user_id)
      .eq('document_id', row.document_id)
      .order('accepted_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (existingResult.error) {
      logLegal(traceId, `${source} existing acceptance lookup failed`, {
        documentId: row.document_id,
        error: errorDetails(existingResult.error),
      });
      throw existingResult.error;
    }

    if (existingResult.data?.id) {
      const updateResult = await client
        .from('user_legal_acceptances')
        .update({
          document_version: row.document_version,
          context: row.context,
          accepted_at: row.accepted_at,
        })
        .eq('id', existingResult.data.id);

      if (updateResult.error) {
        logLegal(traceId, `${source} acceptance update failed`, {
          documentId: row.document_id,
          acceptanceId: existingResult.data.id,
          error: errorDetails(updateResult.error),
        });
        throw updateResult.error;
      }
      continue;
    }

    const insertResult = await client.from('user_legal_acceptances').insert(row);
    if (insertResult.error) {
      logLegal(traceId, `${source} acceptance insert failed`, {
        documentId: row.document_id,
        error: errorDetails(insertResult.error),
      });
      throw insertResult.error;
    }
  }

  logLegal(traceId, `acceptances saved through ${source} row fallback`, { count: rows.length });
  return `${source}_row_fallback`;
}

async function saveRows(auth: AuthedSupabase, rows: LegalAcceptanceRow[], traceId: string) {
  const failures: Array<{ strategy: string; error: ReturnType<typeof errorDetails> }> = [];

  try {
    return await saveRowsWithRpc(auth.userClient, rows, traceId);
  } catch (error) {
    failures.push({ strategy: 'user_rpc', error: errorDetails(error) });
  }

  try {
    return await saveRowsWithTable(auth.userClient, rows, traceId, 'user');
  } catch (error) {
    failures.push({ strategy: 'user_table', error: errorDetails(error) });
  }

  if (auth.adminClient) {
    try {
      return await saveRowsWithTable(auth.adminClient, rows, traceId, 'admin');
    } catch (error) {
      failures.push({ strategy: 'admin_table', error: errorDetails(error) });
    }
  }

  logLegal(traceId, 'all legal acceptance save strategies failed', { failures });
  throw new Error(`Legal acceptance save failed: ${JSON.stringify(failures)}`);
}

async function loadAcceptanceRows(auth: AuthedSupabase, traceId: string) {
  const userResult = await auth.userClient
    .from('user_legal_acceptances')
    .select('document_id,document_version,accepted_at,context')
    .eq('user_id', auth.user.id);

  logLegal(traceId, 'acceptance status loaded with user client', {
    userId: auth.user.id,
    count: userResult.data?.length ?? 0,
    error: userResult.error ? errorDetails(userResult.error) : null,
  });

  if (!userResult.error) {
    return { data: userResult.data ?? [], source: 'user' };
  }

  if (!auth.adminClient) {
    throw userResult.error;
  }

  const adminResult = await auth.adminClient
    .from('user_legal_acceptances')
    .select('document_id,document_version,accepted_at,context')
    .eq('user_id', auth.user.id);

  logLegal(traceId, 'acceptance status loaded with admin fallback', {
    userId: auth.user.id,
    count: adminResult.data?.length ?? 0,
    error: adminResult.error ? errorDetails(adminResult.error) : null,
  });

  if (adminResult.error) {
    throw adminResult.error;
  }

  return { data: adminResult.data ?? [], source: 'admin' };
}

export async function GET(req: NextRequest) {
  const traceId = createTraceId();
  try {
    const auth = await requireUser(req, traceId);
    if ('response' in auth) return auth.response;
    const unverifiedResponse = requireVerifiedEmail(auth, traceId);
    if (unverifiedResponse) return unverifiedResponse;

    const { data, source } = await loadAcceptanceRows(auth, traceId);

    return NextResponse.json({ success: true, acceptances: data, source, traceId }, { status: 200 });
  } catch (error) {
    console.error(`[legal-acceptances:${traceId}] status error`, errorDetails(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to load legal acceptance status.',
        details: errorDetails(error),
        traceId,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const traceId = createTraceId();
  try {
    const auth = await requireUser(req, traceId);
    if ('response' in auth) return auth.response;
    const unverifiedResponse = requireVerifiedEmail(auth, traceId);
    if (unverifiedResponse) return unverifiedResponse;

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
      hasAdminClient: Boolean(auth.adminClient),
    });

    if (requestedIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No legal documents selected.', traceId }, { status: 400 });
    }

    let docsResult = await selectRequiredDocs(auth.userClient, requestedIds, traceId, 'user');
    if (docsResult.error && auth.adminClient) {
      docsResult = await selectRequiredDocs(auth.adminClient, requestedIds, traceId, 'admin');
    }

    if (docsResult.error) throw docsResult.error;
    if (!docsResult.data || docsResult.data.length !== requestedIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more legal documents are no longer available.', traceId },
        { status: 400 }
      );
    }

    const userRowState = await ensureUserRow(auth, traceId);
    const now = new Date().toISOString();
    const rows: LegalAcceptanceRow[] = docsResult.data.map((doc) => ({
      user_id: auth.user.id,
      document_id: doc.id,
      document_version: doc.version || '1.0.0',
      context: 'signup',
      accepted_at: now,
    }));

    const saveStrategy = await saveRows(auth, rows, traceId);

    return NextResponse.json(
      {
        success: true,
        acceptedCount: rows.length,
        saveStrategy,
        userRowState,
        traceId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[legal-acceptances:${traceId}] save error`, errorDetails(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to save legal acceptance.',
        details: errorDetails(error),
        traceId,
      },
      { status: 500 }
    );
  }
}
