'use client';

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, CheckCircle2, FileText, HeartHandshake, Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { usersRowBootstrapFromAuth } from '@/lib/web-user-profile';

type LegalDoc = {
  id: string;
  title: string;
  slug: string;
  content?: string;
  version: string;
};

type GateStep = 'loading' | 'verify-email' | 'legal' | 'ai-consent' | 'ready' | 'error';

type WebStateResponse = {
  success?: boolean;
  step?: GateStep;
  error?: string;
  traceId?: string;
  user?: {
    id?: string | null;
    email?: string | null;
    email_confirmed_at?: string | null;
  };
  requiredDocs?: LegalDoc[];
  acceptedDocuments?: string[];
  onboarding?: {
    has_completed_onboarding?: boolean | null;
    consent_given?: boolean | null;
  };
};

const AI_ONBOARDING_VERSION = '1.0.0';

const aiSteps = [
  {
    icon: Sparkles,
    title: 'What Committed AI can do',
    text: 'Committed AI can provide general relationship guidance, communication ideas, and support prompts.',
  },
  {
    icon: ShieldCheck,
    title: 'What Committed AI cannot do',
    text: 'It does not provide medical, psychiatric, emergency, legal, or licensed professional services.',
  },
  {
    icon: Bot,
    title: 'Human help stays available',
    text: 'When a deeper concern appears, AI may suggest verified professionals. You stay in control.',
  },
];

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

function debugAuth(label: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(label, payload);
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function legalKey(documentId: string, version: unknown) {
  return `${documentId}:${String(version || '1.0.0').trim()}`;
}

async function syncVerifiedEmail(email: string) {
  if (!email) return false;
  try {
    const res = await fetch(`/api/auth/verification-status?email=${encodeURIComponent(email)}`, {
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as { verified?: boolean; source?: string };
    debugAuth('[WebAppGate] Email verification status API response', {
      email,
      verified: data.verified === true,
      source: data.source ?? null,
    });
    return data.verified === true;
  } catch (err) {
    debugAuth('[WebAppGate] Email verification sync failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

async function ensureBrowserUserRow(supabase: any, authUser: any) {
  if (!authUser?.id) return false;
  try {
    const { data: existing, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .maybeSingle();
    debugAuth('[WebAppGate] Browser users row check before legal fallback', {
      userId: authUser.id,
      found: Boolean(existing?.id),
      error: findError?.message ?? null,
    });
    if (existing?.id) return true;

    const { error: upsertError } = await supabase
      .from('users')
      .upsert(usersRowBootstrapFromAuth(authUser), { onConflict: 'id', ignoreDuplicates: true });
    debugAuth('[WebAppGate] Browser users row repair before legal fallback', {
      userId: authUser.id,
      error: upsertError?.message ?? null,
    });
    if (upsertError) return false;

    const { data: repaired } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .maybeSingle();
    return Boolean(repaired?.id);
  } catch (err) {
    debugAuth('[WebAppGate] Browser users row repair failed before legal fallback', {
      userId: authUser.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

async function loadServerWebState(accessToken: string, reason = 'manual'): Promise<WebStateResponse> {
  const res = await fetch('/api/auth/web-state', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Committed-Auth-Flow': reason,
    },
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as WebStateResponse;
  debugAuth('[WebAppGate] Server web state response', {
    ok: res.ok,
    success: data.success,
    step: data.step ?? null,
    traceId: data.traceId ?? null,
    error: data.error ?? null,
    requiredCount: data.requiredDocs?.length ?? 0,
    acceptedCount: data.acceptedDocuments?.length ?? 0,
    emailConfirmedAt: data.user?.email_confirmed_at ?? null,
    reason,
  });
  if (!res.ok || data.success === false) {
    throw new Error(data.error || 'Unable to load account access state.');
  }
  return data;
}

export default function WebAppGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [step, setStep] = useState<GateStep>('loading');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [requiredDocs, setRequiredDocs] = useState<LegalDoc[]>([]);
  const [acceptedDocIds, setAcceptedDocIds] = useState<string[]>([]);
  const [checkedDocIds, setCheckedDocIds] = useState<string[]>([]);
  const [aiStep, setAiStep] = useState(0);
  const [aiConsentChecked, setAiConsentChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const loadStateInFlightRef = useRef<Promise<WebStateResponse | null> | null>(null);
  const loadStateSeqRef = useRef(0);

  const missingDocs = useMemo(() => {
    const accepted = new Set(acceptedDocIds);
    return requiredDocs.filter((doc) => {
      const id = String(doc.id);
      return !accepted.has(legalKey(id, doc.version));
    });
  }, [requiredDocs, acceptedDocIds]);

  const checkedSet = useMemo(() => new Set(checkedDocIds.map(String)), [checkedDocIds]);
  const allMissingChecked = missingDocs.length > 0 && missingDocs.every((doc) => checkedSet.has(String(doc.id)));

  const setLegalDocChecked = useCallback((docId: string, checked: boolean) => {
    const normalizedId = String(docId);
    setCheckedDocIds((current) => {
      const next = new Set(current.map(String));
      if (checked) {
        next.add(normalizedId);
      } else {
        next.delete(normalizedId);
      }
      return Array.from(next);
    });
  }, []);

  const toggleLegalDocChecked = useCallback((docId: string) => {
    const normalizedId = String(docId);
    setCheckedDocIds((current) => {
      const next = new Set(current.map(String));
      if (next.has(normalizedId)) {
        next.delete(normalizedId);
      } else {
        next.add(normalizedId);
      }
      return Array.from(next);
    });
  }, []);

  const resolveAuthSnapshot = useCallback(async () => {
    const supabase = getSupabaseBrowser() as any;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const [
        {
          data: { user: authUser },
          error: userError,
        },
        {
          data: { session },
        },
      ] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
      const resolvedUser = authUser || session?.user || null;
      if (resolvedUser) {
        return { authUser: resolvedUser, session, userError: null };
      }
      if (attempt < 2) {
        await new Promise((resolve) => window.setTimeout(resolve, 150));
      } else {
        return { authUser: null, session: null, userError };
      }
    }
    return { authUser: null, session: null, userError: null };
  }, []);

  const loadState = useCallback((opts?: { force?: boolean; reason?: string }) => {
    const reason = opts?.reason ?? 'manual';
    if (loadStateInFlightRef.current && !opts?.force) return loadStateInFlightRef.current;
    const requestSeq = loadStateSeqRef.current + 1;
    loadStateSeqRef.current = requestSeq;
    const isCurrentRequest = () => requestSeq === loadStateSeqRef.current;
    const request = (async () => {
    setError('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const { authUser, session, userError } = await withTimeout(resolveAuthSnapshot(), 10000, 'Loading web auth session');

      debugAuth('[WebAppGate] Authenticated user object', {
        id: authUser?.id ?? null,
        email: authUser?.email ?? null,
        sessionUserId: session?.user?.id ?? null,
        currentRoute: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : null,
        error: userError?.message ?? null,
        reason,
      });

      if (!authUser) {
        if (!isCurrentRequest()) return null;
        const requestedPath =
          typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}`
            : '/app';
        router.replace(`/sign-in?redirect=${encodeURIComponent(requestedPath)}`);
        return null;
      }

      const currentUserId = authUser.id;
      const currentEmail = authUser.email ?? '';
      if (isCurrentRequest()) {
        setUserId(currentUserId);
        setEmail(currentEmail);
      }

      let activeSession = session;
      if (!activeSession?.access_token && session?.refresh_token) {
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession();
        activeSession = refreshedSession;
        debugAuth('[WebAppGate] Missing access token session refresh response', {
          refreshed: Boolean(refreshedSession?.access_token),
          error: refreshError?.message ?? null,
          reason,
        });
      }

      if (!activeSession?.access_token) {
        if (!isCurrentRequest()) return null;
        router.replace(`/sign-in?redirect=${encodeURIComponent('/app')}`);
        return null;
      }

      const webState = await withTimeout(
        loadServerWebState(activeSession.access_token, reason),
        12000,
        'Loading web access state'
      );

      if (!isCurrentRequest()) {
        debugAuth('[WebAppGate] Ignoring stale web state response', {
          reason,
          step: webState.step ?? null,
          traceId: webState.traceId ?? null,
        });
        return webState;
      }

      setEmail(webState.user?.email ?? currentEmail);

      if (webState.step === 'verify-email') {
        const targetEmail = webState.user?.email ?? currentEmail;
        const emailParam = targetEmail ? `?email=${encodeURIComponent(targetEmail)}` : '';
        router.replace(`/verify-email${emailParam}`);
        return webState;
      }

      const legalDocs = webState.requiredDocs ?? [];
      const accepted = webState.acceptedDocuments ?? [];
      debugAuth('[WebAppGate] Legal gate decision', {
        requiredDocuments: legalDocs.map((doc) => legalKey(doc.id, doc.version)),
        acceptedDocuments: accepted,
        missingCount: legalDocs.filter((doc) => !accepted.includes(legalKey(doc.id, doc.version))).length,
        sessionExists: Boolean(activeSession.access_token),
        serverStep: webState.step ?? null,
        traceId: webState.traceId ?? null,
        reason,
      });
      setRequiredDocs(legalDocs);
      setAcceptedDocIds(accepted);
      setCheckedDocIds([]);

      if (webState.step === 'legal') {
        setStep('legal');
        return webState;
      }

      if (webState.step === 'ai-consent') {
        setStep('ai-consent');
        return webState;
      }

      setStep('ready');
      return webState;
    } catch (err) {
      if (isCurrentRequest()) {
        setError(err instanceof Error ? err.message : 'Unable to load onboarding state.');
        setStep('error');
      }
      return null;
    }
    })();
    loadStateInFlightRef.current = request.finally(() => {
      loadStateInFlightRef.current = null;
    });
    return loadStateInFlightRef.current;
  }, [resolveAuthSnapshot, router]);

  useEffect(() => {
    void loadState({ reason: 'mount' });
  }, [loadState]);

  useEffect(() => {
    const supabase = getSupabaseBrowser() as any;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void loadState({ reason: `auth_event_${event}` });
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [loadState]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadState({ reason: 'visibility_visible' });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadState]);

  const resendVerification = async () => {
    if (!email || saving) return;
    setSaving(true);
    setError('');
    try {
      await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend verification email.');
    } finally {
      setSaving(false);
    }
  };

  const acceptLegal = async () => {
    if (!userId || !allMissingChecked || saving) return;
    setSaving(true);
    setError('');
    try {
      const supabase = getSupabaseBrowser() as any;
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession();
        debugAuth('[WebAppGate] Legal save session refresh attempted', {
          refreshed: Boolean(refreshedSession?.access_token),
          error: refreshError?.message ?? null,
        });
        session = refreshedSession;
      }
      if (!session?.access_token) {
        throw new Error('Your session expired. Please sign in again.');
      }
      const emailVerifiedBeforeSave = email ? await syncVerifiedEmail(email) : false;
      if (!emailVerifiedBeforeSave) {
        const emailParam = email ? `?email=${encodeURIComponent(email)}` : '';
        router.replace(`/verify-email${emailParam}`);
        throw new Error('Please verify your email before accepting legal documents.');
      }
      const documents = missingDocs.map((doc) => ({
        documentId: doc.id,
        documentVersion: doc.version,
      }));
      debugAuth('[WebAppGate] Saving legal acceptances', {
        userId,
        documents,
        sessionExists: Boolean(session.access_token),
      });
      const res = await fetch('/api/legal/acceptances', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documents }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        acceptedCount?: number;
        acceptedDocuments?: string[];
        hasAllRequiredLegal?: boolean;
        nextStep?: GateStep;
        missingRequiredDocuments?: LegalDoc[];
        saveStrategy?: string;
        traceId?: string;
        details?: { message?: string; code?: string; hint?: string; details?: string };
      };
      debugAuth('[WebAppGate] Legal save API response', {
        ok: res.ok,
        success: data.success,
        acceptedCount: data.acceptedCount ?? null,
        acceptedDocuments: data.acceptedDocuments ?? null,
        hasAllRequiredLegal: data.hasAllRequiredLegal ?? null,
        nextStep: data.nextStep ?? null,
        missingRequiredDocuments: data.missingRequiredDocuments?.map((doc) => legalKey(doc.id, doc.version)) ?? null,
        saveStrategy: data.saveStrategy ?? null,
        error: data.error ?? null,
        traceId: data.traceId ?? null,
      });
      if (!res.ok || data.success === false) {
        debugAuth('[WebAppGate] Legal save API failed; trying browser fallback', {
          status: res.status,
          error: data.error ?? null,
          details: data.details ?? null,
          traceId: data.traceId ?? null,
        });
        const userReady = await ensureBrowserUserRow(supabase, session.user);
        if (!userReady) {
          const reference = data.traceId ? ` Reference: ${data.traceId}.` : '';
          const apiDetail = data.details?.message ? ` ${data.details.message}` : '';
          throw new Error(`${data.error || 'Unable to save legal acceptance.'}${apiDetail}${reference}`);
        }
        const acceptedDocs = missingDocs.map((doc) => ({
          user_id: userId,
          document_id: doc.id,
          document_version: doc.version || '1.0.0',
          context: 'signup',
          accepted_at: new Date().toISOString(),
        }));

        for (const row of acceptedDocs) {
          let saved = false;
          try {
            const rpcResult = await supabase.rpc('insert_user_legal_acceptance', {
              p_user_id: row.user_id,
              p_document_id: row.document_id,
              p_document_version: row.document_version,
              p_context: row.context,
            });
            if (!rpcResult.error) saved = true;
          } catch {
            // Fall through to direct upsert.
          }

          if (!saved) {
            const { error: upsertError } = await supabase
              .from('user_legal_acceptances')
              .upsert(row, { onConflict: 'user_id,document_id' });
            if (upsertError) {
              const reference = data.traceId ? ` Reference: ${data.traceId}.` : '';
              const apiDetail = data.details?.message ? ` API detail: ${data.details.message}.` : '';
              throw new Error(
                `${upsertError.message || data.error || 'Unable to save legal acceptance.'}${apiDetail}${reference}`
              );
            }
          }
        }
      }
      const savedDocuments =
        Array.isArray(data.acceptedDocuments) && data.acceptedDocuments.length > 0
          ? data.acceptedDocuments
          : missingDocs.map((doc) => legalKey(doc.id, doc.version));
      setAcceptedDocIds((current) => Array.from(new Set([...current, ...savedDocuments])));
      setStep('loading');

      let latestState: WebStateResponse | null = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (attempt > 0) {
          await delay([300, 800, 1500][attempt - 1] ?? 1500);
        }
        latestState = await loadState({
          force: true,
          reason: `legal_acceptance_post_save_attempt_${attempt + 1}`,
        });
        debugAuth('[WebAppGate] Post-legal transition check', {
          attempt: attempt + 1,
          step: latestState?.step ?? null,
          traceId: latestState?.traceId ?? null,
          acceptedDocuments: latestState?.acceptedDocuments ?? null,
          savedDocuments,
        });
        if (latestState?.step && latestState.step !== 'legal') {
          break;
        }
      }

      if (latestState?.step === 'legal') {
        if (data.hasAllRequiredLegal === true && (data.nextStep === 'ai-consent' || data.nextStep === 'ready')) {
          debugAuth('[WebAppGate] Legal API confirmed full acceptance; using API next step after stale web-state legal response', {
            apiTraceId: data.traceId ?? null,
            webStateTraceId: latestState.traceId ?? null,
            apiNextStep: data.nextStep,
            apiAcceptedDocuments: data.acceptedDocuments ?? null,
          });
          setRequiredDocs((current) => current.filter((doc) => !savedDocuments.includes(legalKey(doc.id, doc.version))));
          setCheckedDocIds([]);
          setStep(data.nextStep);
          return;
        }
        const missingFromApi = data.missingRequiredDocuments?.length
          ? ` Missing: ${data.missingRequiredDocuments.map((doc) => legalKey(doc.id, doc.version)).join(', ')}.`
          : '';
        throw new Error(
          `Legal acceptance saved, but account state still reports missing legal documents.${missingFromApi} Please try again. Reference: ${latestState.traceId ?? data.traceId ?? 'post-legal-refresh'}.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save legal acceptance.');
    } finally {
      setSaving(false);
    }
  };

  const acceptAiConsent = async () => {
    if (!userId || !aiConsentChecked || saving) return;
    setSaving(true);
    setError('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const now = new Date().toISOString();
      const { error: upsertError } = await supabase
        .from('user_onboarding_data')
        .upsert(
          {
            user_id: userId,
            has_completed_onboarding: true,
            onboarding_version: AI_ONBOARDING_VERSION,
            ai_explanation_viewed: true,
            consent_given: true,
            consent_given_at: now,
            completed_at: now,
          },
          { onConflict: 'user_id' }
        );
      if (upsertError) throw upsertError;
      await loadState({ force: true, reason: 'ai_consent_complete' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save Committed AI consent.');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'ready') return <>{children}</>;

  const stepMeta =
    step === 'verify-email'
      ? {
          eyebrow: 'Secure account',
          title: 'Verify your email to continue.',
          text: 'One confirmation keeps your account, relationship records, and trust signals tied to the right person.',
        }
      : step === 'legal'
        ? {
            eyebrow: 'Consent and records',
            title: 'Review the essentials before entering.',
            text: 'Required documents keep privacy, consent, and relationship records explicit across web and mobile.',
          }
        : step === 'ai-consent'
          ? {
              eyebrow: 'Committed AI',
              title: 'Understand AI support before using it.',
              text: 'AI support is useful for guidance and next steps, while human help remains available when needed.',
            }
          : step === 'error'
            ? {
                eyebrow: 'Account check',
                title: 'Something needs attention.',
                text: 'We could not finish this account step yet. Try again so the web app can continue safely.',
              }
            : {
                eyebrow: 'Preparing access',
                title: 'Setting up your web app.',
                text: 'We are checking your account, verification, documents, and onboarding status.',
              };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <Image
        src="/hero/committed-trust-hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-slate-950/78" />
      <div className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(2,6,23,0.94),rgba(2,6,23,0.76)_48%,rgba(2,6,23,0.38)_100%)]" />

      <section className="relative mx-auto grid min-h-screen max-w-7xl gap-8 px-4 py-8 sm:px-5 sm:py-10 md:px-8 lg:grid-cols-[0.9fr_0.72fr] lg:items-center lg:gap-16">
        <div className="order-2 min-w-0 lg:order-1">
          <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-black uppercase text-teal-100 shadow-lg shadow-slate-950/10 backdrop-blur-md sm:text-sm">
            <ShieldCheck className="h-4 w-4" />
            {stepMeta.eyebrow}
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-black leading-[1.13] tracking-normal text-balance sm:mt-6 sm:text-5xl sm:leading-[1.08] lg:text-6xl lg:leading-[1.04]">
            {stepMeta.title}
          </h1>
          <p className="mt-4 max-w-xl text-base font-semibold leading-8 text-slate-200 sm:mt-6 sm:text-lg sm:leading-8">
            {stepMeta.text}
          </p>

          <div className="mt-7 grid gap-3 rounded-lg border border-white/14 bg-white/10 p-2 shadow-2xl shadow-slate-950/15 backdrop-blur-md sm:mt-9">
            {[
              { label: 'Email', active: step !== 'loading', done: step !== 'verify-email' && step !== 'loading' && step !== 'error' },
              { label: 'Documents', active: step === 'legal' || step === 'ai-consent', done: step === 'ai-consent' },
              { label: 'AI consent', active: step === 'ai-consent', done: false },
            ].map((item, index) => (
              <div key={item.label} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 rounded-md p-4 text-slate-100 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-4 sm:p-5">
                <span className={`grid h-11 w-11 place-items-center rounded-md text-sm font-black ${item.done ? 'bg-teal-400 text-slate-950' : item.active ? 'bg-white text-slate-950' : 'bg-white/10 text-slate-300'}`}>
                  {item.done ? <CheckCircle2 className="h-5 w-5" /> : `0${index + 1}`}
                </span>
                <div className="min-w-0">
                  <p className={`text-base font-black leading-6 ${item.active || item.done ? 'text-white' : 'text-slate-400'}`}>{item.label}</p>
                  <div className={`mt-3 h-1.5 rounded-full ${item.done ? 'bg-teal-400' : item.active ? 'bg-white' : 'bg-white/15'}`} />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 inline-flex items-center gap-2 text-sm font-black text-teal-200">
            <HeartHandshake className="h-4 w-4" />
            Built for trust before connection.
          </p>
        </div>

        <div className="order-1 mx-auto w-full max-w-[520px] overflow-hidden rounded-xl border border-white/18 bg-white/95 p-2 text-slate-950 shadow-2xl shadow-slate-950/35 backdrop-blur-xl lg:order-2">
          <div className="rounded-lg bg-white p-5 text-center sm:p-7 md:p-8">
        {step === 'loading' && (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-slate-950 text-teal-300 shadow-lg shadow-slate-950/10">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-normal text-slate-950">Preparing your web app</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Checking your account safely.</p>
          </>
        )}

        {step === 'verify-email' && (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-slate-950 text-teal-300 shadow-lg shadow-slate-950/10">
              <Mail className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">Verify your email first</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-600">
              We need to confirm your email before legal documents, AI consent, and the web app open.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={resendVerification}
                disabled={saving}
                className="inline-flex min-h-[54px] items-center justify-center rounded-md bg-teal-500 px-6 py-3 font-black text-slate-950 shadow-lg shadow-teal-950/10 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Sending...' : 'Resend verification'}
              </button>
              <Link
                href={`/verify-email?email=${encodeURIComponent(email)}`}
                className="inline-flex min-h-[54px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-6 py-3 font-black text-slate-800 transition hover:border-teal-300 hover:bg-teal-50"
              >
                View instructions
              </Link>
            </div>
          </>
        )}

        {step === 'legal' && (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-slate-950 text-teal-300 shadow-lg shadow-slate-950/10">
              <FileText className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">Legal documents</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-600">
              Please review and accept the required documents before continuing.
            </p>
            <div className="mt-8 space-y-3 text-left">
              {missingDocs.map((doc) => (
                <div
                  key={doc.id}
                  role="checkbox"
                  aria-checked={checkedSet.has(String(doc.id))}
                  tabIndex={0}
                  onClick={() => toggleLegalDocChecked(doc.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleLegalDocChecked(doc.id);
                    }
                  }}
                  className={`group flex cursor-pointer gap-4 rounded-lg border p-4 text-left transition ${
                    checkedSet.has(String(doc.id))
                      ? 'border-teal-400 bg-teal-50/70'
                      : 'border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-teal-50/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checkedSet.has(String(doc.id))}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      setLegalDocChecked(doc.id, event.target.checked);
                    }}
                    className="mt-1 h-5 w-5 rounded border-slate-300 accent-teal-500"
                  />
                  <span>
                    <span className="block font-black text-slate-950">{doc.title}</span>
                    <span className="mt-1 block text-sm font-semibold text-slate-500">Version {doc.version}</span>
                    <Link
                      href={`/legal/${doc.slug}`}
                      onClick={(event) => event.stopPropagation()}
                      className="mt-2 inline-block text-sm font-black text-teal-700 hover:text-teal-900"
                    >
                      View full document
                    </Link>
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={acceptLegal}
              disabled={!allMissingChecked || saving}
              className="mt-8 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-md bg-teal-500 px-6 py-3 font-black text-slate-950 shadow-lg shadow-teal-950/10 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Accept and continue'}
              {!saving ? <ArrowRight className="h-5 w-5" /> : null}
            </button>
          </>
        )}

        {step === 'ai-consent' && (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-slate-950 text-teal-300 shadow-lg shadow-slate-950/10">
              <Sparkles className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">Committed AI consent</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-600">
              Review how Committed AI supports you before using AI-powered help.
            </p>
            <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5 text-left sm:p-6">
              {(() => {
                const item = aiSteps[aiStep];
                const Icon = item.icon;
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-teal-500 text-slate-950 shadow-sm">
                        <Icon className="h-6 w-6" />
                      </span>
                      <h2 className="text-lg font-black leading-6 text-slate-950 sm:text-xl">{item.title}</h2>
                    </div>
                    <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">{item.text}</p>
                  </>
                );
              })()}
            </div>
            <div className="mt-5 flex justify-center gap-2">
              {aiSteps.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setAiStep(index)}
                  className={`h-2.5 rounded-full transition-all ${index === aiStep ? 'w-8 bg-teal-500' : 'w-2.5 bg-slate-300'}`}
                  aria-label={`Go to AI consent step ${index + 1}`}
                />
              ))}
            </div>
            {aiStep === aiSteps.length - 1 && (
              <label className="mt-6 flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4 text-left">
                <input
                  type="checkbox"
                  checked={aiConsentChecked}
                  onChange={(event) => setAiConsentChecked(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 accent-teal-500"
                />
                <span className="font-black text-slate-800">I understand and consent to Committed AI support.</span>
              </label>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {aiStep > 0 && (
                <button
                  type="button"
                  onClick={() => setAiStep((value) => Math.max(0, value - 1))}
                  className="min-h-[54px] flex-1 rounded-md border border-slate-200 bg-slate-50 px-6 py-3 font-black text-slate-800 transition hover:border-teal-300 hover:bg-teal-50"
                >
                  Back
                </button>
              )}
              {aiStep < aiSteps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setAiStep((value) => Math.min(aiSteps.length - 1, value + 1))}
                  className="min-h-[54px] flex-1 rounded-md bg-teal-500 px-6 py-3 font-black text-slate-950 shadow-lg shadow-teal-950/10 transition hover:bg-teal-300"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={acceptAiConsent}
                  disabled={!aiConsentChecked || saving}
                  className="min-h-[54px] flex-1 rounded-md bg-teal-500 px-6 py-3 font-black text-slate-950 shadow-lg shadow-teal-950/10 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Accept and enter web app'}
                </button>
              )}
            </div>
          </>
        )}

        {step === 'error' && (
          <>
            <h1 className="text-2xl font-black tracking-normal text-slate-950">Something needs attention</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => {
                void loadState({ force: true, reason: 'error_retry' });
              }}
              className="mt-6 min-h-[54px] rounded-md bg-teal-500 px-6 py-3 font-black text-slate-950 transition hover:bg-teal-300"
            >
              Try again
            </button>
          </>
        )}

        {error && step !== 'error' ? <p className="mt-5 text-sm font-semibold text-red-600">{error}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
