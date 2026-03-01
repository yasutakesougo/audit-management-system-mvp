// ---------------------------------------------------------------------------
// useInterventionDashboard — B-Layer Hook for BIP Management
//
// localStorage ベースの行動対応プラン(BIP)管理。
// マスター・ディテール UI の状態 + CRUD + 氷山セッションからの自動生成。
// ---------------------------------------------------------------------------
import { useCallback, useMemo, useState } from 'react';

import { icebergToInterventionDrafts } from '@/features/analysis/domain/icebergToIntervention';
import type { IcebergSession } from '@/features/analysis/domain/icebergTypes';
import type {
    BehaviorInterventionPlan,
    InterventionStorePayload,
} from '@/features/analysis/domain/interventionTypes';
import {
    INTERVENTION_DRAFT_KEY,
    interventionStoreSchema,
} from '@/features/analysis/domain/interventionTypes';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadStore(): InterventionStorePayload {
  try {
    const raw = localStorage.getItem(INTERVENTION_DRAFT_KEY);
    if (!raw) return { version: 1, data: {} };
    const parsed = interventionStoreSchema.parse(JSON.parse(raw));
    return parsed;
  } catch {
    return { version: 1, data: {} };
  }
}

function persistStore(store: InterventionStorePayload): void {
  localStorage.setItem(INTERVENTION_DRAFT_KEY, JSON.stringify(store));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type InterventionDashboardState = {
  /** 現在選択中のユーザーID */
  targetUserId: string;
  /** ユーザーの BIP 一覧 */
  plans: BehaviorInterventionPlan[];
  /** 選択中プランID */
  selectedPlanId: string | null;
  /** 選択中プラン本体 */
  selectedPlan: BehaviorInterventionPlan | null;
  /** ユーザー選択 */
  setTargetUserId: (userId: string) => void;
  /** プラン選択 */
  selectPlan: (planId: string) => void;
  /** 戦略フィールド更新 */
  updateStrategy: (planId: string, field: 'prevention' | 'alternative' | 'reactive', value: string) => void;
  /** 氷山セッションから BIP ドラフト生成 */
  generateFromIceberg: (session: IcebergSession) => number;
  /** localStorage に永続化 */
  save: () => void;
  /** プラン削除 */
  removePlan: (planId: string) => void;
};

export function useInterventionDashboard(): InterventionDashboardState {
  const [targetUserId, setTargetUserId] = useState('');
  const [store, setStore] = useState<InterventionStorePayload>(loadStore);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // 現ユーザーのプラン一覧
  const plans = useMemo(
    () => store.data[targetUserId]?.plans ?? [],
    [store, targetUserId],
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const selectPlan = useCallback((planId: string) => {
    setSelectedPlanId(planId);
  }, []);

  const updateStrategy = useCallback(
    (planId: string, field: 'prevention' | 'alternative' | 'reactive', value: string) => {
      setStore((prev) => {
        const userData = prev.data[targetUserId];
        if (!userData) return prev;

        const updatedPlans = userData.plans.map((p) =>
          p.id === planId
            ? { ...p, strategies: { ...p.strategies, [field]: value }, updatedAt: new Date().toISOString() }
            : p,
        );

        return {
          ...prev,
          data: {
            ...prev.data,
            [targetUserId]: { ...userData, plans: updatedPlans, updatedAt: new Date().toISOString() },
          },
        };
      });
    },
    [targetUserId],
  );

  const generateFromIceberg = useCallback(
    (session: IcebergSession): number => {
      const drafts = icebergToInterventionDrafts(session);
      if (drafts.length === 0) return 0;

      setStore((prev) => {
        const existing = prev.data[targetUserId]?.plans ?? [];
        // 重複（同じ behaviorNodeId）はスキップ
        const newDrafts = drafts.filter(
          (d) => !existing.some((e) => e.targetBehaviorNodeId === d.targetBehaviorNodeId),
        );
        if (newDrafts.length === 0) return prev;

        const merged = [...existing, ...newDrafts];
        return {
          ...prev,
          data: {
            ...prev.data,
            [targetUserId]: { userId: targetUserId, plans: merged, updatedAt: new Date().toISOString() },
          },
        };
      });

      return drafts.length;
    },
    [targetUserId],
  );

  const save = useCallback(() => {
    persistStore(store);
  }, [store]);

  const removePlan = useCallback(
    (planId: string) => {
      setStore((prev) => {
        const userData = prev.data[targetUserId];
        if (!userData) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            [targetUserId]: {
              ...userData,
              plans: userData.plans.filter((p) => p.id !== planId),
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });
      if (selectedPlanId === planId) setSelectedPlanId(null);
    },
    [targetUserId, selectedPlanId],
  );

  return {
    targetUserId,
    plans,
    selectedPlanId,
    selectedPlan,
    setTargetUserId,
    selectPlan,
    updateStrategy,
    generateFromIceberg,
    save,
    removePlan,
  };
}
