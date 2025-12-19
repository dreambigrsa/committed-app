import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import createContextHook from '@nkzw/create-context-hook';
import { Language, getTranslation } from '@/lib/translations';

export const [LanguageContext, useLanguage] = createContextHook(() => {
  const [language, setLanguage] = useState<Language>('en');

  // Load language preference from database
  const loadLanguagePreference = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('language')
        .eq('user_id', userId)
        .single();

      if (!error && data?.language) {
        setLanguage(data.language as Language);
      }
    } catch (error) {
      console.error('Failed to load language preference:', error);
    }
  }, []);

  // Save language preference to database
  const saveLanguagePreference = useCallback(async (userId: string, lang: Language) => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          language: lang,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      setLanguage(lang);
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  }, []);

  // Translation function
  const t = useCallback((key: string): string => {
    return getTranslation(key, language);
  }, [language]);

  return {
    language,
    setLanguage,
    loadLanguagePreference,
    saveLanguagePreference,
    t, // Translation function
  };
});

