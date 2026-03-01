import { icebergToInterventionDrafts } from '@/features/analysis/domain/icebergToIntervention';
import type { IcebergSession } from '@/features/analysis/domain/icebergTypes';
import {
    INTERVENTION_DRAFT_KEY,
    interventionStoreSchema,
    type BehaviorInterventionPlan,
    type UserInterventionPlans,
} from '@/features/analysis/domain/interventionTypes';
import { useCallback, useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = INTERVENTION_DRAFT_KEY;
const DEBOUNCE_MS = 600;

function loadFromStorage(): Record<string, UserInterventionPlans> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = interventionStoreSchema.parse(JSON.parse(raw));
    return parsed.data;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function persistToStorage() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const payload = { version: 1 as const, data: interventions };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, DEBOUNCE_MS);
}

/** テスト用: debounce を即座にフラッシュ */
export function __flushPersist() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const payload = { version: 1 as const, data: interventions };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

let interventions: Record<string, UserInterventionPlans> = loadFromStorage();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => interventions;

function saveUserPlans(userId: string, plans: BehaviorInterventionPlan[]) {
  interventions = {
    ...interventions,
    [userId]: {
      userId,
      plans,
      updatedAt: new Date().toISOString(),
    },
  };
  emit();
  persistToStorage();
}

/** テスト用: store をリセット */
export function __resetStore() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  interventions = loadFromStorage();
  emit();
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useInterventionStore() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  /** ユーザーの全プランを取得（なければ空配列） */
  const getByUserId = useCallback(
    (userId: string): BehaviorInterventionPlan[] => {
      return store[userId]?.plans ?? [];
    },
    [store],
  );

  /** 全プランを上書き保存 */
  const save = useCallback((userId: string, plans: BehaviorInterventionPlan[]) => {
    saveUserPlans(userId, plans);
  }, []);

  /** 単一プランの戦略テキストを更新 */
  const updateStrategy = useCallback(
    (userId: string, planId: string, field: 'prevention' | 'alternative' | 'reactive', value: string) => {
      const existing = store[userId]?.plans ?? [];
      const updated = existing.map((p) =>
        p.id === planId
          ? {
              ...p,
              strategies: { ...p.strategies, [field]: value },
              updatedAt: new Date().toISOString(),
            }
          : p,
      );
      saveUserPlans(userId, updated);
    },
    [store],
  );

  /**
   * 氷山セッションから BIP Draft を自動生成。
   * 既存プランの strategies を保持しつつ、新しい行動・要因は追加する。
   * @returns 追加されたプラン数
   */
  const generateFromIceberg = useCallback(
    (session: IcebergSession): number => {
      const drafts = icebergToInterventionDrafts(session);
      const existing = store[session.targetUserId]?.plans ?? [];

      let addedCount = 0;
      const merged = [...existing];

      for (const draft of drafts) {
        const existingPlan = merged.find((p) => p.targetBehaviorNodeId === draft.targetBehaviorNodeId);
        if (existingPlan) {
          // 既存プランの triggerFactors を更新（strategies は保持）
          const newTriggers = draft.triggerFactors.filter(
            (t) => !existingPlan.triggerFactors.some((et) => et.nodeId === t.nodeId),
          );
          if (newTriggers.length > 0) {
            existingPlan.triggerFactors = [...existingPlan.triggerFactors, ...newTriggers];
            existingPlan.updatedAt = new Date().toISOString();
          }
        } else {
          merged.push(draft);
          addedCount++;
        }
      }

      saveUserPlans(session.targetUserId, merged);
      return addedCount;
    },
    [store],
  );

  return {
    getByUserId,
    save,
    updateStrategy,
    generateFromIceberg,
  } as const;
}
