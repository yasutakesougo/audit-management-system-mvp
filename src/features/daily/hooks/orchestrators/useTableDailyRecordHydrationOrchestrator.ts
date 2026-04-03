import { useState, useEffect, useCallback } from 'react';
import type { TableDailyRecordData, UserRowData } from '../view-models/useTableDailyRecordForm';
import { useTableDailyRecordPersistence } from '../mutations/useTableDailyRecordPersistence';
import type { DailyRecordRepository } from '../../domain/legacy/DailyRecordRepository';
import type { DraftInput } from '../mutations/useTableDailyRecordPersistence';
import { toLocalDateISO } from '@/utils/getNow';

export const createInitialFormData = (initialDate?: string | null): TableDailyRecordData => ({
  date: initialDate ?? toLocalDateISO(),
  reporter: {
    name: '',
    role: '生活支援員',
  },
  userRows: [],
  userCount: 0,
});

export interface UseTableDailyRecordHydrationOrchestratorParams {
  open: boolean;
  initialDateFromUrl: string | null;
  repository: DailyRecordRepository;
}

export interface UseTableDailyRecordHydrationOrchestratorResult {
  formData: TableDailyRecordData;
  setFormData: React.Dispatch<React.SetStateAction<TableDailyRecordData>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  showTodayOnly: boolean;
  setShowTodayOnly: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  hydrated: boolean;
  error: Error | null;
  // State for Selection Orchestrator
  initialSelectedUserIds: string[] | null;
  // Persistence
  hasDraft: boolean;
  draftSavedAt: string | null;
  handleSaveDraft: (selectedUserIds: string[]) => void;
  clearDraft: () => void;
}

/**
 * フォーム初期化・既存レコード読込・ドラフト復元・Hydration を集約する Orchestrator
 */
export function useTableDailyRecordHydrationOrchestrator({
  open,
  initialDateFromUrl,
  repository,
}: UseTableDailyRecordHydrationOrchestratorParams): UseTableDailyRecordHydrationOrchestratorResult {
  // ── Core State ─────────────────────────────────────
  const [formData, setFormData] = useState<TableDailyRecordData>(() =>
    createInitialFormData(initialDateFromUrl),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showTodayOnly, setShowTodayOnly] = useState(true);

  // ── Orchestration State ─────────────────────────────
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [initialSelectedUserIds, setInitialSelectedUserIds] = useState<string[] | null>(null);

  // ── Persistence ─────────────────────────────────────
  const { draftSavedAt, loadedDraft, saveDraft, clearDraft } =
    useTableDailyRecordPersistence({ open });
  const hasDraft = draftSavedAt !== null;

  const handleSaveDraft = useCallback(
    (selectedUserIds: string[]) => {
      const input: DraftInput = {
        formData,
        selectedUserIds,
        searchQuery,
        showTodayOnly,
      };
      saveDraft(input);
    },
    [formData, searchQuery, showTodayOnly, saveDraft],
  );

  // ── Hydration Logic (Date changes / Mount) ──────────
  const targetDate = formData.date;

  useEffect(() => {
    if (!open) {
      setHydrated(false);
      setInitialSelectedUserIds(null);
      return;
    }

    let isMounted = true;

    const hydrate = async () => {
      try {
        setLoading(true);
        setError(null);
        setHydrated(false);
        setInitialSelectedUserIds(null);

        // 1. If draft exists for the CURRENT date, restore draft
        if (loadedDraft && loadedDraft.formData.date === targetDate) {
          setFormData(loadedDraft.formData);
          setSearchQuery(loadedDraft.searchQuery ?? '');
          setShowTodayOnly(loadedDraft.showTodayOnly ?? true);
          setInitialSelectedUserIds(loadedDraft.selectedUserIds);
          setHydrated(true);
          return;
        }

        // 2. Otherwise, fetch existing record from repository
        const existingRecord = await repository.load(targetDate);
        if (!isMounted) return;

        if (existingRecord && existingRecord.userRows && existingRecord.userRows.length > 0) {
          // Existing record -> Form state conversion
          setFormData({
            date: existingRecord.date,
            reporter: existingRecord.reporter,
            userRows: (existingRecord.userRows as UserRowData[]) ?? [],
            userCount: existingRecord.userCount ?? existingRecord.userRows?.length ?? 0,
          });
          setInitialSelectedUserIds(existingRecord.userRows.map(row => row.userId));
        } else {
          // Default state if nothing found, but keep the date & current edits
          setFormData((prev) => ({
            ...prev,
            date: targetDate, // ensure date is synced
          }));
        }

        setHydrated(true);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load daily records'));
          // Keep form responsive even on error
          setHydrated(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    hydrate();

    return () => {
      isMounted = false;
    };
  }, [open, targetDate, loadedDraft, repository]);

  return {
    formData,
    setFormData,
    searchQuery,
    setSearchQuery,
    showTodayOnly,
    setShowTodayOnly,
    loading,
    hydrated,
    error,
    initialSelectedUserIds,
    hasDraft,
    draftSavedAt,
    handleSaveDraft,
    clearDraft,
  };
}
