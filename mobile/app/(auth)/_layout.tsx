import { Stack } from 'expo-router';
import { useTheme } from '@/ui/theme';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        title: '',
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="setup" />
      <Stack.Screen name="register" />
      <Stack.Screen name="mfa" />
      <Stack.Screen name="forgot" />
    </Stack>
  );
}
