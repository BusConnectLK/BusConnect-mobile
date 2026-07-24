/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Matches BusConnect-web's Facebook-style palette (globals.css) so the app
// feels like the same product, not a reskin: light gray page / white cards,
// dark neutral charcoal page / lighter charcoal cards, cobalt brand accent
// kept saturated in both modes.
export const Colors = {
  light: {
    text: '#050505',
    textSecondary: '#65676B',
    background: '#F0F2F5',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E6EEFB',
    border: '#DADDE1',
    brand: '#004aad',
    brandSoft: '#E6EEFB',
  },
  dark: {
    text: '#E4E6EB',
    textSecondary: '#B0B3B8',
    background: '#18191A',
    backgroundElement: '#242526',
    backgroundSelected: '#0D1F3F',
    border: '#3A3B3C',
    brand: '#3B82F6',
    brandSoft: '#0D1F3F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
