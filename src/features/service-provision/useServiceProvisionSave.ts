/**
 * useServiceProvisionSave — MVP0 最小保存 Hook
 *
 * フォームから UpsertProvisionInput を受け取り、
 * Repository に upsert して結果を返す。
 * 楽観更新は次フェーズ。MVP0 は await → 結果返却のシンプル設計。
 */
import { useCallback, useState } from 'react';

import type { ServiceProvisionRecord, UpsertProvisionInput } from './domain/types';
import { upsertProvisionInputSchema } from './domain/schema';
import { useServiceProvisionRepository } from './repositoryFactory';

export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export interface UseServiceProvisionSaveReturn {
  status: SaveStatus;
  lastSaved: ServiceProvisionRecord | null;
  error: unknown;
  save: (input: UpsertProvisionInput) => Promise<ServiceProvisionRecord | null>;
}

export function useServiceProvisionSave(): UseServiceProvisionSaveReturn {
  const repository = useServiceProvisionRepository();
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<ServiceProvisionRecord | null>(null);
  const [error, setError] = useState<unknown>(null);

  const save = useCallback(
    async (input: UpsertProvisionInput): Promise<ServiceProvisionRecord | null> => {
      // B層: Zod バリデーション
      const parsed = upsertProvisionInputSchema.safeParse(input);
      if (!parsed.success) {
        setStatus('error');
        setError(parsed.error);
        return null;
      }

      setStatus('saving');
      setError(null);

      try {
        const record = await repository.upsertByEntryKey(parsed.data);
        setLastSaved(record);
        setStatus('success');
        return record;
      } catch (err) {
        console.error('[useServiceProvisionSave] upsert failed', err);
        setStatus('error');
        setError(err);
        return null;
      }
    },
    [repository],
  );

  return { status, lastSaved, error, save };
}
