// src/features/support-plan/supportPlanAdapter.ts

import type { GoalItem } from '@/features/shared/goal/goalTypes';

export interface SupportPlanHints {
  userId: string;
  /** 長期目標テキスト（goals から抽出） */
  goalSummary?: string;
  riskManagement?: string;
  lastUpdated?: string;
}

const STORAGE_KEY = 'support-plan-guide.v2';
const MAX_TOOLTIP_CHARS = 300;

/**
 * Abstraction for the data source to simplify future migration to SharePoint/API.
 */
export const getSupportPlanSourceInfo = () => ({
  type: 'localStorage',
  key: STORAGE_KEY,
});

const norm = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

const cleanText = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return undefined;
  return s.length > MAX_TOOLTIP_CHARS ? s.slice(0, MAX_TOOLTIP_CHARS) + '...' : s;
};

/**
 * GoalItem[] から長期・短期目標のサマリーを生成する。
 */
const extractGoalSummary = (goals: unknown): string | undefined => {
  if (!Array.isArray(goals) || goals.length === 0) return undefined;

  const items = goals as GoalItem[];
  const longGoals = items.filter((g) => g.type === 'long');
  const shortGoals = items.filter((g) => g.type === 'short');

  const parts: string[] = [];
  if (longGoals.length > 0) {
    parts.push(`長期: ${longGoals.map((g) => g.text?.trim()).filter(Boolean).join(' / ')}`);
  }
  if (shortGoals.length > 0) {
    parts.push(`短期: ${shortGoals.map((g) => g.text?.trim()).filter(Boolean).join(' / ')}`);
  }
  if (parts.length === 0) return undefined;

  const summary = parts.join(' ｜ ');
  return summary.length > MAX_TOOLTIP_CHARS ? summary.slice(0, MAX_TOOLTIP_CHARS) + '...' : summary;
};

interface StorageData {
  goals?: GoalItem[];
  riskManagement?: string;
  userId?: string | number | null;
}

interface StorageDraft {
  userId?: string | number | null;
  data?: StorageData;
  updatedAt?: string;
}

export const extractSupportPlanHints = (): Record<string, SupportPlanHints> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    const drafts = parsed?.drafts;

    // Handle both Array and Map/Object shapes for drafts
    const values: StorageDraft[] = Array.isArray(drafts)
      ? drafts
      : (drafts && typeof drafts === 'object' ? Object.values(drafts) : []);

    const hintsMap: Record<string, SupportPlanHints> = {};

    for (const draft of values) {
      // Support both root userId and nested data.userId
      const uId = norm(draft?.userId ?? draft?.data?.userId);
      if (!uId) continue;

      const goalSummary = extractGoalSummary(draft?.data?.goals);
      const riskManagement = cleanText(draft?.data?.riskManagement);

      // Skip users with no relevant hints to reduce noise
      if (!goalSummary && !riskManagement) continue;

      hintsMap[uId] = {
        userId: uId,
        goalSummary,
        riskManagement,
        lastUpdated: typeof draft?.updatedAt === 'string' ? draft.updatedAt : undefined,
      };
    }

    return hintsMap;
  } catch {
    return {};
  }
};
