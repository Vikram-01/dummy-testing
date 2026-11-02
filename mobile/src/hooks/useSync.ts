import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { errorMessage } from '@/api/client';
import { financeApi } from '@/api/endpoints';

/** Starts a server-side sync and polls until it finishes, then refetches everything. */
export function useSync() {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      await financeApi.startSync();
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const s = await financeApi.syncStatus();
        if (s.data.status !== 'running') break;
      }
      await qc.invalidateQueries();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSyncing(false);
    }
  }, [qc]);

  return { syncing, error, start };
}
