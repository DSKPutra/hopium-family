import type { ConfigContext, ExpoConfig } from 'expo/config';

const BG = '#07060F';
const sentryEnabled = !!process.env.EXPO_PUBLIC_SENTRY_DSN;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'hopium',
  slug: 'hopium-family',
  version: '1.0.0',
  scheme: 'hopium',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  backgroundColor: BG,
  icon: './assets/images/icon.png',
  ios: {
    bundleIdentifier: 'family.hopium.app',
    supportsTablet: true,
    associatedDomains: ['applinks:hopium.family'],
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSCameraUsageDescription: 'hopium.family uses the camera to scan wallet address QR codes.',
      NSFaceIDUsageDescription: 'hopium.family uses Face ID to lock the app and confirm trades.',
      NSPhotoLibraryUsageDescription: 'hopium.family uses your photo library to set a profile picture.',
    },
  },
  android: {
    package: 'family.hopium.app',
    predictiveBackGestureEnabled: false,
    adaptiveIcon: { foregroundImage: './assets/images/adaptive-icon.png', backgroundColor: BG },
    permissions: ['android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS', 'android.permission.USE_BIOMETRIC'],
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'hopium.family', pathPrefix: '/u/' },
          { scheme: 'https', host: 'hopium.family', pathPrefix: '/a/' },
          { scheme: 'https', host: 'hopium.family', pathPrefix: '/t/' },
          { scheme: 'https', host: 'hopium.family', pathPrefix: '/post/' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
    themeColor: BG,
    backgroundColor: BG,
    name: 'hopium.family',
    shortName: 'hopium',
    description: 'Social trading: crypto, stock tokens and perps with your family of traders.',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    'expo-localization',
    'expo-web-browser',
    'expo-apple-authentication',
    ['expo-splash-screen', { image: './assets/images/splash-icon.png', imageWidth: 180, backgroundColor: BG, dark: { backgroundColor: BG } }],
    ['expo-local-authentication', { faceIDPermission: 'hopium.family uses Face ID to lock the app and confirm trades.' }],
    ['expo-camera', { cameraPermission: 'hopium.family uses the camera to scan wallet address QR codes.', recordAudioAndroid: false }],
    ['expo-image-picker', { photosPermission: 'hopium.family uses your photo library to set a profile picture.', cameraPermission: false }],
    ['expo-notifications', { icon: './assets/images/adaptive-icon.png', color: '#3DFFA8' }],
    ['expo-build-properties', { ios: { deploymentTarget: '16.4' }, android: { minSdkVersion: 26 } }],
    ...(sentryEnabled ? [['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }] as [string, object]] : []),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  runtimeVersion: { policy: 'appVersion' },
  updates: process.env.EAS_PROJECT_ID ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` } : undefined,
  extra: {
    build: process.env.BUILD_NUMBER ?? '1',
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
