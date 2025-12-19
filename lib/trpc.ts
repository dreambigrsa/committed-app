import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { supabase } from "./supabase";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // Try to get from environment variable
  if (process.env.EXPO_PUBLIC_COMMITTED_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_COMMITTED_API_BASE_URL;
  }

  // Fallback to default or localhost for development
  // In production builds, this should be set via EAS environment variables
  const defaultUrl = "http://localhost:3000";
  console.warn(
    `EXPO_PUBLIC_COMMITTED_API_BASE_URL not set, using default: ${defaultUrl}`
  );
  return defaultUrl;
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      async fetch(url, options) {
        // Get the current session token
        const { data: { session } } = await supabase.auth.getSession();
        
        // Add Authorization header if session exists
        const headers = new Headers(options?.headers);
        if (session?.access_token) {
          headers.set("Authorization", `Bearer ${session.access_token}`);
        }
        
        return fetch(url, {
          ...options,
          headers,
        });
      },
    }),
  ],
});
