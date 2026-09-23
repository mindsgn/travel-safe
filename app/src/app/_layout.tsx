import '@/tasks';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useForegroundSync } from '@/hooks/use-foreground-sync';
import { registerBackgroundSync } from '@/lib/background';
import { configureNotifications } from '@/lib/notifications';
import { getAppStore, useAppStore } from '@/store';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotifications().catch(() => undefined);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const hydrated = useAppStore((state) => state.hydrated);
  const onboardingComplete = useAppStore((state) => state.onboardingComplete);
  const registered = useAppStore((state) => state.registered);

  useEffect(() => {
    void getAppStore().getState().hydrate();
  }, []);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated]);

  useEffect(() => {
    if (registered) void registerBackgroundSync();
  }, [registered]);

  useForegroundSync(hydrated && registered);

  if (!hydrated) return null;

  const ready = onboardingComplete && registered;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={ready}>
            <Stack.Screen name="(home)" />
            <Stack.Screen name="contacts" />
            <Stack.Screen name="settings" />
          </Stack.Protected>
          <Stack.Protected guard={!ready}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
