import { palette, themeVars, type ColorScheme, type Palette } from '@hopium/ui';
import { vars } from 'nativewind';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme as useSystemScheme, View } from 'react-native';

export type ThemePreference = ColorScheme | 'system';

interface ThemeContextValue {
  scheme: ColorScheme;
  preference: ThemePreference;
  colors: Palette;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  /** Brand default is dark; `system` follows the OS setting. */
  initialPreference?: ThemePreference;
}

export function ThemeProvider({ children, initialPreference = 'dark' }: ThemeProviderProps) {
  const system = useSystemScheme();
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);
  const scheme: ColorScheme =
    preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;

  const cssVars = useMemo(() => themeVars(scheme), [scheme]);
  const style = useMemo(() => vars(cssVars), [cssVars]);

  // On web, modals and portals mount outside this View, so mirror the
  // variables onto <html> to keep every surface themed.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    for (const [name, value] of Object.entries(cssVars)) root.style.setProperty(name, value);
    root.style.colorScheme = scheme;
    root.style.backgroundColor = palette[scheme].bg;
  }, [cssVars, scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, preference, colors: palette[scheme], setPreference }),
    [scheme, preference],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1, backgroundColor: palette[scheme].bg }, style]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
