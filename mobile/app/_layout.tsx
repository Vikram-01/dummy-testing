import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useScreenProtection } from '@/lib/deviceSecurity';
import { AuthProvider, useAuth } from '@/state/auth';
import { PrivacyProvider } from '@/state/privacy';
import { persistOptions, queryClient } from '@/state/queryClient';
import { ThemeProvider, useTheme } from '@/ui/theme';
import '@/services/backgroundRefresh';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { status } = useAuth();
  const { colors, isDark } = useTheme();
  // FLAG_SECURE on every signed-in or locked screen: no screenshots, recordings or recent-apps preview.
  useScreenProtection(status === 'signedIn' || status === 'locked');

  useEffect(() => {
    if (status !== 'booting') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  // Tapping a reminder opens the relevant screen (only when signed in).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const route = r.notification.request.content.data?.route;
      if (typeof route === 'string' && status === 'signedIn') router.push(route as never);
    });
    return () => sub.remove();
  }, [status]);

  if (status === 'booting') return null;

  const header = {
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    headerTitleStyle: { fontWeight: '600' as const },
    contentStyle: { backgroundColor: colors.bg },
    animation: 'fade_from_bottom' as const,
  };

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={header}>
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="account/[id]" options={{ title: 'Transactions' }} />
          <Stack.Screen name="spending" options={{ title: 'Income & expenses' }} />
          <Stack.Screen name="savings" options={{ title: 'Savings & retirement' }} />
          <Stack.Screen name="insurance" options={{ title: 'Insurance' }} />
          <Stack.Screen name="loans" options={{ title: 'Loans & credit cards' }} />
          <Stack.Screen name="settings/pan" options={{ title: 'PAN profile' }} />
          <Stack.Screen name="settings/institutions" options={{ title: 'Connected institutions' }} />
          <Stack.Screen name="settings/consents" options={{ title: 'Account Aggregator consents' }} />
          <Stack.Screen name="settings/notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="settings/security" options={{ title: 'Security & sessions' }} />
          <Stack.Screen name="settings/privacy" options={{ title: 'Privacy & data' }} />
          <Stack.Screen name="manage/index" options={{ title: 'My accounts & data' }} />
          <Stack.Screen name="manage/[collection]" options={{ title: '' }} />
          <Stack.Screen name="manage/edit" options={{ title: '', presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'locked'}>
          <Stack.Screen name="lock" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <ThemeProvider>
            <PrivacyProvider>
              <AuthProvider>
                <RootNavigator />
              </AuthProvider>
            </PrivacyProvider>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
