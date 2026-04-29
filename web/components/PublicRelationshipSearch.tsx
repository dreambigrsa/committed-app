'use client';

import { FormEvent, useState } from 'react';
import { CalendarHeart, Loader2, Search, ShieldCheck } from 'lucide-react';
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

function formatDate(value?: string | null) {
  if (!value) return 'Date not shown';
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

export default function PublicRelationshipSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RelationshipResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2 || loading) return;

    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const supabase = getSupabaseBrowser() as any;
      const { data, error: rpcError } = await supabase.rpc('public_relationship_search', {
        search_query: trimmed,
      });
      if (rpcError) throw rpcError;
      setResults((data ?? []) as RelationshipResult[]);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Public relationship search is not available right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="public-search" className="relative overflow-hidden bg-slate-950 py-20 text-white md:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(244,63,94,0.28),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(124,58,237,0.22),transparent_30%)]" />
      <div className="relative mx-auto max-w-6xl px-6 md:px-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-rose-100">
              <ShieldCheck className="h-4 w-4" />
              Public relationship registry
            </span>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-tight md:text-5xl">
              Check verified public relationships.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Search by a public name or phone number. Committed only shows relationships that are verified and
              marked public. Private records and unverified records stay hidden.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white p-5 text-slate-950 shadow-2xl shadow-black/30 md:p-6">
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
                  placeholder="Search name or phone"
                  className="min-h-[54px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 font-medium outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
                />
              </div>
              <button
                type="submit"
                disabled={query.trim().length < 2 || loading}
                className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-violet-600 px-6 font-bold text-white shadow-lg shadow-rose-200/70 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                Search
              </button>
            </form>

            {error ? (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {error}
              </p>
            ) : null}

            <div className="mt-5 space-y-3">
              {results.map((item) => (
                <article key={item.relationship_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-xl font-bold text-slate-950">{item.person_name}</p>
                      <p className="mt-1 text-slate-600">
                        In a verified {item.relationship_type?.toLowerCase() || 'relationship'} with{' '}
                        <span className="font-semibold text-slate-950">{item.partner_name}</span>
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-emerald-700">
                      Verified
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
                      <CalendarHeart className="h-4 w-4 text-rose-500" />
                      Started {formatDate(item.start_date)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Verified {formatDate(item.verified_date)}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            {searched && !loading && !error && results.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                <ShieldCheck className="mx-auto h-9 w-9 text-slate-400" />
                <p className="mt-3 font-display text-lg font-bold text-slate-950">No public verified relationship found</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Try another spelling, full name, or phone number. Private, ended, reported-only, and unverified records do not appear here.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
