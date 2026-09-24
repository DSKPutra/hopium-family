import type { ConfigContext, ExpoConfig } from 'expo/config';

const BG = '#07060F';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'hopium',
  slug: 'hopium-family',
  version: '1.0.0',
  scheme: 'hopium',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  backgroundColor: BG,
  ios: {
    bundleIdentifier: 'family.hopium.app',
    supportsTablet: true,
    associatedDomains: ['applinks:hopium.family'],
  },
  android: {
    package: 'family.hopium.app',
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'hopium.family' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    themeColor: BG,
    backgroundColor: BG,
    name: 'hopium.family',
    shortName: 'hopium',
  },
  plugins: ['expo-router'],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
