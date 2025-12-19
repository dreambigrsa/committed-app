import { useMemo } from 'react';
import colors from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';

type ColorType = typeof colors;

/**
 * Hook to create styles that automatically update with theme changes
 * Usage: const styles = useStyles(createStyles);
 * 
 * @param createStylesFn Function that takes colors and returns StyleSheet
 */
export function useStyles<T extends Record<string, any>>(
  createStylesFn: (colors: ColorType) => T
): T {
  const { colors: themeColors } = useTheme();
  
  return useMemo(() => {
    return createStylesFn(themeColors);
  }, [themeColors, createStylesFn]);
}

/**
 * For files that can't use hooks, create styles with current colors
 * This will use the global colors object which gets updated by ThemeContext
 */
export function createStyles<T extends Record<string, any>>(
  createStylesFn: (colors: ColorType) => T
): T {
  return createStylesFn(colors);
}

