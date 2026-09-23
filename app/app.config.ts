import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Static configuration lives in app.json; this file only adds values that depend on the
 * build environment. No secrets belong here: EXPO_PUBLIC_* values are embedded in the app.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const isProduction = process.env.APP_ENV === 'production';
  const plugins = [...(config.plugins ?? [])];

  if (!isProduction) {
    // Lets development builds reach a local API over plain HTTP; production must use HTTPS.
    plugins.push(['expo-build-properties', { ios: { enableSceneSupport: true }, android: { usesCleartextTraffic: true } }]);
  } else {
    plugins.push(['expo-build-properties', { ios: { enableSceneSupport: true } }]);
  }

  return {
    ...config,
    name: config.name ?? 'Travel Safe',
    slug: config.slug ?? 'travel-safe',
    plugins,
  };
};
