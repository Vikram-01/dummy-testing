import * as Device from 'expo-device';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';

/**
 * Blocks screenshots and screen recording (Android FLAG_SECURE) while mounted. Also hides app content
 * in the recent-apps switcher. Used on every signed-in screen that shows balances or identifiers.
 */
export function useScreenProtection(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const tag = 'pf360-' + Math.random().toString(36).slice(2);
    ScreenCapture.preventScreenCaptureAsync(tag).catch(() => undefined);
    return () => {
      ScreenCapture.allowScreenCaptureAsync(tag).catch(() => undefined);
    };
  }, [enabled]);
}

/** Heuristic only. Shown as an optional warning; never blocks use. */
export async function rootedDeviceRisk(): Promise<boolean> {
  try {
    return await Device.isRootedExperimentalAsync();
  } catch {
    return false;
  }
}

export async function biometricStatus(): Promise<{ available: boolean; enrolled: boolean; label: string }> {
  const [hw, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const label = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) && !types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
    ? 'Face unlock' : 'Fingerprint';
  return { available: hw, enrolled, label };
}

/** Strong (Class 3) biometrics only; device PIN fallback is allowed by the OS prompt. */
export async function promptBiometric(reason: string): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    biometricsSecurityLevel: 'strong',
  });
  return r.success;
}
