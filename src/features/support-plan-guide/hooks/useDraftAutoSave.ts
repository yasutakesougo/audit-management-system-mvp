/**
 * useDraftAutoSave — Write-through auto-save effect
 *
 * Extracted from useSupportPlanForm for single-responsibility.
 * - Immediate localStorage write
 * - Debounced SharePoint save
 * - Live-message auto-clear
 */

import React from 'react';
import type { SupportPlanDraftRepository } from '../domain/SupportPlanDraftRepository';
import type { SupportPlanDraft } from '../types';
import { SAVE_DEBOUNCE } from '../types';
import { persistToLocalStorage } from './draftPersistence';

export interface DraftAutoSaveParams {
  drafts: Record<string, SupportPlanDraft>;
  activeDraftId: string;
  isAdmin: boolean;
  repository: SupportPlanDraftRepository;
  initialised: React.MutableRefObject<boolean>;
  setLastSavedAt: (v: number | null) => void;
  setLiveMessage: (msg: string) => void;
  setIsSaving: (v: boolean) => void;
  setSyncError: (error: string | null) => void;
  liveMessage: string;
}

export function useDraftAutoSave({
  drafts,
  activeDraftId,
  isAdmin,
  repository,
  initialised,
  setLastSavedAt,
  setLiveMessage,
  setIsSaving,
  setSyncError,
  liveMessage,
}: DraftAutoSaveParams) {
  const saveTimer = React.useRef<number>();
  const spSaveTimer = React.useRef<number>();

  // ── Write-through auto-save: immediate localStorage + debounced SP ──
  React.useEffect(() => {
    if (!initialised.current) return;

    // Immediate localStorage write
    if (isAdmin) {
      persistToLocalStorage(drafts, activeDraftId);
      const now = Date.now();
      setLastSavedAt(now);
    }

    // Clear previous LS debounce timer
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    // LS live-message (with debounce to avoid spam)
    saveTimer.current = window.setTimeout(() => {
      if (!isAdmin) return;
      const now = Date.now();
      setLiveMessage(`自動保存しました（${new Date(now).toLocaleTimeString('ja-JP')}）`);
    }, SAVE_DEBOUNCE);

    // Debounced SharePoint save
    if (spSaveTimer.current) {
      window.clearTimeout(spSaveTimer.current);
    }
    spSaveTimer.current = window.setTimeout(() => {
      if (!isAdmin) return;

      const currentDraft = drafts[activeDraftId];
      if (!currentDraft) return;

      setIsSaving(true);
      setSyncError(null);

      repository
        .saveDraft(currentDraft)
        .then(() => {
          setSyncError(null);
        })
        .catch((error: unknown) => {
          const msg = error instanceof Error ? error.message : 'SharePoint保存に失敗しました';
          setSyncError(msg);
          console.error('SP save failed:', error);
        })
        .finally(() => {
          setIsSaving(false);
        });
    }, SAVE_DEBOUNCE);

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
      if (spSaveTimer.current) {
        window.clearTimeout(spSaveTimer.current);
      }
    };
  }, [drafts, activeDraftId, isAdmin]);

  // ── Live-message auto-clear ──
  React.useEffect(() => {
    if (!liveMessage) return;
    const timeout = window.setTimeout(() => setLiveMessage(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [liveMessage]);
}
