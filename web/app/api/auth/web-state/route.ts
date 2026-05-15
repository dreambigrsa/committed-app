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

type WebStateStep = 'verify-email' | 'legal' | 'ai-consent' | 'ready';
type AuthedWebRequest = {
  userClient: SupabaseClient;
  admin: SupabaseClient | null;
  user: SupabaseUser;
  accessToken: string;
};

function legalKey(documentId: string, version: unknown) {
  return `${documentId}:${String(version || '1.0.0').trim()}`;
}

function traceId() {
  return `web-state-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function logState(id: string, message: string, payload: Record<string, unknown> = {}) {
  console.log(`[auth-web-state:${id}] ${message}`, payload);
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

function tryAdmin(id: string) {
  try {
    return createSupabaseAdmin();
  } catch (error) {
    logState(id, 'service role unavailable; using user-scoped state checks', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function syncVerifiedProfile(client: SupabaseClient, user: SupabaseUser, id: string, verifiedAt?: string | null) {
  const email = (user.email || '').trim().toLowerCase();
  const timestamp = verifiedAt || new Date().toISOString();
  const { error: profileError } = await client
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email,
        is_verified: true,
        verified_at: timestamp,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  const { error } = await client
    .from('users')
    .update({
      email,
      email_verified: true,
      verified: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  logState(id, 'profile verification flags sync attempted', {
    userId: user.id,
    profileError: profileError?.message ?? null,
    error: error?.message ?? null,
  });
}

async function hasProductEmailVerification(client: SupabaseClient, user: SupabaseUser, id: string) {
  const email = (user.email || '').trim().toLowerCase();
  if (!email) return false;
  const hasConfirmedAuthEmail = Boolean(user.email_confirmed_at);

  const profileResult = await client
    .from('profiles')
    .select('is_verified,verified_at')
    .eq('id', user.id)
    .maybeSingle();

  logState(id, 'product verification profile checked', {
    userId: user.id,
    email,
    isVerified: profileResult.data?.is_verified ?? false,
    verifiedAt: profileResult.data?.verified_at ?? null,
    error: profileResult.error?.message ?? null,
  });

  if (profileResult.error) throw profileResult.error;
  if (profileResult.data?.is_verified === true && hasConfirmedAuthEmail) return true;

  const result = await client
    .from('auth_tokens')
    .select('id,used_at')
    .eq('type', 'verify_email')
    .or(`user_id.eq.${user.id},email.eq.${email}`)
    .not('used_at', 'is', null)
    .order('used_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  logState(id, 'committed verification token checked', {
    userId: user.id,
    email,
    hasUsedToken: Boolean(result.data?.used_at),
    usedAt: result.data?.used_at ?? null,
    error: result.error?.message ?? null,
  });

  if (result.error) throw result.error;
  const verifiedByToken = Boolean(result.data?.used_at);
  if (verifiedByToken) {
    await syncVerifiedProfile(client, user, id, result.data?.used_at ?? null);
  }
  if (verifiedByToken && !hasConfirmedAuthEmail) {
    logState(id, 'product verification token exists but auth email is not confirmed in current session', {
      userId: user.id,
      email,
      emailConfirmedAt: user.email_confirmed_at ?? null,
    });
  }
  return verifiedByToken && hasConfirmedAuthEmail;
}

async function loadRequiredDocs(client: SupabaseClient, id: string) {
  const result = await client
    .from('legal_documents')
    .select('id,title,slug,content,version')
    .eq('is_active', true)
    .eq('is_required', true)
    .order('created_at', { ascending: true });

  logState(id, 'required legal documents loaded', {
    count: result.data?.length ?? 0,
    error: result.error?.message ?? null,
  });

  if (result.error) throw result.error;
  return result.data ?? [];
}

async function loadAcceptances(client: SupabaseClient, userId: string, id: string) {
  const result = await client
    .from('user_legal_acceptances')
    .select('document_id,document_version')
    .eq('user_id', userId);

  logState(id, 'legal acceptances loaded', {
    userId,
    count: result.data?.length ?? 0,
    error: result.error?.message ?? null,
  });

  if (result.error) throw result.error;
  return result.data ?? [];
}

async function loadOnboarding(client: SupabaseClient, userId: string, id: string) {
  const result = await client
    .from('user_onboarding_data')
    .select('has_completed_onboarding,consent_given')
    .eq('user_id', userId)
    .maybeSingle();

  logState(id, 'onboarding state loaded', {
    userId,
    hasCompletedOnboarding: result.data?.has_completed_onboarding ?? false,
    consentGiven: result.data?.consent_given ?? false,
    error: result.error?.message ?? null,
  });

  if (result.error) throw result.error;
  return result.data;
}

async function requireWebAuth(req: NextRequest, id: string): Promise<AuthedWebRequest | NextResponse> {
  const authHeader = req.headers.get('Authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  logState(id, 'request received', {
    path: new URL(req.url).pathname,
    hasBearerToken: Boolean(accessToken),
    reason: req.headers.get('x-committed-auth-flow') || 'unspecified',
  });

  if (!accessToken) {
    return NextResponse.json({ success: false, step: 'verify-email', error: 'Missing auth session.', traceId: id }, { status: 401 });
  }

  const userClient = createUserClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(accessToken);

  logState(id, 'auth user checked', {
    hasUser: Boolean(user?.id),
    userId: user?.id ?? null,
    email: user?.email ?? null,
    emailConfirmedAt: user?.email_confirmed_at ?? null,
    error: userError?.message ?? null,
  });

  if (userError || !user?.id) {
    return NextResponse.json({ success: false, step: 'verify-email', error: 'Invalid auth session.', traceId: id }, { status: 401 });
  }

  const admin = tryAdmin(id);
  return { userClient, admin, user, accessToken };
}

async function resolveWebState(auth: AuthedWebRequest, id: string) {
  const readClient = auth.admin ?? auth.userClient;
  const isEmailVerified = auth.admin
    ? await hasProductEmailVerification(auth.admin, auth.user, id)
    : false;
  if (!isEmailVerified) {
    const response = {
      success: true,
      step: 'verify-email' as WebStateStep,
      user: { id: auth.user.id, email: auth.user.email ?? null, email_confirmed_at: auth.user.email_confirmed_at ?? null },
      traceId: id,
    };
    logState(id, 'decision', { step: response.step, reason: 'product_email_not_verified' });
    return response;
  }

  const [requiredDocs, acceptances, onboarding] = await Promise.all([
    loadRequiredDocs(readClient, id),
    loadAcceptances(readClient, auth.user.id, id),
    loadOnboarding(readClient, auth.user.id, id),
  ]);

    const accepted = new Set(acceptances.map((row: any) => legalKey(row.document_id, row.document_version)));
    const missingLegalDocs = requiredDocs.filter((doc: any) => {
      const key = legalKey(doc.id, doc.version);
      return !accepted.has(key);
    });
    const hasMissingLegal = missingLegalDocs.length > 0;
    const step: WebStateStep = hasMissingLegal
      ? 'legal'
      : !onboarding?.has_completed_onboarding || !onboarding?.consent_given
        ? 'ai-consent'
        : 'ready';

    logState(id, 'decision', {
      step,
      reason: hasMissingLegal ? 'missing_legal' : step === 'ai-consent' ? 'missing_ai_consent' : 'ready',
      requiredCount: requiredDocs.length,
      acceptanceCount: acceptances.length,
      missingDocuments: missingLegalDocs.map((doc: any) => legalKey(doc.id, doc.version)),
    });

  return {
    success: true,
    step,
    user: { id: auth.user.id, email: auth.user.email ?? null, email_confirmed_at: auth.user.email_confirmed_at },
    requiredDocs,
    acceptedDocuments: acceptances.map((row: any) => legalKey(row.document_id, row.document_version)),
    onboarding: {
      has_completed_onboarding: onboarding?.has_completed_onboarding ?? false,
      consent_given: onboarding?.consent_given ?? false,
    },
    traceId: id,
  };
}

export async function GET(req: NextRequest) {
  const id = traceId();
  try {
    const auth = await requireWebAuth(req, id);
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json(await resolveWebState(auth, id), { status: 200 });
  } catch (error) {
    console.error(`[auth-web-state:${id}] error`, error);
    return NextResponse.json(
      {
        success: false,
        step: 'verify-email',
        error: error instanceof Error ? error.message : 'Unable to load auth state.',
        traceId: id,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const id = traceId();
  try {
    const auth = await requireWebAuth(req, id);
    if (auth instanceof NextResponse) return auth;
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const before = await resolveWebState(auth, id);

    logState(id, 'post action received', {
      action: body.action ?? null,
      currentStep: before.step,
      userId: auth.user.id,
    });

    if (body.action !== 'complete_ai_consent') {
      return NextResponse.json({ success: false, error: 'Unsupported action.', traceId: id }, { status: 400 });
    }

    if (before.step !== 'ai-consent' && before.step !== 'ready') {
      return NextResponse.json(
        {
          success: false,
          error: before.step === 'verify-email'
            ? 'Please verify your email before onboarding.'
            : 'Please accept legal documents before onboarding.',
          state: before,
          traceId: id,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const writer = auth.admin ?? auth.userClient;
    const { error: upsertError } = await writer
      .from('user_onboarding_data')
      .upsert(
        {
          user_id: auth.user.id,
          has_completed_onboarding: true,
          onboarding_version: '1.0.0',
          ai_explanation_viewed: true,
          consent_given: true,
          consent_given_at: now,
          completed_at: now,
        },
        { onConflict: 'user_id' }
      );

    logState(id, 'ai consent persistence attempted', {
      userId: auth.user.id,
      error: upsertError?.message ?? null,
    });

    if (upsertError) throw upsertError;

    const state = await resolveWebState(auth, id);
    return NextResponse.json({ success: true, state, traceId: id }, { status: 200 });
  } catch (error) {
    console.error(`[auth-web-state:${id}] post error`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to update onboarding state.',
        traceId: id,
      },
      { status: 500 }
    );
  }
}
