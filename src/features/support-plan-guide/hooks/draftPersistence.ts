/**
 * Draft Persistence — Pure localStorage helpers
 *
 * Extracted from useSupportPlanForm to enable testing without React.
 * Write-through cache: SP is the source of truth, localStorage is fallback.
 */

import type { SupportPlanDraft, SupportPlanForm } from '../types';
import { FIELD_KEYS, MAX_DRAFTS, NAME_LIMIT, STORAGE_KEY } from '../types';
import { sanitizeDecisionRecords } from '../domain/suggestionDecisionHelpers';
import { createDraft, sanitizeForm, sanitizeValue } from '../utils/helpers';

/** Persist drafts + activeDraftId to localStorage (sync, write-through). */
export function persistToLocalStorage(
  drafts: Record<string, SupportPlanDraft>,
  activeDraftId: string,
): void {
  try {
    const payload = {
      version: 2,
      updatedAt: new Date().toISOString(),
      activeDraftId,
      drafts,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event('support-plan-updated'));
  } catch {
    // localStorage full / disabled — silent fail (SP is the source of truth)
  }
}

/** Load drafts from localStorage (fallback for offline / SP errors). */
export function loadFromLocalStorage(): {
  drafts: Record<string, SupportPlanDraft>;
  activeDraftId?: string;
  lastSavedAt?: number;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    let loadedDrafts: Record<string, SupportPlanDraft> | null = null;
    let loadedActiveId: string | undefined;

    if (parsed?.drafts) {
      const draftEntries: SupportPlanDraft[] = Array.isArray(parsed.drafts)
        ? parsed.drafts
        : Object.values(parsed.drafts);
      loadedDrafts = {};
      draftEntries.slice(0, MAX_DRAFTS).forEach((entry) => {
        if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') return;
        const name =
          typeof entry.name === 'string' && entry.name.length > 0
            ? sanitizeValue(entry.name, NAME_LIMIT)
            : '利用者';
        const createdAt =
          typeof entry.createdAt === 'string' && !Number.isNaN(Date.parse(entry.createdAt))
            ? entry.createdAt
            : new Date().toISOString();
        const updatedAt =
          typeof entry.updatedAt === 'string' && !Number.isNaN(Date.parse(entry.updatedAt))
            ? entry.updatedAt
            : createdAt;
        loadedDrafts![entry.id] = {
          id: entry.id,
          name,
          createdAt,
          updatedAt,
          userId: entry.userId ?? null,
          userCode: entry.userCode ?? null,
          data: sanitizeForm(entry.data),
          suggestionDecisions: sanitizeDecisionRecords(entry.suggestionDecisions),
        };
      });
      loadedActiveId =
        typeof parsed.activeDraftId === 'string' && loadedDrafts[parsed.activeDraftId]
          ? parsed.activeDraftId
          : undefined;
    } else if (parsed?.data || FIELD_KEYS.some((key) => typeof parsed?.[key] === 'string')) {
      // Legacy v1 format migration
      const legacyData: Partial<SupportPlanForm> = parsed?.data ?? parsed;
      const legacyDraft = createDraft(
        typeof legacyData.serviceUserName === 'string' && legacyData.serviceUserName.trim()
          ? sanitizeValue(legacyData.serviceUserName.trim(), NAME_LIMIT)
          : '利用者 1',
      );
      legacyDraft.data = sanitizeForm(legacyData);
      loadedDrafts = { [legacyDraft.id]: legacyDraft };
      loadedActiveId = legacyDraft.id;
    }

    if (!loadedDrafts || Object.keys(loadedDrafts).length === 0) {
      return null;
    }

    return {
      drafts: loadedDrafts,
      activeDraftId: loadedActiveId,
      lastSavedAt: parsed?.updatedAt ? new Date(parsed.updatedAt).getTime() : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Parse imported JSON payload into drafts map.
 * Supports both v2 (drafts map) and v1 (single form) format.
 */
export function parseDraftPayload(parsed: Record<string, unknown>): {
  drafts: Record<string, SupportPlanDraft>;
  activeDraftId?: string;
} | null {
  let nextDrafts: Record<string, SupportPlanDraft> | null = null;
  let nextActiveId: string | undefined;

  if (parsed?.drafts) {
    const entries: SupportPlanDraft[] = Array.isArray(parsed.drafts)
      ? parsed.drafts
      : Object.values(parsed.drafts as Record<string, SupportPlanDraft>);
    nextDrafts = {};
    entries.slice(0, MAX_DRAFTS).forEach((entry) => {
      if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') return;
      const name =
        typeof entry.name === 'string' && entry.name.length > 0
          ? sanitizeValue(entry.name, NAME_LIMIT)
          : '利用者';
      const createdAt =
        typeof entry.createdAt === 'string' && !Number.isNaN(Date.parse(entry.createdAt))
          ? entry.createdAt
          : new Date().toISOString();
      const updatedAt =
        typeof entry.updatedAt === 'string' && !Number.isNaN(Date.parse(entry.updatedAt))
          ? entry.updatedAt
          : createdAt;
      nextDrafts![entry.id] = {
        id: entry.id,
        name,
        createdAt,
        updatedAt,
        userId: entry.userId ?? null,
        userCode: entry.userCode ?? null,
        data: sanitizeForm(entry.data),
        suggestionDecisions: sanitizeDecisionRecords(entry.suggestionDecisions),
      };
    });
    nextActiveId =
      typeof parsed.activeDraftId === 'string' && nextDrafts[parsed.activeDraftId]
        ? (parsed.activeDraftId as string)
        : undefined;
  } else if (parsed?.data || FIELD_KEYS.some((key) => typeof parsed?.[key] === 'string')) {
    const data: Partial<SupportPlanForm> = (parsed?.data ?? parsed) as Partial<SupportPlanForm>;
    const draft = createDraft(
      typeof data.serviceUserName === 'string' && data.serviceUserName.trim()
        ? sanitizeValue(data.serviceUserName.trim(), NAME_LIMIT)
        : '利用者 1',
    );
    draft.data = sanitizeForm(data);
    draft.userId = null;
    draft.userCode = null;
    nextDrafts = { [draft.id]: draft };
    nextActiveId = draft.id;
  }

  if (!nextDrafts || Object.keys(nextDrafts).length === 0) return null;
  return { drafts: nextDrafts, activeDraftId: nextActiveId };
}
