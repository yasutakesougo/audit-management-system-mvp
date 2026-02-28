/**
 * useSupportStepTemplates — SP SupportTemplates リストから支援手順を取得・操作するフック
 *
 * userCode が指定されていれば SP からデータを取得し、
 * Adapter 経由でドメインモデルに変換して返す。
 * userCode が null/空の場合はデフォルトテンプレートのみ返す。
 *
 * Mutation (create/update/delete) は SP に書き込み後、自動 refetch。
 */
import { SupportStepTemplate, defaultSupportStepTemplates } from '@/domain/support/step-templates';
import { createSupportTemplateRepository } from '@/features/daily/infra/SharePointProcedureTemplateRepository';
import { acquireSpAccessToken } from '@/lib/msal';
import { useCallback, useEffect, useState } from 'react';
import { mapSpTemplatesToStepTemplates, mapStepTemplateToSpItem } from '../adapter/spTemplateAdapter';

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
  /** Mutation 実行中 */
  isMutating: boolean;
  /** エラー */
  error: string | null;
  /** 再取得 */
  refetch: () => void;
  /** SP にテンプレート作成 */
  createTemplate: (template: SupportStepTemplate) => Promise<boolean>;
  /** SP のテンプレート更新 */
  updateTemplate: (template: SupportStepTemplate) => Promise<boolean>;
  /** SP のテンプレート削除 */
  deleteTemplate: (templateId: string) => Promise<boolean>;
};

/** sp-{id} から数値 ID を抽出 */
function extractSpId(templateId: string): number | null {
  const match = templateId.match(/^sp-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export function useSupportStepTemplates(userCode: string | null): SupportStepTemplatesState {
  const [spTemplates, setSpTemplates] = useState<SupportStepTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  // ── Read ──
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

  // ── Create ──
  const createTemplate = useCallback(
    async (template: SupportStepTemplate): Promise<boolean> => {
      if (!userCode) return false;
      setIsMutating(true);
      setError(null);
      try {
        const repo = createSupportTemplateRepository(acquireSpAccessToken);
        const nextRowNo = spTemplates.length + 1;
        const spItem = mapStepTemplateToSpItem(template, userCode, nextRowNo);
        await repo.createTemplate(spItem);
        refetch();
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'テンプレート作成に失敗';
        setError(message);
        console.error('[useSupportStepTemplates.create]', err);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [userCode, spTemplates.length, refetch]
  );

  // ── Update ──
  const updateTemplate = useCallback(
    async (template: SupportStepTemplate): Promise<boolean> => {
      if (!userCode) return false;
      const spId = extractSpId(template.id);
      if (spId === null) return false;
      setIsMutating(true);
      setError(null);
      try {
        const repo = createSupportTemplateRepository(acquireSpAccessToken);
        const existing = spTemplates.find((t) => t.id === template.id);
        const rowNo = existing ? spTemplates.indexOf(existing) + 1 : 1;
        const spItem = mapStepTemplateToSpItem(template, userCode, rowNo);
        await repo.updateTemplate(spId, spItem);
        refetch();
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'テンプレート更新に失敗';
        setError(message);
        console.error('[useSupportStepTemplates.update]', err);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [userCode, spTemplates, refetch]
  );

  // ── Delete ──
  const deleteTemplate = useCallback(
    async (templateId: string): Promise<boolean> => {
      const spId = extractSpId(templateId);
      if (spId === null) return false;
      setIsMutating(true);
      setError(null);
      try {
        const repo = createSupportTemplateRepository(acquireSpAccessToken);
        await repo.deleteTemplate(spId);
        refetch();
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'テンプレート削除に失敗';
        setError(message);
        console.error('[useSupportStepTemplates.delete]', err);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch]
  );

  return {
    templates: [...defaultTemplatesWithIds, ...spTemplates],
    spTemplates,
    defaultTemplates: defaultTemplatesWithIds,
    isLoading,
    isMutating,
    error,
    refetch,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
