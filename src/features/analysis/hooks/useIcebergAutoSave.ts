import type { IcebergSession } from '@/features/analysis/domain/icebergTypes';
import { useIcebergAnalysisSave } from '@/features/analysis/hooks/useIcebergAnalysisMutations';
import { computeEntryHash, serializeSession } from '@/features/analysis/stores/icebergStore';
import { useCallback, useEffect, useRef, useState } from 'react';

const AUTO_SAVE_DEBOUNCE_MS = 600;

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

type AutoSaveState = {
  status: AutoSaveStatus;
  lastSavedAt: number | null;
  errorMessage: string | null;
};

/**
 * Determine whether a session is worth saving.
 *
 * A session is saveable if it has content: either nodes or a meaningful title.
 * This prevents saving completely empty canvases while allowing "title-only"
 * sessions that staff may create before dragging in data.
 */
const isSaveable = (session: IcebergSession): boolean =>
  session.nodes.length > 0 || session.title.trim().length > 0;

/**
 * Detect a SharePoint 412 Conflict error from error messages.
 */
const isConflictError = (err: unknown): boolean => {
  if (err instanceof Error) {
    return err.message.includes('Conflict') || err.message.includes('412');
  }
  return false;
};

/**
 * Auto-save hook for Iceberg Analysis sessions.
 *
 * Debounces session changes (600ms) and triggers the save mutation.
 * Returns the current save status for UI indicator display.
 *
 * Hardening:
 * - In-flight guard: prevents parallel mutations via inFlightRef
 * - Hash dedup: same content → skip save (lastHashRef updated only on success)
 * - Conflict detection: 412 → status: conflict with descriptive message
 * - Empty canvas: skips sessions with no nodes AND no title
 * - StrictMode: timer cleanup on unmount and re-render
 *
 * Pattern follows SupportPlanGuidePage auto-save.
 */
export const useIcebergAutoSave = (session: IcebergSession | null) => {
  const saveMutation = useIcebergAnalysisSave();
  const timerRef = useRef<number>();
  const lastHashRef = useRef<string>('');
  const inFlightRef = useRef<boolean>(false);
  const pendingRef = useRef<IcebergSession | null>(null);
  const [state, setState] = useState<AutoSaveState>({
    status: 'idle',
    lastSavedAt: null,
    errorMessage: null,
  });

  // Core save logic — guarded against parallel execution
  const saveNow = useCallback(
    async (s: IcebergSession) => {
      // In-flight guard: queue the latest session for retry after current save
      if (inFlightRef.current) {
        pendingRef.current = s;
        return;
      }

      try {
        inFlightRef.current = true;
        setState((prev) => ({ ...prev, status: 'saving', errorMessage: null }));
        const json = serializeSession(s);
        const entryHash = await computeEntryHash(s);

        // Skip if content hasn't changed
        if (entryHash === lastHashRef.current) {
          setState((prev) => ({ ...prev, status: prev.lastSavedAt ? 'saved' : 'idle' }));
          return;
        }

        await saveMutation.mutateAsync({
          userId: s.targetUserId,
          title: s.title,
          snapshotJSON: json,
          entryHash,
          status: 'Draft',
        });

        // Only update hash on success — failed saves CAN be retried
        lastHashRef.current = entryHash;
        const now = Date.now();
        setState({ status: 'saved', lastSavedAt: now, errorMessage: null });
      } catch (err) {
        console.error('[IcebergAutoSave] Save failed:', err);

        if (isConflictError(err)) {
          setState((prev) => ({
            ...prev,
            status: 'conflict',
            errorMessage: '他の端末で更新された可能性があります。ページを再読込してください。',
          }));
        } else {
          setState((prev) => ({
            ...prev,
            status: 'error',
            errorMessage: err instanceof Error ? err.message : '保存に失敗しました',
          }));
        }
      } finally {
        inFlightRef.current = false;

        // Process queued save (always save the latest version)
        const pending = pendingRef.current;
        if (pending) {
          pendingRef.current = null;
          void saveNow(pending);
        }
      }
    },
    [saveMutation],
  );

  // Debounced auto-save: fires whenever session changes
  useEffect(() => {
    if (!session) return;
    if (!isSaveable(session)) return;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      void saveNow(session);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [session, saveNow]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    ...state,
    saveNow,
  } as const;
};
