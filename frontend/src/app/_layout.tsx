import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { Suspense, useEffect, useState } from 'react';
import * as Mapbox from '@rnmapbox/maps';
import { db, DATABASE_NAME } from "@/db/client";
import { SQLiteProvider } from 'expo-sqlite';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "@/drizzle/migrations";
import { configureMapbox } from '@/lib/map/mapbox';

SplashScreen.preventAutoHideAsync();
configureMapbox(undefined, Mapbox as { setAccessToken: (token: string) => void });

function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(home)" />
      <Stack.Screen name="place-search" />
      <Stack.Screen name="trusted-contacts" />
      <Stack.Screen name="trusted-contacts/onboarding" />
      <Stack.Screen name="trusted-contacts/add" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [migrationReady, setMigrationReady] = useState(false);
  const [migrationFailed, setMigrationFailed] = useState(false);

  useEffect(() => {
    let active = true;
    migrate(db, migrations)
      .then(() => {
        if (active) setMigrationReady(true);
      })
      .catch(() => {
        if (active) setMigrationFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (migrationFailed) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }} />
    );
  }

  if (!migrationReady) {
    return (
      <Suspense fallback={<ActivityIndicator size="large" />}>
        <SQLiteProvider
          databaseName={DATABASE_NAME}
          options={{ enableChangeListener: true }}
          useSuspense
        >
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" />
          </View>
        </SQLiteProvider>
      </Suspense>
    );
  }

  return (
  <Suspense fallback={<ActivityIndicator size="large" />}>
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      options={{ enableChangeListener: true }}
      useSuspense
    >
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <RootNavigator />
      </ThemeProvider>
    </SQLiteProvider>
    </Suspense>
  );
}
