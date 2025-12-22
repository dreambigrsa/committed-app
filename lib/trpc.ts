import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { supabase } from "./supabase";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // Try to get from environment variable first (highest priority)
  // You can set this to:
  // 1. Production server: https://committed-5mxf.onrender.com (always works, no local server needed)
  // 2. Local server on physical device: http://YOUR_COMPUTER_IP:3000 (requires local server running)
  // 3. Local server on emulator: http://localhost:3000 (requires local server running)
  if (process.env.EXPO_PUBLIC_COMMITTED_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_COMMITTED_API_BASE_URL;
  }

  // Fallback options:
  // - In development: use localhost (only works in emulator/simulator)
  // - In production: use production server
  const defaultUrl = __DEV__ 
    ? "http://localhost:3000" // Only works in emulator/simulator
    : "https://committed-5mxf.onrender.com"; // Production server
  
  if (__DEV__) {
    console.warn(
      `⚠️ EXPO_PUBLIC_COMMITTED_API_BASE_URL not set!\n\n` +
      `OPTION 1: Use Production Server (Easiest - No local server needed)\n` +
      `  Create .env file: EXPO_PUBLIC_COMMITTED_API_BASE_URL=https://committed-5mxf.onrender.com\n\n` +
      `OPTION 2: Use Local Server (For development/testing)\n` +
      `  For physical device:\n` +
      `  1. Find your IP: ipconfig (Windows) or ifconfig (Mac/Linux)\n` +
      `  2. Create .env file: EXPO_PUBLIC_COMMITTED_API_BASE_URL=http://YOUR_IP:3000\n` +
      `  3. Run: bun run start:api\n` +
      `  For emulator: EXPO_PUBLIC_COMMITTED_API_BASE_URL=http://localhost:3000\n\n` +
      `Currently using: ${defaultUrl} (only works in emulator)`
    );
  }
  
  return defaultUrl;
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/trpc`,
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
