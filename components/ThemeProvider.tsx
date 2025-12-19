import React, { useEffect } from 'react';
import { ThemeContext, useTheme } from '@/contexts/ThemeContext';
import { LanguageContext, useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';

// Component that loads user preferences when user logs in
function ThemeLoader() {
  const { currentUser } = useApp();
  const { loadThemePreference, loadVisualTheme } = useTheme();
  const { loadLanguagePreference } = useLanguage();

  useEffect(() => {
    if (currentUser?.id) {
      // Load theme and language preferences when user logs in
      loadThemePreference(currentUser.id);
      loadVisualTheme(currentUser.id);
      loadLanguagePreference(currentUser.id);
    }
  }, [currentUser?.id, loadThemePreference, loadVisualTheme, loadLanguagePreference]);

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

