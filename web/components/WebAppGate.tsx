'use client';

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, CheckCircle2, FileText, HeartHandshake, Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-client';

type LegalDoc = {
  id: string;
  title: string;
  slug: string;
  content?: string;
  version: string;
};

type GateStep = 'loading' | 'verify-email' | 'legal' | 'ai-consent' | 'ready' | 'error';

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

async function loadLegalAcceptances(
  supabase: any,
  accessToken: string | undefined,
  userId: string
): Promise<Array<{ document_id: string; document_version: string }>> {
  if (accessToken) {
    try {
      const res = await fetch('/api/legal/acceptances', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        acceptances?: Array<{ document_id: string; document_version: string }>;
        error?: string;
        traceId?: string;
      };
      debugAuth('[WebAppGate] Legal acceptance API status response', {
        ok: res.ok,
        success: data.success,
        count: data.acceptances?.length ?? 0,
        error: data.error ?? null,
        traceId: data.traceId ?? null,
      });
      if (res.ok && data.success !== false && Array.isArray(data.acceptances)) {
        return data.acceptances;
      }
    } catch (err) {
      debugAuth('[WebAppGate] Legal acceptance API status failed; trying browser fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const { data, error } = await supabase
    .from('user_legal_acceptances')
    .select('document_id,document_version')
    .eq('user_id', userId);
  debugAuth('[WebAppGate] Legal acceptance browser fallback response', {
    count: data?.length ?? 0,
    error: error?.message ?? null,
  });
  if (error) throw error;
  return data ?? [];
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
  const loadStateInFlightRef = useRef<Promise<void> | null>(null);

  const missingDocs = useMemo(() => {
    const accepted = new Set(acceptedDocIds);
    return requiredDocs.filter((doc) => !accepted.has(`${doc.id}:${doc.version}`));
  }, [requiredDocs, acceptedDocIds]);

  const allMissingChecked = missingDocs.length > 0 && missingDocs.every((doc) => checkedDocIds.includes(doc.id));

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

  const loadState = useCallback(() => {
    if (loadStateInFlightRef.current) return loadStateInFlightRef.current;
    const request = (async () => {
    setError('');
    setStep('loading');
    try {
      const supabase = getSupabaseBrowser() as any;
      const { authUser, session, userError } = await withTimeout(resolveAuthSnapshot(), 10000, 'Loading web auth session');

      debugAuth('[WebAppGate] Authenticated user object', {
        id: authUser?.id ?? null,
        email: authUser?.email ?? null,
        sessionUserId: session?.user?.id ?? null,
        error: userError?.message ?? null,
      });

      if (!authUser) {
        const requestedPath =
          typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}`
            : '/app';
        router.replace(`/sign-in?redirect=${encodeURIComponent(requestedPath)}`);
        return;
      }

      const currentUserId = authUser.id;
      const currentEmail = authUser.email ?? '';
      setUserId(currentUserId);
      setEmail(currentEmail);

      const [{ data: profile }, { data: docs }, { data: onboarding }, acceptances] = await withTimeout(
        Promise.all([
          supabase
            .from('users')
            .select('id,email,email_verified,verified')
            .eq('id', currentUserId)
            .maybeSingle(),
          supabase
            .from('legal_documents')
            .select('id,title,slug,content,version')
            .eq('is_active', true)
            .eq('is_required', true)
            .order('created_at', { ascending: true }),
          supabase
            .from('user_onboarding_data')
            .select('has_completed_onboarding,consent_given')
            .eq('user_id', currentUserId)
            .maybeSingle(),
          loadLegalAcceptances(supabase, session?.access_token, currentUserId),
        ]),
        12000,
        'Loading web onboarding state'
      );

      debugAuth('[WebAppGate] Profile fetch response', {
        requestedUserId: currentUserId,
        profileUserId: profile?.id ?? null,
        email: profile?.email ?? currentEmail,
        emailVerified: profile?.email_verified ?? !!authUser.email_confirmed_at,
      });

      const isEmailVerified = (profile?.email_verified ?? false) || !!authUser.email_confirmed_at;
      if (!isEmailVerified) {
        setStep('verify-email');
        return;
      }

      const legalDocs = (docs ?? []) as LegalDoc[];
      const accepted = (acceptances ?? []).map(
        (row: { document_id: string; document_version: string }) => `${row.document_id}:${row.document_version}`
      );
      debugAuth('[WebAppGate] Legal gate decision', {
        requiredDocuments: legalDocs.map((doc) => `${doc.id}:${doc.version}`),
        acceptedDocuments: accepted,
        missingCount: legalDocs.filter((doc) => !accepted.includes(`${doc.id}:${doc.version}`)).length,
        sessionExists: Boolean(session?.access_token),
      });
      setRequiredDocs(legalDocs);
      setAcceptedDocIds(accepted);
      setCheckedDocIds([]);

      const acceptedSet = new Set(accepted);
      const hasMissingLegal = legalDocs.some((doc) => !acceptedSet.has(`${doc.id}:${doc.version}`));
      if (hasMissingLegal) {
        setStep('legal');
        return;
      }

      if (!onboarding?.has_completed_onboarding || !onboarding?.consent_given) {
        setStep('ai-consent');
        return;
      }

      setStep('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load onboarding state.');
      setStep('error');
    }
    })();
    loadStateInFlightRef.current = request.finally(() => {
      loadStateInFlightRef.current = null;
    });
    return loadStateInFlightRef.current;
  }, [resolveAuthSnapshot, router]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    const supabase = getSupabaseBrowser() as any;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void loadState();
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [loadState]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadState();
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
        saveStrategy?: string;
        traceId?: string;
      };
      debugAuth('[WebAppGate] Legal save API response', {
        ok: res.ok,
        success: data.success,
        acceptedCount: data.acceptedCount ?? null,
        saveStrategy: data.saveStrategy ?? null,
        error: data.error ?? null,
        traceId: data.traceId ?? null,
      });
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Unable to save legal acceptance.');
      }
      setAcceptedDocIds((current) =>
        Array.from(new Set([...current, ...missingDocs.map((doc) => `${doc.id}:${doc.version}`)]))
      );
      await loadState();
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
      await loadState();
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
                <label key={doc.id} className="group flex cursor-pointer gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-teal-300 hover:bg-teal-50/40">
                  <input
                    type="checkbox"
                    checked={checkedDocIds.includes(doc.id)}
                    onChange={(event) => {
                      setCheckedDocIds((current) =>
                        event.target.checked ? [...current, doc.id] : current.filter((id) => id !== doc.id)
                      );
                    }}
                    className="mt-1 h-5 w-5 rounded border-slate-300 accent-teal-500"
                  />
                  <span>
                    <span className="block font-black text-slate-950">{doc.title}</span>
                    <span className="mt-1 block text-sm font-semibold text-slate-500">Version {doc.version}</span>
                    <Link href={`/legal/${doc.slug}`} className="mt-2 inline-block text-sm font-black text-teal-700 hover:text-teal-900">
                      View full document
                    </Link>
                  </span>
                </label>
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
              onClick={loadState}
              className="mt-6 min-h-[54px] rounded-md bg-teal-500 px-6 py-3 font-black text-slate-950 transition hover:bg-teal-300"
            >
              Try again
            </button>
          </>
        )}

        {error && step !== 'error' ? <p className="mt-5 text-sm font-semibold text-red-600">{error}</p> : null}
        {step !== 'loading' && (
          <div className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Deep links and mobile app access remain unchanged.
          </div>
        )}
          </div>
        </div>
      </section>
    </main>
  );
}
