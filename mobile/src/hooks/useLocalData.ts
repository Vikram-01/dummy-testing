import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Row } from '@/local/db';
import type { CollectionKey } from '@/local/schema';

export const useCollection = (key: CollectionKey) =>
  useQuery({ queryKey: ['local', key], queryFn: () => api<Row[]>('GET', `/local/${key}`) });

/** Any local write refreshes every screen. */
export function useLocalMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { method: 'POST' | 'PUT' | 'DELETE'; path: string; body?: unknown }) => api<unknown>(v.method, v.path, { body: v.body }),
    onSuccess: () => qc.invalidateQueries(),
  });
}
