// Expo dynamic config so we can safely read environment variables at build time.
// This avoids relying on runtime `process.env` in React Native.
//
// Usage (Windows PowerShell):
//   $env:EXPO_PUBLIC_OPENAI_API_KEY="sk-..."; npm start
//
// The app reads this via `Constants.expoConfig.extra.openaiApiKey`.
import type { ExpoConfig, ConfigContext } from 'expo/config';

import appJson from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  // Merge config sources so Expo Doctor can see that app.json values are being used.
  // `config` is the base Expo config passed by the CLI, `app.json` is the static config in repo.
  const appJsonExpo = (appJson as any).expo ?? {};
  const base = {
    ...config,
    ...appJsonExpo,
    extra: {
      ...(config.extra ?? {}),
      ...(appJsonExpo.extra ?? {}),
    },
  } as ExpoConfig;

  return {
    ...base,
    extra: {
      ...(base.extra ?? {}),
      // Inject the key at build time (never hardcode keys in repo).
      openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? null,
    },
  };
};


