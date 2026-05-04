'use client';

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, CheckCircle2, FileText, Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react';
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

      const [{ data: profile }, { data: docs }, { data: acceptances }, { data: onboarding }] = await withTimeout(
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
            .from('user_legal_acceptances')
            .select('document_id,document_version')
            .eq('user_id', currentUserId),
          supabase
            .from('user_onboarding_data')
            .select('has_completed_onboarding,consent_given')
            .eq('user_id', currentUserId)
            .maybeSingle(),
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
      const rows = missingDocs.map((doc) => ({
        user_id: userId,
        document_id: doc.id,
        document_version: doc.version,
        context: 'manual',
        accepted_at: new Date().toISOString(),
      }));
      const { error: upsertError } = await supabase
        .from('user_legal_acceptances')
        .upsert(rows, { onConflict: 'user_id,document_id' });
      if (upsertError) throw upsertError;
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

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-6 py-16 md:px-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl shadow-slate-200/60 md:p-10">
        {step === 'loading' && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-violet-600" />
            <h1 className="mt-5 font-display text-2xl font-bold text-slate-950">Preparing your web app</h1>
            <p className="mt-2 text-slate-600">Checking your account safely.</p>
          </>
        )}

        {step === 'verify-email' && (
          <>
            <Mail className="mx-auto h-14 w-14 text-violet-600" />
            <h1 className="mt-5 font-display text-3xl font-bold text-slate-950">Verify your email first</h1>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">
              We need to confirm your email before legal documents, AI consent, and the web app open.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={resendVerification}
                disabled={saving}
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {saving ? 'Sending...' : 'Resend verification'}
              </button>
              <Link
                href={`/verify-email?email=${encodeURIComponent(email)}`}
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-100"
              >
                View instructions
              </Link>
            </div>
          </>
        )}

        {step === 'legal' && (
          <>
            <FileText className="mx-auto h-14 w-14 text-violet-600" />
            <h1 className="mt-5 font-display text-3xl font-bold text-slate-950">Legal documents</h1>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">
              Please review and accept the required documents before continuing.
            </p>
            <div className="mt-8 space-y-3 text-left">
              {missingDocs.map((doc) => (
                <label key={doc.id} className="flex cursor-pointer gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    checked={checkedDocIds.includes(doc.id)}
                    onChange={(event) => {
                      setCheckedDocIds((current) =>
                        event.target.checked ? [...current, doc.id] : current.filter((id) => id !== doc.id)
                      );
                    }}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-violet-600"
                  />
                  <span>
                    <span className="block font-semibold text-slate-950">{doc.title}</span>
                    <span className="mt-1 block text-sm text-slate-500">Version {doc.version}</span>
                    <Link href={`/legal/${doc.slug}`} className="mt-2 inline-block text-sm font-semibold text-violet-700 hover:text-violet-900">
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
              className="mt-8 inline-flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-rose-500 px-6 py-3 font-semibold text-white shadow-lg disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Accept and continue'}
            </button>
          </>
        )}

        {step === 'ai-consent' && (
          <>
            <Sparkles className="mx-auto h-14 w-14 text-rose-500" />
            <h1 className="mt-5 font-display text-3xl font-bold text-slate-950">Committed AI consent</h1>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">
              Review how Committed AI supports you before using AI-powered help.
            </p>
            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-left">
              {(() => {
                const item = aiSteps[aiStep];
                const Icon = item.icon;
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm">
                        <Icon className="h-6 w-6" />
                      </span>
                      <h2 className="font-display text-xl font-bold text-slate-950">{item.title}</h2>
                    </div>
                    <p className="mt-4 leading-7 text-slate-600">{item.text}</p>
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
                  className={`h-2.5 rounded-full transition-all ${index === aiStep ? 'w-8 bg-rose-500' : 'w-2.5 bg-slate-300'}`}
                  aria-label={`Go to AI consent step ${index + 1}`}
                />
              ))}
            </div>
            {aiStep === aiSteps.length - 1 && (
              <label className="mt-6 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left">
                <input
                  type="checkbox"
                  checked={aiConsentChecked}
                  onChange={(event) => setAiConsentChecked(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-rose-600"
                />
                <span className="font-medium text-slate-800">I understand and consent to Committed AI support.</span>
              </label>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {aiStep > 0 && (
                <button
                  type="button"
                  onClick={() => setAiStep((value) => Math.max(0, value - 1))}
                  className="min-h-[52px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Back
                </button>
              )}
              {aiStep < aiSteps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setAiStep((value) => Math.min(aiSteps.length - 1, value + 1))}
                  className="min-h-[52px] flex-1 rounded-2xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={acceptAiConsent}
                  disabled={!aiConsentChecked || saving}
                  className="min-h-[52px] flex-1 rounded-2xl bg-gradient-to-r from-violet-600 to-rose-500 px-6 py-3 font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Accept and enter web app'}
                </button>
              )}
            </div>
          </>
        )}

        {step === 'error' && (
          <>
            <h1 className="font-display text-2xl font-bold text-slate-950">Something needs attention</h1>
            <p className="mt-3 text-red-600">{error}</p>
            <button
              type="button"
              onClick={loadState}
              className="mt-6 rounded-2xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700"
            >
              Try again
            </button>
          </>
        )}

        {error && step !== 'error' ? <p className="mt-5 text-sm text-red-600">{error}</p> : null}
        {step !== 'loading' && (
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Deep links and mobile app access remain unchanged.
          </div>
        )}
      </div>
    </main>
  );
}
