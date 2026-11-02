import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Two installable variants are produced from this one config:
 *   APP_VARIANT=debug   -> com.personalfinance360.app.debug  ("PF360 Debug", offline DEMO mode available)
 *   APP_VARIANT=release -> com.personalfinance360.app        ("Personal Finance 360", demo mode compiled out)
 * Both install side by side. See docs/BUILD.md.
 */
const variant = (process.env.APP_VARIANT ?? 'release') as 'debug' | 'release';
const isDebug = variant === 'debug';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
if (apiBaseUrl && !apiBaseUrl.startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must use https://');
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isDebug ? 'PF360 Debug' : 'Personal Finance 360',
  slug: 'personal-finance-360',
  owner: process.env.EAS_OWNER || undefined,
  scheme: 'pf360',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  android: {
    package: isDebug ? 'com.personalfinance360.app.debug' : 'com.personalfinance360.app',
    versionCode: 1,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#0B1220' },
    allowBackup: false,
    permissions: [
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
    ],
    blockedPermissions: [
      'android.permission.READ_SMS',
      'android.permission.RECEIVE_SMS',
      'android.permission.READ_CONTACTS',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { image: './assets/adaptive-icon.png', imageWidth: 180, resizeMode: 'contain', backgroundColor: '#0B1220' }],
    ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }],
    ['expo-local-authentication', { faceIDPermission: false }],
    ['expo-notifications', { color: '#2563EB' }],
    'expo-background-task',
    './plugins/withReleaseSigning',
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 26,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          usesCleartextTraffic: false,
          enableMinifyInReleaseBuilds: !isDebug,
          enableShrinkResourcesInReleaseBuilds: !isDebug,
          // 64-bit only. x86_64 is kept so the APK also runs on Android emulators.
          buildArchs: ['arm64-v8a', 'x86_64'],
        },
      },
    ],
  ],
  experiments: { typedRoutes: false },
  extra: {
    variant,
    apiBaseUrl,
    demoModeAvailable: isDebug,
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
