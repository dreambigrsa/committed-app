// Global colors store that gets updated by ThemeContext
// This is the SINGLE FILE that needs to be changed
// All other files can continue using: import colors from '@/constants/colors'

const lightColors = {
  primary: '#1A73E8',
  primaryDark: '#1557B0',
  secondary: '#34A853',
  accent: '#FBBC04',
  danger: '#EA4335',
  
  text: {
    primary: '#1F1F1F',
    secondary: '#5F6368',
    tertiary: '#9AA0A6',
    white: '#FFFFFF',
  },
  
  background: {
    primary: '#FFFFFF',
    secondary: '#F8F9FA',
    tertiary: '#E8EAED',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  
  border: {
    light: '#E8EAED',
    medium: '#DADCE0',
    dark: '#5F6368',
  },
  
  status: {
    verified: '#34A853',
    pending: '#FBBC04',
    ended: '#5F6368',
  },
  
  badge: {
    verified: '#E6F4EA',
    verifiedText: '#137333',
    pending: '#FEF7E0',
    pendingText: '#B06000',
  },
};

const darkColors = {
  primary: '#4285F4',
  primaryDark: '#1A73E8',
  secondary: '#34A853',
  accent: '#FBBC04',
  danger: '#EA4335',
  
  text: {
    primary: '#E8EAED',
    secondary: '#9AA0A6',
    tertiary: '#5F6368',
    white: '#FFFFFF',
  },
  
  background: {
    primary: '#1F1F1F',
    secondary: '#121212',
    tertiary: '#2D2D2D',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  
  border: {
    light: '#3C4043',
    medium: '#5F6368',
    dark: '#9AA0A6',
  },
  
  status: {
    verified: '#34A853',
    pending: '#FBBC04',
    ended: '#9AA0A6',
  },
  
  badge: {
    verified: '#1E3A2E',
    verifiedText: '#81C995',
    pending: '#3E2E1E',
    pendingText: '#FDD663',
  },
};

// Create colors object with proper nested structure - initialized immediately
// This ensures colors is always defined, even before ThemeContext initializes
// Using Object.assign to create a new object with all properties
const colors: typeof lightColors = {
  primary: lightColors.primary,
  primaryDark: lightColors.primaryDark,
  secondary: lightColors.secondary,
  accent: lightColors.accent,
  danger: lightColors.danger,
  text: {
    primary: lightColors.text.primary,
    secondary: lightColors.text.secondary,
    tertiary: lightColors.text.tertiary,
    white: lightColors.text.white,
  },
  background: {
    primary: lightColors.background.primary,
    secondary: lightColors.background.secondary,
    tertiary: lightColors.background.tertiary,
    overlay: lightColors.background.overlay,
  },
  border: {
    light: lightColors.border.light,
    medium: lightColors.border.medium,
    dark: lightColors.border.dark,
  },
  status: {
    verified: lightColors.status.verified,
    pending: lightColors.status.pending,
    ended: lightColors.status.ended,
  },
  badge: {
    verified: lightColors.badge.verified,
    verifiedText: lightColors.badge.verifiedText,
    pending: lightColors.badge.pending,
    pendingText: lightColors.badge.pendingText,
  },
};

// Visual theme color modifications
type VisualTheme = 'default' | 'colorful' | 'minimal';

function applyVisualTheme(baseColors: typeof lightColors, visualTheme: VisualTheme): typeof lightColors {
  if (visualTheme === 'default') {
    return baseColors;
  }

  const themed = { ...baseColors };

  if (visualTheme === 'colorful') {
    // More vibrant, colorful theme
    themed.primary = '#E91E63'; // Pink
    themed.secondary = '#00BCD4'; // Cyan
    themed.accent = '#FFC107'; // Amber
    themed.danger = '#F44336'; // Red
  } else if (visualTheme === 'minimal') {
    // Muted, minimal theme
    themed.primary = '#6C757D'; // Gray
    themed.secondary = '#495057'; // Dark Gray
    themed.accent = '#868E96'; // Light Gray
    themed.danger = '#DC3545'; // Red (unchanged)
  }

  return themed;
}

// Function to update global colors (called by ThemeContext)
export function updateGlobalColors(isDark: boolean, visualTheme: VisualTheme = 'default') {
  const baseColors = isDark ? darkColors : lightColors;
  const sourceColors = applyVisualTheme(baseColors, visualTheme);
  
  // Update all top-level properties
  colors.primary = sourceColors.primary;
  colors.primaryDark = sourceColors.primaryDark;
  colors.secondary = sourceColors.secondary;
  colors.accent = sourceColors.accent;
  colors.danger = sourceColors.danger;
  
  // Update nested objects - mutate in place to maintain references
  colors.text.primary = sourceColors.text.primary;
  colors.text.secondary = sourceColors.text.secondary;
  colors.text.tertiary = sourceColors.text.tertiary;
  colors.text.white = sourceColors.text.white;
  
  colors.background.primary = sourceColors.background.primary;
  colors.background.secondary = sourceColors.background.secondary;
  colors.background.tertiary = sourceColors.background.tertiary;
  colors.background.overlay = sourceColors.background.overlay;
  
  colors.border.light = sourceColors.border.light;
  colors.border.medium = sourceColors.border.medium;
  colors.border.dark = sourceColors.border.dark;
  
  colors.status.verified = sourceColors.status.verified;
  colors.status.pending = sourceColors.status.pending;
  colors.status.ended = sourceColors.status.ended;
  
  colors.badge.verified = sourceColors.badge.verified;
  colors.badge.verifiedText = sourceColors.badge.verifiedText;
  colors.badge.pending = sourceColors.badge.pending;
  colors.badge.pendingText = sourceColors.badge.pendingText;
}

// Ensure colors is always exported and available
// This default export makes colors available to all files that import it
export default colors;

// Also export as named export for flexibility
export { colors };
