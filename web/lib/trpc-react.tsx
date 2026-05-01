'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { httpLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import superjson from 'superjson';
import type { AppRouter } from '@committed/backend/trpc/app-router';
import { getCommittedApiBaseUrl } from '@committed/shared';
import { getSupabaseBrowser } from '@/lib/supabase-client';

/**
 * Same tRPC surface as Expo (`lib/trpc.ts`), wired for Next.js + web Supabase session.
 * All data mutations that go through the committed API must use this client for parity.
 */
export const trpc = createTRPCReact<AppRouter>();

/** Invalidate React Query when Supabase session changes so tRPC picks up new Bearer token. */
function AuthSessionTrpcSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        void queryClient.invalidateQueries();
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);
  return null;
}

export function createCommittedTrpcClient() {
  return trpc.createClient({
    links: [
      httpLink({
        url: `${getCommittedApiBaseUrl({ useLocalhostWhenDevAndUnset: false })}/trpc`,
        transformer: superjson,
        async fetch(url, options) {
          const supabase = getSupabaseBrowser();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const headers = new Headers(options?.headers);
          if (session?.access_token) {
            headers.set('Authorization', `Bearer ${session.access_token}`);
          }
          return fetch(url, {
            ...options,
            headers,
          });
        },
      }),
    ],
  });
}

export function CommittedAppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  const [trpcClient] = useState(() => createCommittedTrpcClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthSessionTrpcSync />
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
