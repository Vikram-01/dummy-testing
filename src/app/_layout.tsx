import '../lib/background/task'; // registers the background task definition at startup
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider, useApp } from '../ui/AppState';
import { Wordmark } from '../ui/components/Logo';
import { ErrorBanner, Loading } from '../ui/components/primitives';
import { fonts, ThemeProvider, useTheme } from '../ui/theme';

function Gate({ fontsReady }: { fontsReady: boolean }) {
  const { db, error } = useApp();
  const c = useTheme();
  if (!db || !fontsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface, justifyContent: 'center', padding: 24, alignItems: 'center' }}>
        <Wordmark size={26} />
        {error ? <View style={{ marginTop: 24, alignSelf: 'stretch' }}><ErrorBanner message={error} /></View> : <Loading label="Opening local database" />}
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.onSurface,
        headerTitleStyle: { fontFamily: fonts.regular, fontSize: 22 },
        contentStyle: { backgroundColor: c.surface },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      <Stack.Screen name="article/[id]" options={{ title: 'Article' }} />
      <Stack.Screen name="cve/[id]" options={{ title: 'Vulnerability' }} />
      <Stack.Screen name="browser" options={{ title: 'Browser' }} />
    </Stack>
  );
}

function Themed({ fontsReady }: { fontsReady: boolean }) {
  const { settings } = useApp();
  return (
    <ThemeProvider preference={settings.theme}>
      <SystemChrome />
      <Gate fontsReady={fontsReady} />
    </ThemeProvider>
  );
}

/** Keeps the status bar icons and the native root background in step with the theme. */
function SystemChrome() {
  const c = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.surface).catch(() => undefined);
  }, [c.surface]);
  return <StatusBar style={c.mode === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  // Outfit is also embedded natively by the expo-font config plugin; loading it
  // here keeps development builds identical and resolves instantly in release.
  const [loaded, fontError] = useFonts({
    [fonts.regular]: require('../../assets/fonts/Outfit_400Regular.ttf'),
    [fonts.medium]: require('../../assets/fonts/Outfit_500Medium.ttf'),
    [fonts.semibold]: require('../../assets/fonts/Outfit_600SemiBold.ttf'),
    [fonts.bold]: require('../../assets/fonts/Outfit_700Bold.ttf'),
  });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStateProvider>
          {/* If font loading fails the app still opens with the system font. */}
          <Themed fontsReady={loaded || !!fontError} />
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
