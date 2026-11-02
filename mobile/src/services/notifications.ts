import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { Liabilities, NotificationPrefs, Policy, Savings } from '@/api/types';
import { log } from '@/lib/log';

/**
 * Reminder content is deliberately generic: no balances, amounts, account numbers or institution
 * names appear in any notification, and lock-screen visibility is PRIVATE.
 */
const CHANNEL = 'reminders';
const TAG = 'pf360';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function ensureChannel() {
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Payment and renewal reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    showBadge: false,
  });
}

export async function notificationPermission(request = false): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted || !request) return cur.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Remote push token (only when the build has an EAS project id + FCM credentials). */
export async function getPushToken(): Promise<string | null> {
  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
  if (!projectId) return null;
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (e) {
    log.warn('push token unavailable', e);
    return null;
  }
}

export async function cancelAllReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(all.filter((n) => n.content.data?.tag === TAG).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

function at9am(isoDate: string, daysBefore: number): Date {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d - daysBefore, 9, 0, 0);
}

type Reminder = { when: Date; title: string; body: string; route: string };

export function buildReminders(input: { insurance?: Policy[]; liabilities?: Liabilities; savings?: Savings }, prefs: Partial<NotificationPrefs>, now = new Date()): Reminder[] {
  const out: Reminder[] = [];
  if (prefs.policy_renewals !== false)
    for (const p of input.insurance ?? [])
      out.push({ when: at9am(p.renewal_date, 7), title: 'Policy renewal coming up', body: 'One of your insurance policies renews in 7 days.', route: '/insurance' });
  if (prefs.emi_due !== false)
    for (const l of input.liabilities?.loans ?? [])
      out.push({ when: at9am(l.next_emi_date, 2), title: 'EMI due soon', body: 'A loan EMI is due in 2 days. Keep your account funded.', route: '/loans' });
  if (prefs.card_due !== false)
    for (const c of input.liabilities?.cards ?? [])
      out.push({ when: at9am(c.due_date, 3), title: 'Card payment due', body: 'A credit card payment is due in 3 days.', route: '/loans' });
  if (prefs.maturity_alerts !== false)
    for (const d of input.savings?.deposits ?? [])
      out.push({ when: at9am(d.maturity_date, 7), title: 'Deposit maturing', body: 'A deposit matures in 7 days.', route: '/savings' });
  return out.filter((r) => r.when.getTime() > now.getTime());
}

export async function scheduleReminders(input: Parameters<typeof buildReminders>[0], prefs: Partial<NotificationPrefs>) {
  if (!(await notificationPermission())) return 0;
  await ensureChannel();
  await cancelAllReminders();
  const list = buildReminders(input, prefs);
  for (const r of list) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, data: { tag: TAG, route: r.route } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.when, channelId: CHANNEL },
    });
  }
  return list.length;
}
