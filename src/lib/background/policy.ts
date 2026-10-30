export interface BackgroundConditions {
  due: boolean;
  online: boolean;
  wifi: boolean;
  wifiOnly: boolean;
}

/**
 * Android wakes the task on its own schedule (minimum 15 minutes, inexact).
 * We register at 15 minutes and let this policy enforce the user's interval,
 * so "every hour" means every hour even when the OS wakes us more often.
 */
export function decideBackgroundRun(c: BackgroundConditions): { run: true } | { run: false; reason: string } {
  if (!c.due) return { run: false, reason: 'not due yet' };
  if (!c.online) return { run: false, reason: 'offline' };
  if (c.wifiOnly && !c.wifi) return { run: false, reason: 'waiting for Wi-Fi' };
  return { run: true };
}
