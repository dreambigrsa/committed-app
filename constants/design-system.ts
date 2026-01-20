/**
 * Design System Constants
 * Comprehensive design tokens for consistent UI/UX across the app
 */

// Spacing Scale (8px base unit)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Border Radius
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

// Typography Scale
export const typography = {
  // Font Sizes
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 40,
  },
  
  // Font Weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
  },
  
  // Letter Spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },
};

// Shadows (iOS and Android compatible)
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
};

// Animation Durations
export const animation = {
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 700,
};

// Z-Index Scale
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
};

// Component Sizes
export const sizes = {
  // Button Heights
  button: {
    sm: 36,
    md: 44,
    lg: 52,
    xl: 60,
  },
  
  // Input Heights
  input: {
    sm: 40,
    md: 48,
    lg: 56,
  },
  
  // Avatar Sizes
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
    xxl: 120,
  },
  
  // Icon Sizes
  icon: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
};

// Layout Constants
export const layout = {
  // Screen Padding
  screenPadding: spacing.md,
  screenPaddingHorizontal: spacing.md,
  screenPaddingVertical: spacing.md,
  
  // Card Padding
  cardPadding: spacing.md,
  cardPaddingLarge: spacing.lg,
  
  // Section Spacing
  sectionSpacing: spacing.xl,
  sectionSpacingLarge: spacing.xxl,
  
  // Max Content Width
  maxContentWidth: 1200,
  
  // Grid Gaps
  gridGap: spacing.md,
  gridGapLarge: spacing.lg,
};

// Opacity Values
export const opacity = {
  disabled: 0.5,
  hover: 0.8,
  pressed: 0.6,
  overlay: 0.5,
  subtle: 0.1,
  medium: 0.3,
};

// Breakpoints (for responsive design)
export const breakpoints = {
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
};

// Common Style Helpers
export const commonStyles = {
  // Flexbox Helpers
  flexRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  flexColumn: {
    flexDirection: 'column' as const,
  },
  flexCenter: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  flexBetween: {
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  
  // Spacing Helpers
  paddingHorizontal: (value: number) => ({
    paddingHorizontal: value,
  }),
  paddingVertical: (value: number) => ({
    paddingVertical: value,
  }),
  marginHorizontal: (value: number) => ({
    marginHorizontal: value,
  }),
  marginVertical: (value: number) => ({
    marginVertical: value,
  }),
  
  // Border Helpers
  borderTop: (color: string, width: number = 1) => ({
    borderTopWidth: width,
    borderTopColor: color,
  }),
  borderBottom: (color: string, width: number = 1) => ({
    borderBottomWidth: width,
    borderBottomColor: color,
  }),
  borderLeft: (color: string, width: number = 1) => ({
    borderLeftWidth: width,
    borderLeftColor: color,
  }),
  borderRight: (color: string, width: number = 1) => ({
    borderRightWidth: width,
    borderRightColor: color,
  }),
};

// Elevation (Material Design)
export const elevation = {
  level0: { elevation: 0 },
  level1: { elevation: 1 },
  level2: { elevation: 2 },
  level3: { elevation: 4 },
  level4: { elevation: 8 },
  level5: { elevation: 12 },
};

export default {
  spacing,
  borderRadius,
  typography,
  shadows,
  animation,
  zIndex,
  sizes,
  layout,
  opacity,
  breakpoints,
  commonStyles,
  elevation,
};

