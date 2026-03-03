/**
 * useDraftBootstrap — SP/LS initialization and URL-param user sync
 *
 * Extracted from useSupportPlanForm for single-responsibility.
 * Manages the bootstrap lifecycle (SP → LS fallback → seed) and
 * URL-based user draft activation.
 */

import { estimatePayloadSize, HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import React from 'react';
import type { SupportPlanDraftRepository } from '../domain/SupportPlanDraftRepository';
import type { SectionKey, SupportPlanDraft, ToastState, UserOption } from '../types';
import { MAX_DRAFTS } from '../types';
import { createDraft, createDraftForUser, sanitizeForm } from '../utils/helpers';
import { loadFromLocalStorage, persistToLocalStorage } from './draftPersistence';

export interface DraftBootstrapParams {
  repository: SupportPlanDraftRepository;
  locationSearch: string;
  userOptions: UserOption[];
  draftList: SupportPlanDraft[];
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, SupportPlanDraft>>>;
  setActiveDraftId: (id: string) => void;
  setActiveTab: (tab: SectionKey) => void;
  setToast: (toast: ToastState) => void;
  setIsFetching: (v: boolean) => void;
  setSyncError: (error: string | null) => void;
  setLastSavedAt: (v: number | null) => void;
  initialised: React.MutableRefObject<boolean>;
}

export function useDraftBootstrap({
  repository,
  locationSearch,
  userOptions,
  draftList,
  setDrafts,
  setActiveDraftId,
  setActiveTab,
  setToast,
  setIsFetching,
  setSyncError,
  setLastSavedAt,
  initialised,
}: DraftBootstrapParams) {
  // ── 1) Bootstrap: load from SharePoint → fallback to localStorage ──
  React.useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const draftLoadSpan = startFeatureSpan(HYDRATION_FEATURES.supportPlanGuide.draftLoad, {
        status: 'pending',
        phase: 'bootstrap',
      });
      let spanMeta: Record<string, unknown> = { status: 'pending' };

      setIsFetching(true);
      setSyncError(null);

      try {
        const spDrafts = await repository.listDrafts();
        if (cancelled) return;

        if (spDrafts.length > 0) {
          const draftsMap: Record<string, SupportPlanDraft> = {};
          spDrafts.slice(0, MAX_DRAFTS).forEach((draft: SupportPlanDraft) => {
            draftsMap[draft.id] = {
              ...draft,
              data: sanitizeForm(draft.data),
            };
          });
          const firstId = spDrafts[0].id;

          setDrafts(draftsMap);
          setActiveDraftId(firstId);
          persistToLocalStorage(draftsMap, firstId);

          spanMeta = {
            status: 'restored',
            drafts: Object.keys(draftsMap).length,
            source: 'sharepoint',
            bytes: estimatePayloadSize(draftsMap),
          };
        } else {
          const local = loadFromLocalStorage();
          if (local) {
            setDrafts(local.drafts);
            setActiveDraftId(local.activeDraftId ?? Object.values(local.drafts)[0]?.id ?? '');
            if (local.lastSavedAt) setLastSavedAt(local.lastSavedAt);

            repository.bulkSave(Object.values(local.drafts)).catch(() => {});

            spanMeta = {
              status: 'restored',
              drafts: Object.keys(local.drafts).length,
              source: 'localStorage-migration',
              bytes: estimatePayloadSize(local.drafts),
            };
          } else {
            const initialDraft = createDraft('利用者 1');
            const seededDrafts = { [initialDraft.id]: initialDraft };
            setDrafts(seededDrafts);
            setActiveDraftId(initialDraft.id);
            persistToLocalStorage(seededDrafts, initialDraft.id);

            repository.saveDraft(initialDraft).catch(() => {});

            spanMeta = {
              status: 'seeded',
              drafts: 1,
              source: 'bootstrap',
              bytes: estimatePayloadSize(seededDrafts),
            };
          }
        }

        draftLoadSpan?.({ meta: spanMeta });
      } catch (error) {
        if (cancelled) return;

        const errorMessage =
          error instanceof Error ? error.message : '通信エラーが発生しました';
        setSyncError(errorMessage);
        console.error('SharePoint bootstrap failed, falling back to localStorage', error);

        const local = loadFromLocalStorage();
        if (local) {
          setDrafts(local.drafts);
          setActiveDraftId(local.activeDraftId ?? Object.values(local.drafts)[0]?.id ?? '');
          if (local.lastSavedAt) setLastSavedAt(local.lastSavedAt);
          spanMeta = {
            status: 'fallback-localStorage',
            drafts: Object.keys(local.drafts).length,
            source: 'localStorage',
            bytes: estimatePayloadSize(local.drafts),
          };
        } else {
          const fallback = createDraft('利用者 1');
          const fallbackDrafts = { [fallback.id]: fallback };
          setDrafts(fallbackDrafts);
          setActiveDraftId(fallback.id);
          spanMeta = {
            status: 'fallback-seeded',
            drafts: 1,
            source: 'bootstrap',
            bytes: estimatePayloadSize(fallbackDrafts),
          };
        }

        draftLoadSpan?.({
          meta: { ...spanMeta, status: 'error' },
          error: errorMessage,
        });
      } finally {
        if (!cancelled) {
          initialised.current = true;
          setIsFetching(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
    // repository identity is stable (memoized in factory)
  }, []);

  // ── 2) Fallback sync: ensure at least 1 draft + activeDraftId is valid ──
  React.useEffect(() => {
    if (!initialised.current) return;
    // This effect is handled in the orchestrator (useSupportPlanForm)
    // because it reads drafts and activeDraftId from the same state.
    // Kept here as a placeholder to document the dependency.
  }, []);

  // ── 3) URL param user sync ──
  React.useEffect(() => {
    if (!initialised.current) return;
    const params = new URLSearchParams(locationSearch);
    const targetId = params.get('userId');
    if (!targetId) return;
    const option = userOptions.find((candidate) => candidate.id === targetId);
    if (!option) return;
    const existing = draftList.find(
      (draft) => draft.userId != null && String(draft.userId) === targetId,
    );
    if (existing) {
      setActiveDraftId(existing.id);
      setActiveTab('overview');
      return;
    }
    if (draftList.length >= MAX_DRAFTS) {
      setToast({ open: true, message: 'これ以上追加できません（最大32名）', severity: 'info' });
      return;
    }
    const newDraft = createDraftForUser(option.user);
    setDrafts((prev) => ({
      ...prev,
      [newDraft.id]: newDraft,
    }));
    setActiveDraftId(newDraft.id);
    setActiveTab('overview');
  }, [draftList, locationSearch, userOptions]);
}
