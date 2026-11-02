import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable } from 'react-native';
import { financeApi } from '@/api/endpoints';
import { rootedDeviceRisk } from '@/lib/deviceSecurity';
import { registerBackgroundRefresh } from '@/services/backgroundRefresh';
import { getPushToken, notificationPermission, scheduleReminders } from '@/services/notifications';
import { useAuth } from '@/state/auth';
import { usePrivacy } from '@/state/privacy';
import { useTheme } from '@/ui/theme';
import type { IconName } from '@/ui/components';

let rootWarned = false;

function useSignedInSetup() {
  const { isDemo } = useAuth();
  useEffect(() => {
    (async () => {
      if (!rootWarned && (await rootedDeviceRisk())) {
        rootWarned = true;
        Alert.alert('Security warning', 'This device appears to be rooted or modified. Your data is better protected on an unmodified device. You can continue at your own risk.');
      }
      if (isDemo) return;
      try {
        if (await notificationPermission(true)) {
          const token = await getPushToken();
          if (token) await financeApi.registerPushToken(token);
          const [ins, liab, sav, prefs] = await Promise.all([financeApi.insurance(), financeApi.liabilities(), financeApi.savings(), financeApi.notificationPrefs()]);
          await scheduleReminders({ insurance: ins.data, liabilities: liab.data, savings: sav.data }, prefs);
        }
        await registerBackgroundRefresh();
      } catch {
        /* offline or not permitted; retried next launch / background run */
      }
    })();
  }, [isDemo]);
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { hidden, toggle } = usePrivacy();
  useSignedInSetup();

  const icon = (name: IconName, active: IconName) =>
    ({ color, focused }: { color: unknown; focused: boolean }) => <Ionicons name={focused ? active : name} size={22} color={color as string} />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 20 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
        headerRight: () => (
          <Pressable onPress={toggle} hitSlop={12} style={{ marginRight: 16 }} accessibilityRole="button" accessibilityLabel={hidden ? 'Show amounts' : 'Hide amounts'}>
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarIcon: icon('wallet-outline', 'wallet') }} />
      <Tabs.Screen name="investments" options={{ title: 'Investments', tabBarIcon: icon('trending-up-outline', 'trending-up') }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: icon('bar-chart-outline', 'bar-chart') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle-outline', 'person-circle') }} />
    </Tabs>
  );
}
