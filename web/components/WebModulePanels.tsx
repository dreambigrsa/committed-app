'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, CheckCircle2, Film, Loader2, MessageCircle, ShieldCheck, ThumbsUp, UploadCloud, UserCircle2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-client';

type PanelProps = {
  module: string;
};

type Status = 'idle' | 'loading' | 'success' | 'error';

type WebRelationship = {
  id: string;
  user_id: string;
  partner_user_id?: string | null;
  partner_name?: string | null;
  partner_phone?: string | null;
  type?: string | null;
  status?: string | null;
  start_date?: string | null;
  verified_date?: string | null;
  end_date?: string | null;
  privacy_level?: string | null;
  partner_city?: string | null;
};

type DatingCandidate = {
  id: string;
  user_id: string;
  bio?: string | null;
  age?: number | null;
  location_city?: string | null;
  relationship_goals?: string[] | null;
  interests?: string[] | null;
  religion?: string | null;
  education?: string | null;
  users?: { full_name?: string | null; profile_picture?: string | null } | null;
  dating_photos?: { photo_url: string; is_primary?: boolean | null }[] | null;
};

const relationshipTypes = [
  { value: 'married', label: 'Married' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'serious', label: 'Serious Relationship' },
  { value: 'dating', label: 'Dating' },
];

const privacyOptions = [
  { value: 'private', label: 'Private', text: 'Only you, partner, admins, and moderators can view it.' },
  { value: 'verified-only', label: 'Verified members', text: 'Visible to verified Committed users after approval.' },
  { value: 'public', label: 'Public registry', text: 'Visible in public search after approval.' },
];

const relationshipGoals = ['Long-term', 'Short-term', 'Friendship', 'Marriage', 'Casual'];
const religionOptions = ['Christian', 'Muslim', 'Jewish', 'Hindu', 'Buddhist', 'Traditional', 'Spiritual', 'Agnostic', 'Atheist', 'Other', 'Prefer not to say'];
const educationOptions = ['High school', 'Diploma', "Bachelor's", "Master's", 'Doctorate', 'Trade/Technical', 'Self-taught', 'Prefer not to say'];

function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  return trimmed.replace(/[^\d+]/g, '');
}

function formatShortDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

function StatusMessage({ status, message }: { status: Status; message: string }) {
  if (!message) return null;
  const isError = status === 'error';
  return (
    <div
      className={`mt-5 flex gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${
        isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      {isError ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
      {message}
    </div>
  );
}

export default function WebModulePanels({ module }: PanelProps) {
  if (module === 'relationship') return <RelationshipPanel />;
  if (module === 'dating') return <DatingProfilePanel />;
  if (module === 'profile') return <ProfilePanel />;
  if (module === 'notifications') return <NotificationsPanel />;
  if (module === 'settings') return <SettingsPanel />;
  if (module === 'admin') return <AdminPanel />;
  if (module === 'professionals') return <ProfessionalsPanel />;
  if (module === 'feed') return <CommunityPanel />;
  if (module === 'reels') return <CommunityPanel initialTab="reels" />;
  if (module === 'messages') return <MessagesPanel />;
  if (module === 'promotions') return <PromotionsPanel />;
  return <MobileContinuationPanel module={module} />;
}

function RelationshipPanel() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [relationships, setRelationships] = useState<WebRelationship[]>([]);
  const [loadingRelationships, setLoadingRelationships] = useState(true);
  const [photoName, setPhotoName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    partnerName: '',
    partnerPhone: '',
    type: 'serious',
    startDate: '',
    partnerCity: '',
    privacyLevel: 'private',
    consent: false,
  });

  const canSubmit = form.partnerName.trim() && form.partnerPhone.trim() && form.consent && photoFile;

  const loadRelationships = async () => {
    setLoadingRelationships(true);
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data, error } = await supabase
        .from('relationships')
        .select('id,user_id,partner_user_id,partner_name,partner_phone,type,status,start_date,verified_date,end_date,privacy_level,partner_city')
        .or(`user_id.eq.${session.user.id},partner_user_id.eq.${session.user.id}`)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setRelationships((data ?? []) as WebRelationship[]);
    } finally {
      setLoadingRelationships(false);
    }
  };

  useEffect(() => {
    void loadRelationships();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || status === 'loading') return;

    setStatus('loading');
    setMessage('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in again before registering a relationship.');

      let partnerFacePhoto = '';
      if (photoFile) {
        const extension = photoFile.name.split('.').pop() || 'jpg';
        const path = `relationships/${session.user.id}/${Date.now()}.${extension}`;
        const { data: upload, error: uploadError } = await supabase.storage.from('media').upload(path, photoFile, {
          contentType: photoFile.type || 'image/jpeg',
          upsert: false,
        });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from('media').getPublicUrl(upload.path);
        partnerFacePhoto = publicData.publicUrl;
      }

      const normalizedPhone = normalizePhone(form.partnerPhone);
      const { data: partnerRows } = await supabase
        .from('users')
        .select('id,full_name,phone_number')
        .or(`phone_number.eq.${normalizedPhone},phone_number.eq.${form.partnerPhone}`)
        .limit(1);
      const partner = partnerRows?.[0];

      const { data: relationship, error } = await supabase
        .from('relationships')
        .insert({
          user_id: session.user.id,
          partner_name: form.partnerName.trim(),
          partner_phone: normalizedPhone,
          partner_user_id: partner?.id ?? null,
          type: form.type,
          status: 'pending',
          start_date: form.startDate || new Date().toISOString(),
          privacy_level: form.privacyLevel,
          partner_face_photo: partnerFacePhoto,
          partner_city: form.partnerCity.trim() || null,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (partner?.id && relationship?.id) {
        await supabase.from('relationship_requests').insert({
          from_user_id: session.user.id,
          from_user_name: session.user.user_metadata?.full_name || session.user.email || 'Committed member',
          to_user_id: partner.id,
          relationship_type: form.type,
          status: 'pending',
        });
      }

      setStatus('success');
      setMessage('Relationship submitted for verification. It will stay pending until your partner, admin, or moderator review confirms it.');
      await loadRelationships();
      setPhotoFile(null);
      setPhotoName('');
      setForm({
        partnerName: '',
        partnerPhone: '',
        type: 'serious',
        startDate: '',
        partnerCity: '',
        privacyLevel: 'private',
        consent: false,
      });
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Relationship registration failed.');
    }
  };

  return (
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 md:p-8">
      <h2 className="font-display text-2xl font-bold text-slate-950">Register a relationship on web</h2>
      <p className="mt-2 leading-7 text-slate-600">
        This creates a real pending relationship record. Verification still requires review before it appears as verified.
      </p>
      <form onSubmit={submit} className="mt-6 grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Partner name" value={form.partnerName} onChange={(value) => setForm({ ...form, partnerName: value })} />
          <Field label="Partner phone" value={form.partnerPhone} onChange={(value) => setForm({ ...form, partnerPhone: value })} placeholder="+263..." />
          <SelectField label="Relationship type" value={form.type} onChange={(value) => setForm({ ...form, type: value })} options={relationshipTypes} />
          <Field label="Start date" type="date" value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value })} />
          <Field label="Partner city" value={form.partnerCity} onChange={(value) => setForm({ ...form, partnerCity: value })} optional />
        </div>

        <div>
          <p className="font-semibold text-slate-950">Relationship visibility</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {privacyOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setForm({ ...form, privacyLevel: option.value })}
                className={`rounded-2xl border p-4 text-left transition ${
                  form.privacyLevel === option.value ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-slate-50 hover:bg-white'
                }`}
              >
                <span className="font-bold text-slate-950">{option.label}</span>
                <span className="mt-1 block text-sm leading-6 text-slate-600">{option.text}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-rose-300 bg-rose-50/70 px-5 py-8 text-center">
          <UploadCloud className="h-8 w-8 text-rose-600" />
          <span className="mt-2 font-bold text-rose-700">{photoName || 'Upload partner face photo'}</span>
          <span className="mt-1 text-sm text-slate-500">Required for verification evidence.</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setPhotoFile(file);
              setPhotoName(file?.name ?? '');
            }}
          />
        </label>

        <label className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(event) => setForm({ ...form, consent: event.target.checked })}
            className="mt-1 h-5 w-5"
          />
          <span className="text-sm leading-6 text-slate-700">
            I confirm this information is accurate, I understand verification does not prove legal marriage, and false registration may be reviewed by moderators.
          </span>
        </label>

        <button
          type="submit"
          disabled={!canSubmit || status === 'loading'}
          className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-rose-500 px-6 font-bold text-white shadow-lg disabled:opacity-60"
        >
          {status === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
          Submit for verification
        </button>
      </form>
      <StatusMessage status={status} message={message} />
      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="font-display text-xl font-bold text-slate-950">Your relationship records</h3>
        {loadingRelationships ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
            <span className="font-medium text-slate-600">Loading records...</span>
          </div>
        ) : relationships.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
            No relationship records yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {relationships.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{item.partner_name || 'Partner'}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.type || 'relationship'} • {item.privacy_level || 'private'} • started {formatShortDate(item.start_date)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                    item.status === 'verified'
                      ? 'bg-emerald-100 text-emerald-700'
                      : item.status === 'ended'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    {item.status || 'pending'}
                  </span>
                </div>
                {item.status === 'verified' ? (
                  <p className="mt-3 text-sm font-medium text-emerald-700">Verified {formatShortDate(item.verified_date)}</p>
                ) : item.status === 'ended' ? (
                  <p className="mt-3 text-sm font-medium text-slate-600">Ended {formatShortDate(item.end_date)}</p>
                ) : (
                  <p className="mt-3 text-sm font-medium text-amber-700">Pending partner, admin, or moderator verification.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function DatingProfilePanel() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState('');
  const [candidates, setCandidates] = useState<DatingCandidate[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(true);
  const [reactionMessage, setReactionMessage] = useState('');
  const [form, setForm] = useState({
    bio: '',
    age: '',
    locationCity: '',
    gender: '',
    lookingFor: 'everyone',
    religion: '',
    education: '',
    goals: [] as string[],
    isActive: true,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = getSupabaseBrowser() as any;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data } = await supabase.from('dating_profiles').select('*').eq('user_id', session.user.id).maybeSingle();
        if (!cancelled && data) {
          setProfileId(data.id);
          setForm({
            bio: data.bio || '',
            age: data.age?.toString() || '',
            locationCity: data.location_city || '',
            gender: data.gender || '',
            lookingFor: data.looking_for || 'everyone',
            religion: data.religion || '',
            education: data.education || '',
            goals: data.relationship_goals || [],
            isActive: data.is_active ?? true,
          });
        }
      } catch {
        // Empty state is fine for first profile setup.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCandidates = async () => {
    setCandidateLoading(true);
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const [{ data: likedRows }, { data: passedRows }] = await Promise.all([
        supabase.from('dating_likes').select('liked_id').eq('liker_id', session.user.id),
        supabase.from('dating_passes').select('passed_id').eq('passer_id', session.user.id),
      ]);
      const hiddenIds = new Set<string>([
        session.user.id,
        ...((likedRows ?? []).map((row: any) => row.liked_id) as string[]),
        ...((passedRows ?? []).map((row: any) => row.passed_id) as string[]),
      ]);

      const { data, error } = await supabase
        .from('dating_profiles')
        .select(
          `
          id,user_id,bio,age,location_city,relationship_goals,interests,religion,education,
          users!dating_profiles_user_id_fkey(full_name,profile_picture),
          dating_photos(photo_url,is_primary)
        `
        )
        .eq('is_active', true)
        .eq('show_me', true)
        .limit(18);
      if (error) throw error;
      setCandidates(((data ?? []) as DatingCandidate[]).filter((item) => !hiddenIds.has(item.user_id)).slice(0, 8));
    } finally {
      setCandidateLoading(false);
    }
  };

  useEffect(() => {
    void loadCandidates();
  }, []);

  const ensureMatchIfMutual = async (userId: string, likedUserId: string) => {
    const supabase = getSupabaseBrowser() as any;
    const { data: mutualLike } = await supabase
      .from('dating_likes')
      .select('id')
      .eq('liker_id', likedUserId)
      .eq('liked_id', userId)
      .maybeSingle();
    if (!mutualLike) return false;
    const user1Id = userId < likedUserId ? userId : likedUserId;
    const user2Id = userId > likedUserId ? userId : likedUserId;
    const { data: existingMatch } = await supabase
      .from('dating_matches')
      .select('id')
      .eq('user1_id', user1Id)
      .eq('user2_id', user2Id)
      .maybeSingle();
    if (existingMatch) return true;
    const { error } = await supabase.from('dating_matches').insert({ user1_id: user1Id, user2_id: user2Id });
    if (error && !(error.code === '23505' || error.message?.includes('duplicate'))) throw error;
    return true;
  };

  const reactToCandidate = async (likedUserId: string, isSuperLike: boolean) => {
    setReactionMessage('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in again.');
      const { error } = await supabase
        .from('dating_likes')
        .upsert(
          {
            liker_id: session.user.id,
            liked_id: likedUserId,
            is_super_like: isSuperLike,
          },
          { onConflict: 'liker_id,liked_id' }
        );
      if (error) throw error;
      await supabase.from('dating_passes').delete().eq('passer_id', session.user.id).eq('passed_id', likedUserId);
      const matched = await ensureMatchIfMutual(session.user.id, likedUserId);
      if (!matched) {
        await supabase.from('notifications').insert({
          user_id: likedUserId,
          type: isSuperLike ? 'dating_super_like' : 'dating_like',
          title: isSuperLike ? 'Super Like!' : 'New Like',
          message: `Someone ${isSuperLike ? 'super liked' : 'liked'} you on Committed Dating.`,
          data: { liker_id: session.user.id },
        });
      }
      setCandidates((current) => current.filter((item) => item.user_id !== likedUserId));
      setReactionMessage(matched ? "It's a match. You can continue the conversation in messages." : isSuperLike ? 'Star sent.' : 'Like sent.');
    } catch (err) {
      setReactionMessage(err instanceof Error ? err.message : 'Unable to send reaction.');
    }
  };

  const passCandidate = async (passedUserId: string) => {
    setReactionMessage('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in again.');
      await supabase.from('dating_passes').upsert({ passer_id: session.user.id, passed_id: passedUserId }, { onConflict: 'passer_id,passed_id' });
      setCandidates((current) => current.filter((item) => item.user_id !== passedUserId));
      setReactionMessage('Profile skipped.');
    } catch (err) {
      setReactionMessage(err instanceof Error ? err.message : 'Unable to skip profile.');
    }
  };

  const toggleGoal = (goal: string) => {
    setForm((current) => {
      const exists = current.goals.includes(goal);
      if (exists) return { ...current, goals: current.goals.filter((item) => item !== goal) };
      if (current.goals.length >= 5) return current;
      return { ...current, goals: [...current.goals, goal] };
    });
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in again before saving your dating profile.');
      const payload = {
        user_id: session.user.id,
        bio: form.bio.trim(),
        age: form.age ? Number(form.age) : null,
        location_city: form.locationCity.trim() || null,
        gender: form.gender || null,
        looking_for: form.lookingFor,
        religion: form.religion || null,
        education: form.education || null,
        relationship_goals: form.goals,
        is_active: form.isActive,
        show_me: form.isActive,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('dating_profiles').upsert(payload, { onConflict: 'user_id' }).select('id').single();
      if (error) throw error;
      setProfileId(data?.id || profileId);
      setStatus('success');
      setMessage('Dating profile saved. Add photos and swipe discovery from mobile for the full native experience.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unable to save dating profile.');
    }
  };

  if (loading) return <LoadingPanel label="Loading your dating profile..." />;

  return (
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 md:p-8">
      <h2 className="font-display text-2xl font-bold text-slate-950">Dating profile basics</h2>
      <p className="mt-2 leading-7 text-slate-600">Save the profile details that power discovery and filters.</p>
      <form onSubmit={save} className="mt-6 grid gap-5">
        <Textarea label="Bio" value={form.bio} onChange={(value) => setForm({ ...form, bio: value })} maxLength={500} />
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Age" type="number" value={form.age} onChange={(value) => setForm({ ...form, age: value })} />
          <Field label="City" value={form.locationCity} onChange={(value) => setForm({ ...form, locationCity: value })} />
          <SelectField
            label="Looking for"
            value={form.lookingFor}
            onChange={(value) => setForm({ ...form, lookingFor: value })}
            options={[
              { value: 'men', label: 'Men' },
              { value: 'women', label: 'Women' },
              { value: 'everyone', label: 'Everyone' },
            ]}
          />
          <SelectField
            label="Gender"
            value={form.gender}
            onChange={(value) => setForm({ ...form, gender: value })}
            options={[
              { value: '', label: 'Select' },
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'non_binary', label: 'Non-binary' },
              { value: 'prefer_not_to_say', label: 'Prefer not to say' },
            ]}
          />
          <SelectField label="Religion" value={form.religion} onChange={(value) => setForm({ ...form, religion: value })} options={[{ value: '', label: 'Select' }, ...religionOptions.map((value) => ({ value, label: value }))]} />
          <SelectField label="Education" value={form.education} onChange={(value) => setForm({ ...form, education: value })} options={[{ value: '', label: 'Select' }, ...educationOptions.map((value) => ({ value, label: value }))]} />
        </div>
        <div>
          <p className="font-semibold text-slate-950">Relationship goals</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {relationshipGoals.map((goal) => (
              <button
                key={goal}
                type="button"
                onClick={() => toggleGoal(goal)}
                className={`rounded-full border px-4 py-2 text-sm font-bold ${
                  form.goals.includes(goal) ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                {goal}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
          <span className="font-medium text-slate-800">Show my dating profile in discovery</span>
        </label>
        <button type="submit" disabled={status === 'loading'} className="min-h-[54px] rounded-2xl bg-gradient-to-r from-rose-600 to-violet-600 px-6 font-bold text-white disabled:opacity-60">
          {status === 'loading' ? 'Saving...' : profileId ? 'Save dating profile' : 'Create dating profile'}
        </button>
      </form>
      <StatusMessage status={status} message={message} />
      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold text-slate-950">Discover on web</h3>
            <p className="mt-1 text-sm text-slate-600">Browse active profiles and send likes from the browser.</p>
          </div>
          <button type="button" onClick={loadCandidates} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">
            Refresh
          </button>
        </div>
        {reactionMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{reactionMessage}</div>
        ) : null}
        {candidateLoading ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
            <span className="font-medium text-slate-600">Loading dating profiles...</span>
          </div>
        ) : candidates.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
            No new profiles right now. Try widening filters in the mobile app or refresh later.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {candidates.map((candidate) => {
              const photo = candidate.dating_photos?.find((item) => item.is_primary)?.photo_url || candidate.dating_photos?.[0]?.photo_url || candidate.users?.profile_picture;
              const name = candidate.users?.full_name || 'Committed member';
              return (
                <article key={candidate.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                  <div className="flex min-h-[170px] items-center justify-center bg-gradient-to-br from-rose-500 to-violet-700 text-white">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={name} className="h-full max-h-[260px] w-full object-cover" />
                    ) : (
                      <span className="font-display text-7xl font-black">{name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="p-5">
                    <h4 className="font-display text-2xl font-bold text-slate-950">
                      {name} {candidate.age ? <span className="text-slate-500">{candidate.age}</span> : null}
                    </h4>
                    <p className="mt-1 text-sm font-medium text-slate-600">{candidate.location_city || 'Location not shown'}</p>
                    {candidate.bio ? <p className="mt-3 line-clamp-3 leading-7 text-slate-700">{candidate.bio}</p> : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {[...(candidate.relationship_goals || []), ...(candidate.interests || []), candidate.religion, candidate.education]
                        .filter(Boolean)
                        .slice(0, 5)
                        .map((tag) => (
                          <span key={String(tag)} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                            {String(tag)}
                          </span>
                        ))}
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => passCandidate(candidate.user_id)} className="rounded-xl bg-slate-200 px-3 py-3 font-bold text-slate-700">
                        Pass
                      </button>
                      <button type="button" onClick={() => reactToCandidate(candidate.user_id, true)} className="rounded-xl bg-blue-600 px-3 py-3 font-bold text-white">
                        Star
                      </button>
                      <button type="button" onClick={() => reactToCandidate(candidate.user_id, false)} className="rounded-xl bg-emerald-600 px-3 py-3 font-bold text-white">
                        Like
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function SettingsPanel() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', isVerified: false });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = getSupabaseBrowser() as any;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data: userRow } = await supabase.from('users').select('full_name,phone_number,email').eq('id', session.user.id).maybeSingle();
        const { data: profile } = await supabase.from('profiles').select('is_verified').eq('id', session.user.id).maybeSingle();
        if (!cancelled) {
          setForm({
            fullName: userRow?.full_name || session.user.user_metadata?.full_name || '',
            phone: userRow?.phone_number || '',
            email: userRow?.email || session.user.email || '',
            isVerified: Boolean(profile?.is_verified),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in again.');
      const { error } = await supabase
        .from('users')
        .update({ full_name: form.fullName.trim(), phone_number: normalizePhone(form.phone) })
        .eq('id', session.user.id);
      if (error) throw error;
      setStatus('success');
      setMessage('Account details saved.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unable to save account details.');
    }
  };

  const signOut = async () => {
    const supabase = getSupabaseBrowser() as any;
    await supabase.auth.signOut();
    window.location.href = '/sign-in';
  };

  if (loading) return <LoadingPanel label="Loading settings..." />;

  return (
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 md:p-8">
      <h2 className="font-display text-2xl font-bold text-slate-950">Account settings</h2>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="font-semibold text-slate-950">{form.email}</p>
        <p className="mt-1 text-sm text-slate-600">{form.isVerified ? 'Email verified' : 'Email not verified yet'}</p>
      </div>
      <form onSubmit={save} className="mt-6 grid gap-4">
        <Field label="Full name" value={form.fullName} onChange={(value) => setForm({ ...form, fullName: value })} />
        <Field label="Phone number" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} placeholder="+263..." />
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={status === 'loading'} className="min-h-[54px] flex-1 rounded-2xl bg-violet-600 px-6 font-bold text-white disabled:opacity-60">
            {status === 'loading' ? 'Saving...' : 'Save account'}
          </button>
          <button type="button" onClick={signOut} className="min-h-[54px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-6 font-bold text-slate-700">
            Sign out
          </button>
        </div>
      </form>
      <StatusMessage status={status} message={message} />
    </section>
  );
}

function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [role, setRole] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [relationships, setRelationships] = useState<WebRelationship[]>([]);
  const [actionId, setActionId] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionStatus, setActionStatus] = useState<Status>('idle');

  const loadAdmin = async (cancelledRef?: { current: boolean }) => {
      try {
        const supabase = getSupabaseBrowser() as any;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data: userRow } = await supabase.from('users').select('role').eq('id', session.user.id).maybeSingle();
        const currentRole = userRow?.role || '';
        if (!['admin', 'super_admin', 'moderator'].includes(currentRole)) {
          setRole(currentRole);
          setError('Admin access is required for this panel.');
          return;
        }
        setRole(currentRole);
        const [users, relationships, pendingRelationships, payments, professionalApplications, reports] = await Promise.all([
          supabase.from('users').select('id', { count: 'exact', head: true }),
          supabase.from('relationships').select('id', { count: 'exact', head: true }),
          supabase.from('relationships').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('payment_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('professional_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('false_relationship_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);
        const { data: relationshipRows } = await supabase
          .from('relationships')
          .select('id,user_id,partner_user_id,partner_name,partner_phone,type,status,start_date,verified_date,end_date,privacy_level,partner_city')
          .order('created_at', { ascending: false })
          .limit(12);
        if (!cancelledRef?.current) {
          setCounts({
            users: users.count || 0,
            relationships: relationships.count || 0,
            pendingRelationships: pendingRelationships.count || 0,
            payments: payments.count || 0,
            professionalApplications: professionalApplications.count || 0,
            reports: reports.count || 0,
          });
          setRelationships((relationshipRows ?? []) as WebRelationship[]);
        }
      } catch (err) {
        if (!cancelledRef?.current) setError(err instanceof Error ? err.message : 'Unable to load admin overview.');
      } finally {
        if (!cancelledRef?.current) setLoading(false);
      }
  };

  useEffect(() => {
    const cancelled = { current: false };
    const load = async () => {
      await loadAdmin(cancelled);
    };
    void load();
    return () => {
      cancelled.current = true;
    };
  }, []);

  const updateRelationshipStatus = async (relationshipId: string, nextStatus: 'verified' | 'ended') => {
    setActionId(relationshipId);
    setActionStatus('loading');
    setActionMessage('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const now = new Date().toISOString();
      const payload =
        nextStatus === 'verified'
          ? { status: 'verified', verified_date: now, end_date: null }
          : { status: 'ended', end_date: now };
      const { data, error } = await supabase
        .from('relationships')
        .update(payload)
        .eq('id', relationshipId)
        .select('id,status,verified_date,end_date')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Relationship was not updated. Check admin RLS permissions.');
      setActionStatus('success');
      setActionMessage(nextStatus === 'verified' ? 'Relationship verified.' : 'Relationship rejected and ended.');
      await loadAdmin();
    } catch (err) {
      setActionStatus('error');
      setActionMessage(err instanceof Error ? err.message : 'Relationship action failed.');
    } finally {
      setActionId('');
    }
  };

  const requestEndReview = async (relationshipId: string) => {
    setActionId(relationshipId);
    setActionStatus('loading');
    setActionMessage('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in again.');

      const { data: relationship, error: relError } = await supabase
        .from('relationships')
        .select('user_id,partner_user_id')
        .eq('id', relationshipId)
        .single();
      if (relError || !relationship) throw new Error('Relationship not found.');

      const { data: existing } = await supabase
        .from('disputes')
        .select('id,auto_resolve_at')
        .eq('relationship_id', relationshipId)
        .eq('dispute_type', 'end_relationship')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        throw new Error(`An end review is already pending until ${formatShortDate(existing.auto_resolve_at)}.`);
      }

      const autoResolve = new Date();
      autoResolve.setDate(autoResolve.getDate() + 7);
      const { data: dispute, error: disputeError } = await supabase
        .from('disputes')
        .insert({
          relationship_id: relationshipId,
          initiated_by: session.user.id,
          dispute_type: 'end_relationship',
          description: 'Admin requested relationship end review',
          status: 'pending',
          auto_resolve_at: autoResolve.toISOString(),
        })
        .select('id')
        .single();
      if (disputeError) throw disputeError;

      const partnerIds = [relationship.user_id, relationship.partner_user_id].filter(Boolean);
      await Promise.all(
        partnerIds.map((partnerId: string) =>
          supabase.from('notifications').insert({
            user_id: partnerId,
            type: 'relationship_end_request',
            title: 'Relationship End Review',
            message:
              'An administrator opened a relationship end review. Confirm to end it, or reject to keep it active. If no one rejects within 7 days, it will auto-end.',
            data: { relationshipId, disputeId: dispute.id, adminInitiated: true },
          })
        )
      );

      setActionStatus('success');
      setActionMessage('End review created and partners were notified.');
    } catch (err) {
      setActionStatus('error');
      setActionMessage(err instanceof Error ? err.message : 'Unable to create end review.');
    } finally {
      setActionId('');
    }
  };

  if (loading) return <LoadingPanel label="Loading admin overview..." />;

  return (
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 md:p-8">
      <h2 className="font-display text-2xl font-bold text-slate-950">Admin overview</h2>
      {error ? (
        <StatusMessage status="error" message={error} />
      ) : (
        <>
          <p className="mt-2 text-slate-600">Signed in with role: <span className="font-semibold text-slate-950">{role}</span></p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Users', counts.users],
              ['Relationships', counts.relationships],
              ['Pending relationships', counts.pendingRelationships],
              ['Pending payments', counts.payments],
              ['Professional applications', counts.professionalApplications],
              ['False relationship reports', counts.reports],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-2 font-display text-4xl font-extrabold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <StatusMessage status={actionStatus} message={actionMessage} />
          <div className="mt-8 border-t border-slate-200 pt-6">
            <h3 className="font-display text-xl font-bold text-slate-950">Relationship review queue</h3>
            <div className="mt-4 grid gap-3">
              {relationships.map((item) => {
                const isWorking = actionId === item.id;
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">{item.partner_name || 'Partner'}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.type || 'relationship'} • {item.privacy_level || 'private'} • {formatShortDate(item.start_date)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                        item.status === 'verified'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.status === 'ended'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.status || 'pending'}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      {item.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => updateRelationshipStatus(item.id, 'verified')}
                            className="min-h-[44px] flex-1 rounded-xl bg-emerald-600 px-4 font-bold text-white disabled:opacity-60"
                          >
                            {isWorking ? 'Working...' : 'Verify'}
                          </button>
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => updateRelationshipStatus(item.id, 'ended')}
                            className="min-h-[44px] flex-1 rounded-xl bg-rose-600 px-4 font-bold text-white disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      {item.status === 'verified' ? (
                        <button
                          type="button"
                          disabled={isWorking}
                          onClick={() => requestEndReview(item.id)}
                          className="min-h-[44px] flex-1 rounded-xl bg-amber-500 px-4 font-bold text-white disabled:opacity-60"
                        >
                          {isWorking ? 'Working...' : 'Open end review'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {relationships.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-600">No relationships found.</div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ProfessionalsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [bookingProfessionalId, setBookingProfessionalId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingStatus, setBookingStatus] = useState<Status>('idle');
  const [bookingMessage, setBookingMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = getSupabaseBrowser() as any;
        const { data, error: queryError } = await supabase
          .from('professional_profiles')
          .select(
            `
            id,full_name,bio,credentials,location,online_availability,in_person_availability,service_areas,pricing_info,languages,rating_average,rating_count,review_count,approval_status,is_active,
            professional_roles(name,category,description)
          `
          )
          .eq('approval_status', 'approved')
          .eq('is_active', true)
          .order('rating_average', { ascending: false })
          .limit(12);
        if (queryError) throw queryError;
        if (!cancelled) setProfessionals(data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load professionals.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestBooking = async (professional: any) => {
    if (!bookingDate || !bookingTime || bookingStatus === 'loading') return;
    setBookingProfessionalId(professional.id);
    setBookingStatus('loading');
    setBookingMessage('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in again.');
      if (!professional.user_id) throw new Error('Professional user account is missing.');

      const participantIds = [session.user.id, professional.user_id].sort();
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .contains('participant_ids', participantIds)
        .limit(1)
        .maybeSingle();
      let conversationId = existingConversation?.id;
      if (!conversationId) {
        const { data: conversation, error: conversationError } = await supabase
          .from('conversations')
          .insert({
            participant_ids: participantIds,
            last_message: bookingNotes || 'Booking request',
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (conversationError) throw conversationError;
        conversationId = conversation.id;
      }

      const scheduledDate = new Date(`${bookingDate}T${bookingTime}`);
      if (scheduledDate.getTime() <= Date.now()) throw new Error('Please choose a future date and time.');

      const price = professional.pricing_info;
      const { error: sessionError } = await supabase.from('professional_sessions').insert({
        conversation_id: conversationId,
        user_id: session.user.id,
        professional_id: professional.id,
        role_id: professional.role_id,
        session_type: 'offline_booking',
        status: 'scheduled',
        scheduled_date: scheduledDate.toISOString(),
        scheduled_duration_minutes: 60,
        location_type: 'online',
        booking_notes: bookingNotes.trim() || null,
        booking_fee_amount: price?.rate ?? null,
        booking_fee_currency: price?.currency ?? null,
        payment_status: price?.rate ? 'pending' : null,
      });
      if (sessionError) throw sessionError;

      await supabase.from('notifications').insert({
        user_id: professional.user_id,
        type: 'professional_booking',
        title: 'New Booking Request',
        message: 'A Committed user requested a professional session from the web app.',
        data: { professionalId: professional.id, conversationId },
      });

      setBookingStatus('success');
      setBookingMessage(`Booking request sent to ${professional.full_name}.`);
      setBookingNotes('');
    } catch (err) {
      setBookingStatus('error');
      setBookingMessage(err instanceof Error ? err.message : 'Unable to request booking.');
    } finally {
      setBookingProfessionalId('');
    }
  };

  return (
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-950">Professional directory</h2>
          <p className="mt-2 leading-7 text-slate-600">
            Browse approved professionals on web. Booking and live session management can continue in the mobile app.
          </p>
        </div>
        <Link href="/download" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">
          Book in app
        </Link>
      </div>
      {loading ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          <span className="font-medium text-slate-600">Loading professionals...</span>
        </div>
      ) : error ? (
        <StatusMessage status="error" message={error} />
      ) : professionals.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
          No approved professionals are available right now.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {professionals.map((pro) => {
            const role = Array.isArray(pro.professional_roles) ? pro.professional_roles[0] : pro.professional_roles;
            const price = pro.pricing_info;
            return (
              <article key={pro.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-xl font-bold text-slate-950">{pro.full_name}</h3>
                    <p className="mt-1 text-sm font-bold text-rose-700">{role?.name || 'Professional support'}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-emerald-700">Approved</span>
                </div>
                {pro.bio ? <p className="mt-4 line-clamp-3 leading-7 text-slate-700">{pro.bio}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    role?.category,
                    pro.location,
                    pro.online_availability ? 'Online' : null,
                    pro.in_person_availability ? 'In person' : null,
                    ...(pro.languages || []).slice(0, 2),
                  ]
                    .filter(Boolean)
                    .map((tag) => (
                      <span key={String(tag)} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                        {String(tag)}
                      </span>
                    ))}
                </div>
                <div className="mt-5 grid gap-3 rounded-2xl bg-white p-4 text-sm text-slate-600 sm:grid-cols-3">
                  <span>
                    <strong className="block text-slate-950">{Number(pro.rating_average || 0).toFixed(1)}</strong>
                    Rating
                  </span>
                  <span>
                    <strong className="block text-slate-950">{pro.review_count || pro.rating_count || 0}</strong>
                    Reviews
                  </span>
                  <span>
                    <strong className="block text-slate-950">
                      {price?.rate ? `${price.currency || '$'}${price.rate}` : 'Ask'}
                    </strong>
                    {price?.unit || 'Pricing'}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Date" type="date" value={bookingDate} onChange={setBookingDate} />
                    <Field label="Time" type="time" value={bookingTime} onChange={setBookingTime} />
                  </div>
                  <Textarea label="Notes" value={bookingNotes} onChange={setBookingNotes} maxLength={240} />
                  <button
                    type="button"
                    disabled={!bookingDate || !bookingTime || bookingProfessionalId === pro.id}
                    onClick={() => requestBooking(pro)}
                    className="min-h-[48px] rounded-2xl bg-violet-600 px-5 font-bold text-white disabled:opacity-60"
                  >
                    {bookingProfessionalId === pro.id ? 'Requesting...' : 'Request booking'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <StatusMessage status={bookingStatus} message={bookingMessage} />
    </section>
  );
}

function CommunityPanel({ initialTab = 'feed' }: { initialTab?: 'feed' | 'reels' }) {
  const INITIAL_BATCH = 5;
  const LOAD_STEP = 5;
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [content, setContent] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [postVisibleCount, setPostVisibleCount] = useState(INITIAL_BATCH);
  const [reelVisibleCount, setReelVisibleCount] = useState(INITIAL_BATCH);
  const [activeTab, setActiveTab] = useState<'feed' | 'reels'>(initialTab);
  const [likePending, setLikePending] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<Record<string, string | null>>({});
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isFollowingByUser, setIsFollowingByUser] = useState<Record<string, boolean>>({});
  const [followPendingByUser, setFollowPendingByUser] = useState<Record<string, boolean>>({});
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;
      setCurrentUserId(currentUserId || '');
      const [postResult, reelResult] = await Promise.all([
        supabase
          .from('posts')
          .select('id,user_id,content,media_urls,media_type,created_at,users!posts_user_id_fkey(full_name,profile_picture)')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('reels')
          .select('id,user_id,caption,video_url,thumbnail_url,created_at,users!reels_user_id_fkey(full_name,profile_picture)')
          .order('created_at', { ascending: false })
          .limit(32),
      ]);
      if (postResult.error) throw postResult.error;
      if (reelResult.error) throw reelResult.error;
      const postRows = postResult.data ?? [];
      const reelRows = reelResult.data ?? [];

      const postIds = postRows.map((item: any) => item.id);
      const reelIds = reelRows.map((item: any) => item.id);
      const authorIds: string[] = Array.from(
        new Set<string>(
          postRows
            .map((item: any) => item.user_id)
            .filter((userId: unknown): userId is string => typeof userId === 'string' && userId.length > 0)
        )
      );
      const [postLikesRes, postCommentsRes, reelLikesRes, reelCommentsRes, myPostLikesRes] = await Promise.all([
        postIds.length ? supabase.from('post_likes').select('post_id') .in('post_id', postIds) : Promise.resolve({ data: [] }),
        postIds.length ? supabase.from('comments').select('id,post_id,parent_comment_id,content,created_at,users!comments_user_id_fkey(full_name)').in('post_id', postIds) : Promise.resolve({ data: [] }),
        reelIds.length ? supabase.from('reel_likes').select('reel_id').in('reel_id', reelIds) : Promise.resolve({ data: [] }),
        reelIds.length ? supabase.from('reel_comments').select('id,reel_id').in('reel_id', reelIds) : Promise.resolve({ data: [] }),
        currentUserId && postIds.length ? supabase.from('post_likes').select('post_id').eq('user_id', currentUserId).in('post_id', postIds) : Promise.resolve({ data: [] }),
      ]);
      let followingRows: any[] = [];
      if (currentUserId && authorIds.length) {
        const { data } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUserId)
          .in('following_id', authorIds);
        followingRows = data ?? [];
      }

      const postLikeCounts = new Map<string, number>();
      (postLikesRes.data ?? []).forEach((row: any) => {
        postLikeCounts.set(row.post_id, (postLikeCounts.get(row.post_id) || 0) + 1);
      });
      const reelLikeCounts = new Map<string, number>();
      (reelLikesRes.data ?? []).forEach((row: any) => {
        reelLikeCounts.set(row.reel_id, (reelLikeCounts.get(row.reel_id) || 0) + 1);
      });
      const postCommentCounts = new Map<string, number>();
      const commentsByPost = new Map<string, any[]>();
      (postCommentsRes.data ?? []).forEach((row: any) => {
        postCommentCounts.set(row.post_id, (postCommentCounts.get(row.post_id) || 0) + 1);
        if (!commentsByPost.has(row.post_id)) commentsByPost.set(row.post_id, []);
        commentsByPost.get(row.post_id)!.push(row);
      });
      const reelCommentCounts = new Map<string, number>();
      (reelCommentsRes.data ?? []).forEach((row: any) => {
        reelCommentCounts.set(row.reel_id, (reelCommentCounts.get(row.reel_id) || 0) + 1);
      });
      const myPostLikes = new Set<string>((myPostLikesRes.data ?? []).map((row: any) => row.post_id));
      const followingSet = new Set<string>(followingRows.map((row: any) => row.following_id));
      const followingMap: Record<string, boolean> = {};
      authorIds.forEach((id) => {
        followingMap[id] = followingSet.has(id);
      });
      setIsFollowingByUser(followingMap);

      setPosts(
        postRows.map((post: any) => ({
          ...post,
          likesCount: postLikeCounts.get(post.id) || 0,
          commentsCount: postCommentCounts.get(post.id) || 0,
          isLiked: myPostLikes.has(post.id),
          comments: commentsByPost.get(post.id) || [],
        }))
      );
      setReels(
        reelRows.map((reel: any) => ({
          ...reel,
          likesCount: reelLikeCounts.get(reel.id) || 0,
          commentsCount: reelCommentCounts.get(reel.id) || 0,
        }))
      );
      setPostVisibleCount(INITIAL_BATCH);
      setReelVisibleCount(INITIAL_BATCH);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim() || status === 'loading') return;
    setStatus('loading');
    setMessage('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in again.');
      const { error } = await supabase.from('posts').insert({
        user_id: session.user.id,
        content: content.trim(),
        media_urls: [],
        media_type: 'text',
      });
      if (error) throw error;
      setContent('');
      setStatus('success');
      setMessage('Post published.');
      await load();
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unable to publish post.');
    }
  };

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      if (activeTab === 'feed') {
        setPostVisibleCount((count) => Math.min(count + LOAD_STEP, posts.length));
      } else {
        setReelVisibleCount((count) => Math.min(count + LOAD_STEP, reels.length));
      }
    }, { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeTab, posts.length, reels.length]);

  const togglePostLike = async (postId: string) => {
    if (likePending[postId]) return;
    const supabase = getSupabaseBrowser() as any;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setStatus('error');
      setMessage('Please sign in to react.');
      return;
    }
    const current = posts.find((post) => post.id === postId);
    if (!current) return;
    const nextLiked = !current.isLiked;
    setLikePending((value) => ({ ...value, [postId]: true }));
    setPosts((items) =>
      items.map((post) =>
        post.id === postId
          ? { ...post, isLiked: nextLiked, likesCount: Math.max(0, (post.likesCount || 0) + (nextLiked ? 1 : -1)) }
          : post
      )
    );
    try {
      if (nextLiked) {
        const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: session.user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', session.user.id);
        if (error) throw error;
      }
    } catch {
      setPosts((items) => items.map((post) => (post.id === postId ? current : post)));
    } finally {
      setLikePending((value) => ({ ...value, [postId]: false }));
    }
  };

  const addPostComment = async (postId: string) => {
    const text = (commentDraft[postId] || '').trim();
    if (!text) return;
    const supabase = getSupabaseBrowser() as any;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setStatus('error');
      setMessage('Please sign in to comment.');
      return;
    }
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: session.user.id, content: text, parent_comment_id: null, message_type: 'text' })
      .select('id,post_id,parent_comment_id,content,created_at,users!comments_user_id_fkey(full_name)')
      .single();
    if (error || !data) {
      setStatus('error');
      setMessage(error?.message || 'Unable to post comment.');
      return;
    }
    setCommentDraft((value) => ({ ...value, [postId]: '' }));
    setPosts((items) =>
      items.map((post) =>
        post.id === postId
          ? { ...post, commentsCount: (post.commentsCount || 0) + 1, comments: [...(post.comments || []), data] }
          : post
      )
    );
  };

  const addReply = async (postId: string, parentCommentId: string) => {
    const key = `${postId}:${parentCommentId}`;
    const text = (replyDraft[key] || '').trim();
    if (!text) return;
    const supabase = getSupabaseBrowser() as any;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: session.user.id, content: text, parent_comment_id: parentCommentId, message_type: 'text' })
      .select('id,post_id,parent_comment_id,content,created_at,users!comments_user_id_fkey(full_name)')
      .single();
    if (error || !data) return;
    setReplyDraft((value) => ({ ...value, [key]: '' }));
    setReplyingTo((value) => ({ ...value, [postId]: null }));
    setPosts((items) =>
      items.map((post) =>
        post.id === postId
          ? { ...post, commentsCount: (post.commentsCount || 0) + 1, comments: [...(post.comments || []), data] }
          : post
      )
    );
  };

  const startConversation = async (targetUserId: string) => {
    if (!currentUserId || !targetUserId || targetUserId === currentUserId) return;
    const supabase = getSupabaseBrowser() as any;
    const participantIds = [currentUserId, targetUserId].sort();
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .contains('participant_ids', participantIds)
      .limit(1)
      .maybeSingle();
    let conversationId = existingConversation?.id;
    if (!conversationId) {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          participant_ids: participantIds,
          last_message: 'Conversation started from web feed',
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) return;
      conversationId = conversation.id;
    }
    window.location.href = `/app/messages?conversationId=${encodeURIComponent(conversationId)}`;
  };

  const toggleFollow = async (targetUserId: string) => {
    if (!currentUserId || currentUserId === targetUserId || followPendingByUser[targetUserId]) return;
    const supabase = getSupabaseBrowser() as any;
    const currentlyFollowing = Boolean(isFollowingByUser[targetUserId]);
    setFollowPendingByUser((value) => ({ ...value, [targetUserId]: true }));
    setIsFollowingByUser((value) => ({ ...value, [targetUserId]: !currentlyFollowing }));
    try {
      if (currentlyFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: targetUserId });
        if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
      }
    } catch {
      setIsFollowingByUser((value) => ({ ...value, [targetUserId]: currentlyFollowing }));
    } finally {
      setFollowPendingByUser((value) => ({ ...value, [targetUserId]: false }));
    }
  };

  const visiblePosts = posts.slice(0, postVisibleCount);
  const visibleReels = reels.slice(0, reelVisibleCount);

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <h2 className="text-xl font-bold text-slate-950">Community</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">Mobile-style feed and reels with lazy loading, comments, replies, likes, and quick actions.</p>
      <div className="mt-4 inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
        <button type="button" onClick={() => setActiveTab('feed')} className={`rounded-lg px-4 py-2 text-xs font-bold ${activeTab === 'feed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
          Feed
        </button>
        <button type="button" onClick={() => setActiveTab('reels')} className={`rounded-lg px-4 py-2 text-xs font-bold ${activeTab === 'reels' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
          Reels
        </button>
      </div>
      <form onSubmit={createPost} className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <Textarea label="Create post" value={content} onChange={setContent} maxLength={800} />
        <button type="submit" disabled={!content.trim() || status === 'loading'} className="min-h-[44px] rounded-xl bg-rose-600 px-4 text-sm font-bold text-white transition hover:bg-rose-500 active:scale-[0.98] disabled:opacity-60">
          {status === 'loading' ? 'Publishing...' : 'Publish post'}
        </button>
      </form>
      <StatusMessage status={status} message={message} />
      {loading ? (
        <div className="mt-8 grid gap-3">
          {Array.from({ length: INITIAL_BATCH }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : activeTab === 'feed' ? (
        <div className="mt-5">
          <div className="grid gap-4">
            {visiblePosts.map((post) => {
              const topLevelComments = (post.comments || []).filter((item: any) => !item.parent_comment_id);
              const repliesByParent = (post.comments || []).reduce((acc: Record<string, any[]>, item: any) => {
                if (!item.parent_comment_id) return acc;
                if (!acc[item.parent_comment_id]) acc[item.parent_comment_id] = [];
                acc[item.parent_comment_id].push(item);
                return acc;
              }, {});
              return (
                <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/dating/user-profile?userId=${encodeURIComponent(post.user_id)}`} className="font-bold text-slate-950 hover:text-violet-700">
                      {post.users?.full_name || 'Committed member'}
                    </Link>
                    <div className="flex items-center gap-2">
                      {post.user_id && currentUserId && post.user_id !== currentUserId ? (
                        <button
                          type="button"
                          disabled={Boolean(followPendingByUser[post.user_id])}
                          onClick={() => void toggleFollow(post.user_id)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-[0.98] ${
                            isFollowingByUser[post.user_id]
                              ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              : 'bg-violet-600 text-white hover:bg-violet-500'
                          }`}
                        >
                          {isFollowingByUser[post.user_id] ? 'Following' : 'Follow'}
                        </button>
                      ) : null}
                      {post.user_id && currentUserId && post.user_id !== currentUserId ? (
                        <button
                          type="button"
                          onClick={() => void startConversation(post.user_id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                        >
                          Message
                        </button>
                      ) : null}
                      <Link href={`/post/${post.id}`} className="text-sm font-bold text-violet-700">Open</Link>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-slate-700">{post.content}</p>
                  <div className="mt-4 flex gap-2 text-sm font-semibold">
                    <button type="button" onClick={() => void togglePostLike(post.id)} className={`inline-flex min-h-[40px] items-center gap-1 rounded-xl px-4 py-2 transition active:scale-[0.98] ${post.isLiked ? 'bg-violet-100 text-violet-700 hover:bg-violet-200' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                      <ThumbsUp className="h-4 w-4" /> {post.likesCount || 0}
                    </button>
                    <span className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-white px-4 py-2 text-slate-700">
                      <MessageCircle className="h-4 w-4" /> {post.commentsCount || 0}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {topLevelComments.slice(0, 3).map((comment: any) => {
                      const key = `${post.id}:${comment.id}`;
                      return (
                        <div key={comment.id} className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-sm"><span className="font-bold">{comment.users?.full_name || 'Member'}:</span> {comment.content}</p>
                          <div className="mt-2 pl-3">
                            {(repliesByParent[comment.id] || []).slice(0, 2).map((reply: any) => (
                              <p key={reply.id} className="mt-1 text-sm text-slate-600"><span className="font-semibold">{reply.users?.full_name || 'Member'}:</span> {reply.content}</p>
                            ))}
                          </div>
                          <button type="button" onClick={() => setReplyingTo((value) => ({ ...value, [post.id]: comment.id }))} className="mt-2 text-xs font-semibold text-violet-700">
                            Reply
                          </button>
                          {replyingTo[post.id] === comment.id ? (
                            <div className="mt-2 flex gap-2">
                              <input value={replyDraft[key] || ''} onChange={(event) => setReplyDraft((value) => ({ ...value, [key]: event.target.value }))} placeholder="Write a reply..." className="min-h-[38px] flex-1 rounded-xl border border-slate-200 px-3 text-sm" />
                              <button type="button" onClick={() => void addReply(post.id, comment.id)} className="min-h-[38px] rounded-xl bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-500 active:scale-[0.98]">Send</button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    <div className="flex gap-2">
                      <input value={commentDraft[post.id] || ''} onChange={(event) => setCommentDraft((value) => ({ ...value, [post.id]: event.target.value }))} placeholder="Write a comment..." className="min-h-[40px] flex-1 rounded-xl border border-slate-200 px-3 text-sm" />
                      <button type="button" onClick={() => void addPostComment(post.id)} className="min-h-[40px] rounded-xl bg-rose-600 px-4 text-sm font-bold text-white transition hover:bg-rose-500 active:scale-[0.98]">Comment</button>
                    </div>
                  </div>
                </article>
              );
            })}
            {posts.length === 0 ? <p className="rounded-2xl bg-slate-50 p-5 text-slate-600">No posts yet.</p> : null}
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {visibleReels.map((reel) => (
            <article key={reel.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-video bg-slate-200">
                {reel.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={reel.thumbnail_url} alt={reel.caption || 'Reel thumbnail'} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400"><Film className="h-8 w-8" /></div>
                )}
              </div>
              <div className="p-4">
                <p className="font-bold text-slate-950">{reel.users?.full_name || 'Committed member'}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{reel.caption || 'Reel'}</p>
                <div className="mt-3 flex items-center justify-between text-sm font-semibold">
                  <span className="text-slate-600">{reel.likesCount || 0} likes • {reel.commentsCount || 0} comments</span>
                  <div className="flex items-center gap-3">
                    {reel.user_id && currentUserId && reel.user_id !== currentUserId ? (
                      <button
                        type="button"
                        onClick={() => void startConversation(reel.user_id)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                      >
                        Message
                      </button>
                    ) : null}
                    <Link href={`/reel/${reel.id}`} className="text-violet-700">Open reel</Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
          {reels.length === 0 ? <p className="rounded-2xl bg-slate-50 p-5 text-slate-600">No reels yet.</p> : null}
        </div>
      )}
      <div ref={loadMoreRef} className="h-6" />
    </section>
  );
}

function ProfilePanel() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ fullName: '', bio: '', city: '' });
  const [stats, setStats] = useState({ posts: 0, reels: 0, verifiedRelationships: 0 });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = getSupabaseBrowser() as any;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;
        const [userRow, profileRow, postCount, reelCount, relationshipCount] = await Promise.all([
          supabase.from('users').select('full_name').eq('id', session.user.id).maybeSingle(),
          supabase.from('dating_profiles').select('bio,location_city').eq('user_id', session.user.id).maybeSingle(),
          supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id),
          supabase.from('reels').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id),
          supabase.from('relationships').select('id', { count: 'exact', head: true }).or(`user_id.eq.${session.user.id},partner_user_id.eq.${session.user.id}`).eq('status', 'verified'),
        ]);
        if (cancelled) return;
        setForm({
          fullName: userRow.data?.full_name || '',
          bio: profileRow.data?.bio || '',
          city: profileRow.data?.location_city || '',
        });
        setStats({
          posts: postCount.count || 0,
          reels: reelCount.count || 0,
          verifiedRelationships: relationshipCount.count || 0,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in again.');
      const [userUpdate, profileUpdate] = await Promise.all([
        supabase.from('users').update({ full_name: form.fullName.trim() }).eq('id', session.user.id),
        supabase.from('dating_profiles').upsert({ user_id: session.user.id, bio: form.bio.trim(), location_city: form.city.trim() || null }, { onConflict: 'user_id' }),
      ]);
      if (userUpdate.error) throw userUpdate.error;
      if (profileUpdate.error) throw profileUpdate.error;
      setStatus('success');
      setMessage('Profile updated.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unable to save profile.');
    }
  };

  if (loading) return <LoadingPanel label="Loading profile..." />;

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <UserCircle2 className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-950">Profile</h2>
          <p className="text-sm text-slate-600">Keep core identity and social signals in sync with mobile.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Posts</p><p className="text-2xl font-bold text-slate-950">{stats.posts}</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Reels</p><p className="text-2xl font-bold text-slate-950">{stats.reels}</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Verified</p><p className="text-2xl font-bold text-slate-950">{stats.verifiedRelationships}</p></div>
      </div>
      <form onSubmit={save} className="mt-4 grid gap-3">
        <Field label="Full name" value={form.fullName} onChange={(value) => setForm({ ...form, fullName: value })} />
        <Field label="City" value={form.city} onChange={(value) => setForm({ ...form, city: value })} optional />
        <Textarea label="Bio" value={form.bio} onChange={(value) => setForm({ ...form, bio: value })} maxLength={500} />
        <button type="submit" disabled={status === 'loading'} className="min-h-[44px] rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-60">
          {status === 'loading' ? 'Saving...' : 'Save profile'}
        </button>
      </form>
      <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/app/messages" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"><MessageCircle className="h-4 w-4" /> Messages</Link>
        <Link href="/app/feed" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"><ThumbsUp className="h-4 w-4" /> Feed</Link>
        <Link href="/app/reels" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"><Film className="h-4 w-4" /> Reels</Link>
      </div>
      <StatusMessage status={status} message={message} />
    </section>
  );
}

function NotificationsPanel() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const [notificationRows, relationshipRequests] = await Promise.all([
        supabase
          .from('notifications')
          .select('id,title,message,type,read,created_at')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('relationship_requests')
          .select('id', { count: 'exact', head: true })
          .eq('to_user_id', session.user.id)
          .eq('status', 'pending'),
      ]);
      if (cancelled) return;
      setNotifications(notificationRows.data ?? []);
      setPendingRequests(relationshipRequests.count || 0);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <Bell className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-950">Notifications</h2>
          <p className="text-sm text-slate-600">Same notification flow, optimized for web reading.</p>
        </div>
      </div>
      {loading ? (
        <LoadingPanel label="Loading notifications..." />
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending relationship requests</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{pendingRequests}</p>
          </div>
          <div className="mt-4 grid gap-2">
            {notifications.map((item) => (
              <article key={item.id} className={`rounded-xl border p-3 ${item.read ? 'border-slate-200 bg-white' : 'border-violet-200 bg-violet-50'}`}>
                <p className="text-sm font-bold text-slate-950">{item.title || item.type || 'Notification'}</p>
                <p className="mt-1 text-sm text-slate-600">{item.message || 'No message content.'}</p>
                <p className="mt-1 text-xs text-slate-400">{formatShortDate(item.created_at)}</p>
              </article>
            ))}
            {notifications.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No notifications yet.</p> : null}
          </div>
        </>
      )}
    </section>
  );
}

function MessagesPanel() {
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [notice, setNotice] = useState('');
  const [preferredConversationId, setPreferredConversationId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('conversationId') || '';
    setPreferredConversationId(requested);
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    const supabase = getSupabaseBrowser() as any;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setLoading(false);
      return;
    }
    setCurrentUserId(session.user.id);
    const { data, error } = await supabase
      .from('conversations')
      .select('id,participant_ids,last_message,last_message_at,created_at')
      .contains('participant_ids', [session.user.id])
      .order('last_message_at', { ascending: false })
      .limit(30);
    if (!error) {
      const list = data ?? [];
      setConversations(list);
      if (preferredConversationId) {
        const requested = list.find((conversation: any) => conversation.id === preferredConversationId);
        if (requested) {
          await loadMessages(preferredConversationId);
        }
      }
    }
    setLoading(false);
  };

  const loadMessages = async (conversationId: string) => {
    setSelectedId(conversationId);
    const supabase = getSupabaseBrowser() as any;
    const { data } = await supabase
      .from('messages')
      .select('id,sender_id,receiver_id,content,message_type,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(80);
    setMessages(data ?? []);
  };

  useEffect(() => {
    void loadConversations();
  }, [preferredConversationId]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId || !draft.trim() || status === 'loading') return;
    setStatus('loading');
    setNotice('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in again.');
      const conversation = conversations.find((item) => item.id === selectedId);
      const receiverId = (conversation?.participant_ids || []).find((id: string) => id !== session.user.id);
      if (!receiverId) throw new Error('Could not find the message recipient.');
      const content = draft.trim();
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedId,
        sender_id: session.user.id,
        receiver_id: receiverId,
        content,
        message_type: 'text',
      });
      if (error) throw error;
      await supabase
        .from('conversations')
        .update({ last_message: content, last_message_at: new Date().toISOString() })
        .eq('id', selectedId);
      setDraft('');
      setStatus('success');
      setNotice('Message sent.');
      await loadMessages(selectedId);
      await loadConversations();
    } catch (err) {
      setStatus('error');
      setNotice(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <h2 className="text-xl font-bold text-slate-950">Messages</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">Mobile-like thread view for recent conversations and quick replies.</p>
      {loading ? (
        <LoadingPanel label="Loading conversations..." />
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => loadMessages(conversation.id)}
                className={`rounded-2xl border p-4 text-left ${selectedId === conversation.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-slate-50'}`}
              >
                <p className="font-bold text-slate-950">Conversation</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{conversation.last_message || 'No recent message'}</p>
              </button>
            ))}
            {conversations.length === 0 ? <p className="rounded-2xl bg-slate-50 p-5 text-slate-600">No conversations yet.</p> : null}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
              {messages.map((item) => (
                <div key={item.id} className={`max-w-[88%] rounded-2xl p-3 ${item.sender_id === currentUserId ? 'ml-auto bg-violet-600 text-white' : 'bg-white text-slate-800'}`}>
                  <p className="whitespace-pre-wrap">{item.content}</p>
                  <p className={`mt-1 text-xs ${item.sender_id === currentUserId ? 'text-violet-100' : 'text-slate-400'}`}>{formatShortDate(item.created_at)}</p>
                </div>
              ))}
              {selectedId && messages.length === 0 ? <p className="text-slate-500">No messages in this conversation yet.</p> : null}
              {!selectedId ? <p className="text-slate-500">Select a conversation to read and reply.</p> : null}
            </div>
            <form onSubmit={sendMessage} className="mt-4 flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type a message..."
                className="min-h-[48px] flex-1 rounded-2xl border border-slate-200 bg-white px-4 outline-none"
              />
              <button type="submit" disabled={!selectedId || !draft.trim() || status === 'loading'} className="rounded-2xl bg-violet-600 px-5 font-bold text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:opacity-60">
                Send
              </button>
            </form>
            <StatusMessage status={status === 'error' ? 'error' : 'success'} message={notice} />
          </div>
        </div>
      )}
    </section>
  );
}

function PromotionsPanel() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [ads, setAds] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    ctaType: 'whatsapp',
    ctaPhone: '',
    ctaUrl: '',
    placement: 'feed',
    dailyBudget: '5',
    totalBudget: '20',
  });

  const loadAds = async () => {
    const supabase = getSupabaseBrowser() as any;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data } = await supabase
      .from('advertisements')
      .select('id,title,description,status,active,placement,daily_budget,total_budget,created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setAds(data ?? []);
  };

  useEffect(() => {
    void loadAds();
  }, []);

  const createAd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim() || status === 'loading') return;
    setStatus('loading');
    setMessage('');
    try {
      const supabase = getSupabaseBrowser() as any;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in again.');
      const { error } = await supabase.from('advertisements').insert({
        user_id: session.user.id,
        created_by: session.user.id,
        title: form.title.trim(),
        description: form.description.trim(),
        image_url: form.imageUrl.trim() || null,
        type: 'card',
        placement: form.placement,
        active: false,
        status: 'pending_payment',
        cta_type: form.ctaType,
        cta_phone: form.ctaPhone.trim() || null,
        cta_url: form.ctaUrl.trim() || null,
        daily_budget: Number(form.dailyBudget) || 5,
        total_budget: Number(form.totalBudget) || 20,
        billing_provider: 'manual',
      });
      if (error) throw error;
      setStatus('success');
      setMessage('Ad draft created. Submit payment proof in the mobile app to activate review.');
      setForm({ title: '', description: '', imageUrl: '', ctaType: 'whatsapp', ctaPhone: '', ctaUrl: '', placement: 'feed', dailyBudget: '5', totalBudget: '20' });
      await loadAds();
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unable to create ad.');
    }
  };

  return (
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 md:p-8">
      <h2 className="font-display text-2xl font-bold text-slate-950">Promotions on web</h2>
      <p className="mt-2 leading-7 text-slate-600">Create a campaign draft from the browser. Payment proof and final activation continue in the app.</p>
      <form onSubmit={createAd} className="mt-6 grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <Field label="Creative image/video URL" value={form.imageUrl} onChange={(value) => setForm({ ...form, imageUrl: value })} optional />
          <SelectField label="CTA" value={form.ctaType} onChange={(value) => setForm({ ...form, ctaType: value })} options={[{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'messenger', label: 'Messenger' }, { value: 'website', label: 'Website' }]} />
          <SelectField label="Placement" value={form.placement} onChange={(value) => setForm({ ...form, placement: value })} options={[{ value: 'feed', label: 'Feed' }, { value: 'reels', label: 'Reels' }, { value: 'dating', label: 'Dating' }]} />
          <Field label="CTA phone" value={form.ctaPhone} onChange={(value) => setForm({ ...form, ctaPhone: value })} optional />
          <Field label="CTA website" value={form.ctaUrl} onChange={(value) => setForm({ ...form, ctaUrl: value })} optional />
          <Field label="Daily budget" type="number" value={form.dailyBudget} onChange={(value) => setForm({ ...form, dailyBudget: value })} />
          <Field label="Total budget" type="number" value={form.totalBudget} onChange={(value) => setForm({ ...form, totalBudget: value })} />
        </div>
        <Textarea label="Description" value={form.description} onChange={(value) => setForm({ ...form, description: value })} maxLength={500} />
        <button type="submit" disabled={!form.title.trim() || !form.description.trim() || status === 'loading'} className="min-h-[52px] rounded-2xl bg-rose-600 px-6 font-bold text-white disabled:opacity-60">
          {status === 'loading' ? 'Creating...' : 'Create campaign draft'}
        </button>
      </form>
      <StatusMessage status={status} message={message} />
      <div className="mt-8">
        <h3 className="font-display text-xl font-bold text-slate-950">My campaigns</h3>
        <div className="mt-4 grid gap-3">
          {ads.map((ad) => (
            <article key={ad.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950">{ad.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{ad.placement} • ${ad.daily_budget || 0}/day • ${ad.total_budget || 0} total</p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-700">{ad.status || 'pending'}</span>
              </div>
            </article>
          ))}
          {ads.length === 0 ? <p className="rounded-2xl bg-slate-50 p-5 text-slate-600">No campaigns yet.</p> : null}
        </div>
      </div>
    </section>
  );
}

function MobileContinuationPanel({ module }: { module: string }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ label: string; value: number }[]>([]);
  const [note, setNote] = useState('');

  const config = useMemo(() => {
    if (module === 'messages') {
      return {
        title: 'Messages overview',
        body: 'See your messaging activity and continue active conversations in the mobile app for the full chat experience.',
        queries: [
          { label: 'Messages sent', table: 'messages', filter: 'sender_id' },
          { label: 'Conversations', table: 'conversations', filter: null },
        ],
      };
    }
    if (module === 'feed') {
      return {
        title: 'Community overview',
        body: 'Review the community content surface. Shared post and reel links already open on web, while creation and comments continue in the app.',
        queries: [
          { label: 'Posts', table: 'posts', filter: null },
          { label: 'Reels', table: 'reels', filter: null },
          { label: 'My posts', table: 'posts', filter: 'user_id' },
        ],
      };
    }
    if (module === 'professionals') {
      return {
        title: 'Professional support overview',
        body: 'Check available professional support records and continue bookings, sessions, and reviews from the app.',
        queries: [
          { label: 'Approved professionals', table: 'professional_profiles', filter: null, eq: ['status', 'approved'] as [string, string] },
          { label: 'My sessions', table: 'professional_sessions', filter: 'client_id' },
          { label: 'Reviews', table: 'professional_reviews', filter: null },
        ],
      };
    }
    if (module === 'promotions') {
      return {
        title: 'Promotions overview',
        body: 'Track your ad surface. Creation, invoices, payment proofs, and campaign management remain available in the app.',
        queries: [
          { label: 'My ads', table: 'advertisements', filter: 'user_id' },
          { label: 'Active ads', table: 'advertisements', filter: null, eq: ['active', true] as [string, boolean] },
          { label: 'Payment receipts', table: 'ad_payment_receipts', filter: 'user_id' },
        ],
      };
    }
    return {
      title: 'Web module ready',
      body: `This browser route is protected by the same account gates. Continue in the mobile app for the full ${module} flow while this module is expanded on web.`,
      queries: [],
    };
  }, [module]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = getSupabaseBrowser() as any;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        const rows = await Promise.all(
          config.queries.map(async (query) => {
            let builder = supabase.from(query.table).select('id', { count: 'exact', head: true });
            if (query.filter && userId) builder = builder.eq(query.filter, userId);
            if ('eq' in query && query.eq) builder = builder.eq(query.eq[0], query.eq[1]);
            const { count, error } = await builder;
            if (error) throw error;
            return { label: query.label, value: count || 0 };
          })
        );
        if (!cancelled) setSummary(rows);
      } catch (err) {
        if (!cancelled) setNote(err instanceof Error ? err.message : 'Live module data could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [config]);

  return (
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 md:p-8">
      <h2 className="font-display text-2xl font-bold text-slate-950">{config.title}</h2>
      <p className="mt-2 leading-7 text-slate-600">{config.body}</p>

      {loading ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          <span className="font-medium text-slate-700">Loading live module data...</span>
        </div>
      ) : summary.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {summary.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">{item.label}</p>
              <p className="mt-2 font-display text-4xl font-extrabold text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {note ? <StatusMessage status="error" message={note} /> : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/download" className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-slate-950 px-6 font-bold text-white">
          Download or open the app
        </Link>
      </div>
    </section>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <section className="mt-8 flex items-center gap-3 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
      <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
      <p className="font-medium text-slate-700">{label}</p>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  optional,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-semibold text-slate-800">{label} {optional ? <span className="text-slate-400">(optional)</span> : null}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-[52px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-medium outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="font-semibold text-slate-800">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-[52px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-medium outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="font-semibold text-slate-800">{label}</span>
      <textarea
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-[130px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
      />
      {maxLength ? <span className="mt-1 block text-right text-sm text-slate-400">{value.length}/{maxLength}</span> : null}
    </label>
  );
}
