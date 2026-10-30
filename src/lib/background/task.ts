import * as BackgroundTask from 'expo-background-task';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { getDb } from '../db/expoDb';
import { getSettings } from '../repo/settings';
import { getSecret } from '../secrets';
import { isSyncDue, runSync, SyncSummary, SyncTrigger } from '../sync/engine';
import { decideBackgroundRun } from './policy';

export const SYNC_TASK = 'vigil-hourly-sync';

/** Shared entry point for background, startup and manual syncs. */
export async function performSync(trigger: SyncTrigger, onlySources?: string[], onProgress?: (m: string) => void): Promise<SyncSummary> {
  const db = await getDb();
  const [nvdApiKey, githubToken] = await Promise.all([getSecret('nvdApiKey'), getSecret('githubToken')]);
  const summary = await runSync({ db, fetch: (u, i) => fetch(u, i), nvdApiKey, githubToken, onlySources, onProgress }, trigger);
  const settings = await getSettings(db);
  if (settings.kevNotifications && summary.newKev.length) {
    await notifyNewKev(summary.newKev).catch(() => undefined);
  }
  return summary;
}

async function notifyNewKev(ids: string[]) {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: ids.length === 1 ? 'New known exploited vulnerability' : `${ids.length} new known exploited vulnerabilities`,
      body: `CISA KEV added ${ids.slice(0, 4).join(', ')}${ids.length > 4 ? ', …' : ''}`,
      data: { url: `vigil://cve/${ids[0]}` },
    },
    trigger: null,
  });
}

// Must be defined at module scope so Android can run it headlessly.
TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    const db = await getDb();
    const settings = await getSettings(db);
    const net = await Network.getNetworkStateAsync();
    const decision = decideBackgroundRun({
      due: await isSyncDue(db),
      online: !!net.isConnected && net.isInternetReachable !== false,
      wifi: net.type === Network.NetworkStateType.WIFI || net.type === Network.NetworkStateType.ETHERNET,
      wifiOnly: settings.wifiOnly,
    });
    if (!decision.run) return BackgroundTask.BackgroundTaskResult.Success;
    const s = await performSync('background');
    return s.status === 'failed' ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Registers the periodic job. Android's WorkManager minimum is 15 minutes; the
 * task wakes at that cadence and the policy enforces the user's interval
 * (default 60 minutes) using the last-run timestamp.
 */
export async function registerBackgroundSync(intervalMinutes: number): Promise<'registered' | 'restricted'> {
  const status = await BackgroundTask.getStatusAsync();
  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return 'restricted';
  // Waking every 15 minutes is cheap (one DB read when not due) and keeps the
  // effective cadence close to the configured interval instead of drifting.
  void intervalMinutes;
  if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) await BackgroundTask.unregisterTaskAsync(SYNC_TASK);
  await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 15 });
  return 'registered';
}
