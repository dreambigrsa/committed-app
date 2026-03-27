// Translation strings for i18n support

export type Language = 'en' | 'es' | 'fr';

export const translations = {
  en: {
    // Settings
    settings: 'Settings',
    notifications: 'Notifications',
    language: 'Language',
    theme: 'Theme',
    darkMode: 'Dark Mode',
    relationshipUpdates: 'Relationship Updates',
    cheatingAlerts: 'Cheating Alerts',
    verificationAttempts: 'Verification Attempts',
    anniversaryReminders: 'Anniversary Reminders',
    marketingPromotions: 'Marketing & Promotions',
    
    // Theme options
    default: 'Default',
    colorful: 'Colorful',
    minimal: 'Minimal',
    
    // Language options
    english: 'English',
    spanish: 'Spanish',
    french: 'French',
    selectLanguage: 'Select language',
    selectTheme: 'Select theme',
    cancel: 'Cancel',
    
    // Common
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    done: 'Done',
  },
  es: {
    // Settings
    settings: 'Configuración',
    notifications: 'Notificaciones',
    language: 'Idioma',
    theme: 'Tema',
    darkMode: 'Modo Oscuro',
    relationshipUpdates: 'Actualizaciones de Relación',
    cheatingAlerts: 'Alertas de Infidelidad',
    verificationAttempts: 'Intentos de Verificación',
    anniversaryReminders: 'Recordatorios de Aniversario',
    marketingPromotions: 'Marketing y Promociones',
    
    // Theme options
    default: 'Predeterminado',
    colorful: 'Colorido',
    minimal: 'Minimalista',
    
    // Language options
    english: 'Inglés',
    spanish: 'Español',
    french: 'Francés',
    selectLanguage: 'Seleccionar idioma',
    selectTheme: 'Seleccionar tema',
    cancel: 'Cancelar',
    
    // Common
    save: 'Guardar',
    delete: 'Eliminar',
    edit: 'Editar',
    done: 'Hecho',
  },
  fr: {
    // Settings
    settings: 'Paramètres',
    notifications: 'Notifications',
    language: 'Langue',
    theme: 'Thème',
    darkMode: 'Mode Sombre',
    relationshipUpdates: 'Mises à Jour de Relation',
    cheatingAlerts: 'Alertes de Tromperie',
    verificationAttempts: 'Tentatives de Vérification',
    anniversaryReminders: 'Rappels d\'Anniversaire',
    marketingPromotions: 'Marketing et Promotions',
    
    // Theme options
    default: 'Par Défaut',
    colorful: 'Coloré',
    minimal: 'Minimal',
    
    // Language options
    english: 'Anglais',
    spanish: 'Espagnol',
    french: 'Français',
    selectLanguage: 'Sélectionner la langue',
    selectTheme: 'Sélectionner le thème',
    cancel: 'Annuler',
    
    // Common
    save: 'Enregistrer',
    delete: 'Supprimer',
    edit: 'Modifier',
    done: 'Terminé',
  },
};

export function getTranslation(key: string, language: Language = 'en'): string {
  const langTranslations = translations[language];
  return (langTranslations as any)[key] || (translations.en as any)[key] || key;
}

