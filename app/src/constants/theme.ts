import { Platform } from 'react-native';

// Calm, trustworthy palette: a deep teal for safe states, amber for attention, and a
// muted red reserved for the triggered state so it keeps its meaning.
export const Colors = {
  light: {
    text: '#1c2024',
    background: '#f5f6f5',
    backgroundElement: '#ffffff',
    backgroundSelected: '#e3f1ec',
    textSecondary: '#5b6068',
    border: '#e1e4e2',
    brand: '#1f6f5c',
    brandText: '#ffffff',
    warning: '#a35200',
    warningBackground: '#fdf1e4',
    danger: '#b4232a',
    dangerBackground: '#fbe9e9',
    dangerText: '#ffffff',
  },
  dark: {
    text: '#edeeed',
    background: '#111312',
    backgroundElement: '#1b1d1c',
    backgroundSelected: '#1f3530',
    textSecondary: '#a9adab',
    border: '#2a2d2b',
    brand: '#5fc3a6',
    brandText: '#0b1f19',
    warning: '#f0a35e',
    warningBackground: '#2e2114',
    danger: '#ff7b7b',
    dangerBackground: '#351a1a',
    dangerText: '#1a0b0b',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
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
