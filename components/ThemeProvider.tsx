import React, { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { ThemeContext, useTheme } from '@/contexts/ThemeContext';
import { LanguageContext, useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// Component that loads user preferences when user logs in
function ThemeLoader() {
  const { user } = useAuth();
  const { loadThemePreference, loadVisualTheme } = useTheme();
  const { loadLanguagePreference } = useLanguage();

  const loadAllPreferences = React.useCallback(async (userId: string) => {
    await Promise.allSettled([
      loadThemePreference(userId),
      loadVisualTheme(userId),
      loadLanguagePreference(userId),
    ]);
  }, [loadThemePreference, loadVisualTheme, loadLanguagePreference]);

  useEffect(() => {
    if (user?.id) {
      // Load theme and language preferences when user logs in
      void loadAllPreferences(user.id);
    }
  }, [user?.id, loadAllPreferences]);

  useEffect(() => {
    if (!user?.id) return;
    const onAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void loadAllPreferences(user.id);
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [user?.id, loadAllPreferences]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user_settings_theme_sync_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadAllPreferences(user.id);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loadAllPreferences]);

  return null;
}

// Wrapper for ThemeContext and LanguageContext Providers
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext>
      <LanguageContext>
        <ThemeLoader />
        {children}
      </LanguageContext>
    </ThemeContext>
  );
}

