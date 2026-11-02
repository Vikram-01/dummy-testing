import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { apiSession, refreshSession } from '@/api/client';
import { financeApi } from '@/api/endpoints';
import { secureStorage } from '@/lib/secureStorage';
import { scheduleReminders } from './notifications';

/**
 * Runs when Android's WorkManager allows (typically every few hours, battery permitting).
 * Asks the server to sync, then refreshes local payment/renewal reminders. It never shows
 * amounts in notifications and does nothing when signed out or in demo mode.
 */
export const BACKGROUND_TASK = 'pf360-background-refresh';

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    if (apiSession.isDemo()) return BackgroundTask.BackgroundTaskResult.Success;
    if (!(await secureStorage.getRefreshToken())) return BackgroundTask.BackgroundTaskResult.Success;
    await refreshSession();
    await financeApi.startSync().catch(() => undefined);
    const [ins, liab, sav, prefs] = await Promise.all([
      financeApi.insurance(), financeApi.liabilities(), financeApi.savings(), financeApi.notificationPrefs(),
    ]);
    await scheduleReminders({ insurance: ins.data, liabilities: liab.data, savings: sav.data }, prefs);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundRefresh() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK))) {
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, { minimumInterval: 6 * 60 });
  }
  return true;
}
