import type { UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { useAuth } from '@/state/auth';
import { DemoBanner, OfflineBanner } from './components';

/** Shows the DEMO banner for demo data and the offline banner when showing cached data. */
export function DataBanners({ query }: { query: UseQueryResult<{ is_demo: boolean } | undefined, unknown> | UseQueryResult<any, unknown> }) {
  const { isDemo, offline } = useAuth();
  const demo = isDemo || (query.data as { is_demo?: boolean } | undefined)?.is_demo === true;
  const stale = (query.isError && query.error instanceof ApiError && query.error.isNetwork && query.data) || (offline && query.data);
  return (
    <>
      {demo ? <DemoBanner /> : null}
      {stale ? <OfflineBanner updatedAt={query.dataUpdatedAt} /> : null}
    </>
  );
}
