import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'travel-safe',
  slug: 'travel-safe',
  version: '0.0.2',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'travelsafe',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/travel.icon',
    bundleIdentifier: 'makers.travel.safe',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#4cf56b',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    package: 'makers.travel.safe',
    usesCleartextTraffic: true,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#4cf56b',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          enableSceneSupport: true,
        },
      },
    ],
    [
      'expo-contacts',
      {
        contactsPermission: 'Allow $(PRODUCT_NAME) to access your contacts.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Allow $(PRODUCT_NAME) to use your location',
      },
    ],
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsDownloadToken: process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN,
      },
    ],
    [
      'expo-sqlite',
      {
        enableFTS: true,
        useSQLCipher: true,
        android: {
          enableFTS: false,
          useSQLCipher: false,
        },
        ios: {
          customBuildFlags: [
            '-DSQLITE_ENABLE_DBSTAT_VTAB=1 -DSQLITE_ENABLE_SNAPSHOT=1',
          ],
        },
      },
    ],
    [
      'react-native-maps',
      {
        // Android renders Google Maps tiles and needs a Maps SDK for Android
        // API key. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to provide one; without
        // it the app still builds but the Android map shows no tiles.
        androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;