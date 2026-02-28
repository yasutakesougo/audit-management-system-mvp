/**
 * useSupportStepTemplates — SP SupportTemplates リストから支援手順を取得するフック
 *
 * userCode が指定されていれば SP からデータを取得し、
 * Adapter 経由でドメインモデルに変換して返す。
 * userCode が null/空の場合はデフォルトテンプレートのみ返す。
 */
import { SupportStepTemplate, defaultSupportStepTemplates } from '@/domain/support/step-templates';
import { createSupportTemplateRepository } from '@/features/daily/infra/SharePointProcedureTemplateRepository';
import { acquireSpAccessToken } from '@/lib/msal';
import { useCallback, useEffect, useState } from 'react';
import { mapSpTemplatesToStepTemplates } from '../adapter/spTemplateAdapter';

// デフォルトテンプレート（ID付き、コンポーネント外で一度だけ生成）
const defaultTemplatesWithIds: SupportStepTemplate[] = defaultSupportStepTemplates.map(
  (template, index) => ({
    ...template,
    id: `default-${index + 1}`,
    isDefault: true,
  })
);

export type SupportStepTemplatesState = {
  /** デフォルト + SP テンプレート統合リスト */
  templates: SupportStepTemplate[];
  /** SP テンプレートのみ（デフォルト除外） */
  spTemplates: SupportStepTemplate[];
  /** デフォルトテンプレート */
  defaultTemplates: SupportStepTemplate[];
  /** ローディング中 */
  isLoading: boolean;
  /** エラー */
  error: string | null;
  /** 再取得 */
  refetch: () => void;
};

export function useSupportStepTemplates(userCode: string | null): SupportStepTemplatesState {
  const [spTemplates, setSpTemplates] = useState<SupportStepTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!userCode) {
      setSpTemplates([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const repo = createSupportTemplateRepository(acquireSpAccessToken);
        const items = await repo.getTemplatesByUser(userCode);

        if (!cancelled) {
          const mapped = mapSpTemplatesToStepTemplates(items);
          setSpTemplates(mapped);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'SP テンプレート取得に失敗';
          setError(message);
          console.error('[useSupportStepTemplates]', err);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [userCode, fetchKey]);

  return {
    templates: [...defaultTemplatesWithIds, ...spTemplates],
    spTemplates,
    defaultTemplates: defaultTemplatesWithIds,
    isLoading,
    error,
    refetch,
  };
}
