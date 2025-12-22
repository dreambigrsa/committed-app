import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { supabase } from "./supabase";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // Try to get from environment variable first (highest priority)
  if (process.env.EXPO_PUBLIC_COMMITTED_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_COMMITTED_API_BASE_URL;
  }

  // For development, try to use the local network IP
  // This is needed when testing on physical devices
  // You can find your local IP by running: ipconfig (Windows) or ifconfig (Mac/Linux)
  // Then set it in a .env file: EXPO_PUBLIC_COMMITTED_API_BASE_URL=http://YOUR_IP:3000
  
  // Fallback to localhost (only works in emulator/simulator)
  const defaultUrl = __DEV__ 
    ? "http://localhost:3000" // Works in emulator/simulator
    : "https://committed-5mxf.onrender.com"; // Production fallback
  
  if (__DEV__) {
    console.warn(
      `⚠️ EXPO_PUBLIC_COMMITTED_API_BASE_URL not set!\n` +
      `For physical device testing, set it to your computer's IP address:\n` +
      `1. Find your IP: ipconfig (Windows) or ifconfig (Mac/Linux)\n` +
      `2. Create .env file: EXPO_PUBLIC_COMMITTED_API_BASE_URL=http://YOUR_IP:3000\n` +
      `3. Restart Expo\n` +
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
