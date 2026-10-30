import '../lib/background/task'; // registers the background task definition at startup
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider, useApp } from '../ui/AppState';
import { LogoMark } from '../ui/components/Logo';
import { ErrorBanner, Loading } from '../ui/components/primitives';
import { ThemeProvider, useTheme } from '../ui/theme';

function Gate() {
  const { db, error } = useApp();
  const c = useTheme();
  if (!db) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: 24, alignItems: 'center' }}>
        <LogoMark size={64} />
        {error ? <View style={{ marginTop: 24, alignSelf: 'stretch' }}><ErrorBanner message={error} /></View> : <Loading label="Opening local database" />}
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: c.bg },
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

function Themed() {
  const { settings } = useApp();
  return (
    <ThemeProvider preference={settings.theme}>
      <ThemedStatus />
      <Gate />
    </ThemeProvider>
  );
}

function ThemedStatus() {
  const c = useTheme();
  return <StatusBar style={c.mode === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStateProvider>
          <Themed />
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
