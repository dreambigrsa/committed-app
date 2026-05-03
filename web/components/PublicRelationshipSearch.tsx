'use client';

import { FormEvent, useState } from 'react';
import { CalendarHeart, CheckCircle2, Heart, Loader2, Search, Shield, ShieldCheck } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-client';

type RelationshipResult = {
  relationship_id: string;
  person_name: string;
  partner_name: string;
  relationship_type: string;
  relationship_status: string;
  start_date?: string | null;
  verified_date?: string | null;
};

function getRelationshipTypeLabel(type?: string | null) {
  const labels: Record<string, string> = {
    married: 'Married',
    engaged: 'Engaged',
    serious: 'Serious Relationship',
    dating: 'Dating',
  };
  return labels[type || ''] || type || 'Relationship';
}

function initials(name?: string | null) {
  const parts = (name || 'Committed').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'C';
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function normalizeRows(rows: any[]): RelationshipResult[] {
  return rows.map((row) => ({
    relationship_id: row.relationship_id || row.id,
    person_name: row.person_name || row.users?.full_name || 'Committed member',
    partner_name: row.partner_name || row.partner?.full_name || 'Partner',
    relationship_type: row.relationship_type || row.type,
    relationship_status: row.relationship_status || row.status,
    start_date: row.start_date,
    verified_date: row.verified_date,
  }));
}

async function runFallbackSearch(supabase: any, query: string) {
  const digits = query.replace(/\D/g, '');
  const clauses = [`partner_name.ilike.%${query}%`, `partner_phone.ilike.%${query}%`];
  if (digits.length >= 2) clauses.push(`partner_phone.ilike.%${digits}%`);

  const { data, error } = await supabase
    .from('relationships')
    .select(`
      id,
      type,
      status,
      start_date,
      verified_date,
      partner_name,
      partner_phone,
      users!relationships_user_id_fkey(full_name, phone_number),
      partner:users!relationships_partner_user_id_fkey(full_name, phone_number)
    `)
    .eq('status', 'verified')
    .eq('privacy_level', 'public')
    .or(clauses.join(','))
    .order('verified_date', { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) throw error;
  return normalizeRows(data || []);
}

export default function PublicRelationshipSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RelationshipResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2 || loading) {
      setMessage('Enter at least 2 characters to search the public registry.');
      return;
    }

    setLoading(true);
    setMessage('');
    setSearched(true);
    try {
      const supabase = getSupabaseBrowser() as any;
      const { data, error } = await supabase.rpc('public_relationship_search', {
        search_query: trimmed,
      });
      const nextResults = error ? await runFallbackSearch(supabase, trimmed) : normalizeRows(data || []);
      setResults(nextResults);
      if (nextResults.length === 0) {
        setMessage('No public verified relationship record matched that search.');
      }
    } catch (err) {
      setResults([]);
      setMessage(err instanceof Error ? err.message : 'Public relationship search is not available right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="trust-safety" className="bg-[#f8faf7] py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-950/5">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <div className="bg-slate-950 p-6 text-white md:p-8">
              <span className="inline-flex items-center gap-2 rounded-md bg-teal-400 px-3 py-1.5 text-xs font-black uppercase text-slate-950">
                <ShieldCheck className="h-4 w-4" />
                Public trust check
              </span>
              <h2 className="mt-6 max-w-xl text-4xl font-black leading-tight tracking-normal md:text-5xl">
                Search only what people chose to make public.
              </h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
                Committed only shows relationship records that are verified and marked public. Private, pending, and ended records stay hidden.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  ['Verified', 'Admin or partner-reviewed records'],
                  ['Public only', 'Visibility remains user-controlled'],
                  ['Protected', 'Reports go through review'],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-md border border-white/12 bg-white/10 p-4">
                    <p className="font-black text-teal-200">{title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-300">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 md:p-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase text-teal-700">Registry search</p>
                  <p className="mt-1 text-sm text-slate-500">Search by a public name or phone number.</p>
                </div>
                <Shield className="h-8 w-8 text-teal-600" />
              </div>
              <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor="public-relationship-query">
                  Search public relationships
                </label>
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="public-relationship-query"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Name or phone number"
                    className="min-h-[54px] w-full rounded-md border border-slate-200 bg-slate-50 pl-12 pr-4 font-semibold outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                    autoComplete="off"
                  />
                </div>
                <button
                  type="submit"
                  disabled={query.trim().length < 2 || loading}
                  className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-md bg-teal-500 px-6 font-black text-slate-950 shadow-lg shadow-teal-100 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                  Search
                </button>
              </form>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-md bg-teal-50 px-4 py-3 text-sm font-bold text-teal-900">
                  <Shield className="h-4 w-4 text-teal-700" />
                  Verified public records only
                </div>
                <div className="flex items-center gap-2 rounded-md bg-rose-50 px-4 py-3 text-sm font-bold text-rose-900">
                  <Heart className="h-4 w-4 text-rose-600" />
                  Private records stay private
                </div>
              </div>

              {message ? (
                <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  {message}
                </p>
              ) : null}

              <div className="mt-5 space-y-3">
                {results.map((item) => {
                  const verifiedDate = formatDate(item.verified_date);
                  const startDate = formatDate(item.start_date);
                  return (
                    <article key={item.relationship_id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-4">
                        <div className="relative flex h-16 w-24 shrink-0 items-center">
                          <div className="grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-sm font-black text-white">
                            {initials(item.person_name)}
                          </div>
                          <div className="absolute left-10 grid h-14 w-14 place-items-center rounded-full bg-pink-600 text-sm font-black text-white ring-4 ring-slate-50">
                            {initials(item.partner_name)}
                          </div>
                          <div className="absolute left-[38px] top-5 grid h-7 w-7 place-items-center rounded-full bg-white text-pink-600 shadow-sm">
                            <Heart className="h-4 w-4 fill-pink-600" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="truncate text-lg font-black text-slate-950">{item.person_name}</p>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Verified
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-slate-600">with {item.partner_name}</p>
                          <p className="mt-2 text-sm text-slate-500">{getRelationshipTypeLabel(item.relationship_type)} relationship</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          Public record
                        </span>
                        {verifiedDate ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Verified {verifiedDate}
                          </span>
                        ) : null}
                        {startDate ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5">
                            <CalendarHeart className="h-3.5 w-3.5 text-pink-600" />
                            Started {startDate}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>

              {searched && !loading && !message && results.length === 0 ? (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
                  <ShieldCheck className="mx-auto h-9 w-9 text-slate-400" />
                  <p className="mt-3 text-lg font-black text-slate-950">No public verified relationship found</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Try another spelling, full name, or phone number.
                  </p>
                </div>
              ) : null}

              <div className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <p className="font-black text-slate-950">Privacy-first by design</p>
                <p className="mt-1">
                  A report does not automatically remove a relationship from search. Only admin actions can end or remove a verified record.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
