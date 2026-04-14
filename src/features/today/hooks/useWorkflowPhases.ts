/**
 * useWorkflowPhases — 全利用者のワークフローフェーズを一括算出する hook
 *
 * Today ページで「支援計画管理」カードを表示するためのデータを提供する。
 *
 * ── 役割 ──
 * 1. 利用者一覧から userId を抽出
 * 2. 各利用者の計画シートを取得
 * 3. determineWorkflowPhase() で判定
 * 4. toPlanningWorkflowCardItem() で UI 用データに変換
 * 5. priority 順にソート
 *
 * ── 設計方針 ──
 * - ロジックは domain/bridge/workflowPhase.ts に集中
 * - この hook はデータの取得と橋渡しだけ
 * - Repository 取得は React Query 不要（LS は同期的）
 *
 * @see src/domain/bridge/workflowPhase.ts
 */
import { useEffect, useMemo, useState } from 'react';
import type { PlanningSheetRepository } from '@/domain/isp/port';
import type { PlanningSheetListItem } from '@/domain/isp/schema';
import type { IUserMaster } from '@/sharepoint/fields';
import {
  buildPlanningWorkflowUi,
  type PlanningWorkflowUiSheetSnapshot,
  type PlanningWorkflowUiCardItem,
  type PlanningWorkflowUiPhase,
} from '@/app/services/bridgeProxy';

// ─────────────────────────────────────────────
// Output type
// ─────────────────────────────────────────────

export interface WorkflowPhaseCounts {
  needsAssessment: number;
  needsPlan: number;
  monitoringOverdue: number;
  needsReassessment: number;
  needsMonitoring: number;
  activePlan: number;
}

export interface UseWorkflowPhasesResult {
  /** ソート済み UI 用アイテム一覧 */
  items: PlanningWorkflowUiCardItem[];
  /** フェーズ別件数 */
  counts: WorkflowPhaseCounts;
  /** 最優先アイテム（優先度が最も高い） */
  topPriorityItem?: PlanningWorkflowUiCardItem;
  /** 読み込み中 */
  isLoading: boolean;
  /** 利用者ごとのフェーズ（テスト用 — 未ソート） */
  _phasesByUser: ReadonlyArray<{ userId: string; phase: PlanningWorkflowUiPhase }>;
}

// ─────────────────────────────────────────────
// Adapter: PlanningSheetListItem → PlanningWorkflowUiSheetSnapshot
// ─────────────────────────────────────────────

/**
 * PlanningSheetListItem を UI 向け最小スナップショットに変換する。
 *
 * repository から取得したリスト型を、workflowPhase 判定用の軽量型に変換。
 * procedureCount は PlanningSheetListItem に含まれないため、
 * 外部から注入するか、デフォルト値を使う。
 */
export function toPlanningSheetSnapshot(
  item: PlanningSheetListItem,
  procedureCount?: number,
): PlanningWorkflowUiSheetSnapshot {
  return {
    id: item.id,
    status: item.status,
    appliedFrom: null,     // listItem には含まれないためフォールバック
    reviewedAt: null,      // listItem には含まれないためフォールバック
    reviewCycleDays: 90,   // デフォルト
    procedureCount: procedureCount ?? 1, // listItem に含まれないため、存在すると仮定
    isCurrent: item.isCurrent,
  };
}

// ─────────────────────────────────────────────
// Pure counting helper (testable)
// ─────────────────────────────────────────────

const PHASE_COUNT_KEYS: Record<PlanningWorkflowUiPhase, keyof WorkflowPhaseCounts> = {
  needs_assessment: 'needsAssessment',
  needs_plan: 'needsPlan',
  monitoring_overdue: 'monitoringOverdue',
  needs_reassessment: 'needsReassessment',
  needs_monitoring: 'needsMonitoring',
  active_plan: 'activePlan',
};

/**
 * 利用者ごとの phase からフェーズ別件数を集計する。
 */
export function countByPhase(
  phases: ReadonlyArray<{ phase: PlanningWorkflowUiPhase }>,
): WorkflowPhaseCounts {
  const counts: WorkflowPhaseCounts = {
    needsAssessment: 0,
    needsPlan: 0,
    monitoringOverdue: 0,
    needsReassessment: 0,
    needsMonitoring: 0,
    activePlan: 0,
  };

  for (const r of phases) {
    const key = PHASE_COUNT_KEYS[r.phase];
    if (key) counts[key]++;
  }

  return counts;
}

// ─────────────────────────────────────────────
// Pure pipeline (testable without React)
// ─────────────────────────────────────────────

/**
 * 利用者データ + 計画シートデータ → ソート済みカードアイテム一覧
 *
 * Bridge の buildPlanningWorkflowUi を呼ぶだけの薄いラッパー。
 * 旧 API 互換のため {phases, items} の組を返す。
 */
export function buildWorkflowItems(
  users: Array<{ userId: string; userName: string }>,
  sheetsByUser: Map<string, PlanningWorkflowUiSheetSnapshot[]>,
  referenceDate?: string,
): {
  phases: ReadonlyArray<{ userId: string; phase: PlanningWorkflowUiPhase }>;
  items: PlanningWorkflowUiCardItem[];
} {
  const { items, phases } = buildPlanningWorkflowUi({
    users,
    sheetsByUser,
    referenceDate,
  });
  return { phases, items };
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * 全利用者のワークフローフェーズを一括算出する。
 *
 * @param users - 利用者マスタ一覧
 * @param repo  - PlanningSheetRepository（null なら計画シートなしとして判定）
 */
export function useWorkflowPhases(
  users: IUserMaster[],
  repo: PlanningSheetRepository | null,
): UseWorkflowPhasesResult {
  const [sheetsByUser, setSheetsByUser] = useState<Map<string, PlanningWorkflowUiSheetSnapshot[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // 利用者の userId + userName を安定化
  const userEntries = useMemo(
    () =>
      users.map((u, i) => ({
        userId: (u.UserID ?? '').trim() || `U${String(u.Id ?? i + 1).padStart(3, '0')}`,
        userName: u.FullName ?? `利用者${i + 1}`,
      })),
    [users],
  );

  // 計画シートを全利用者分取得
  useEffect(() => {
    if (!repo || userEntries.length === 0) {
      setSheetsByUser(new Map());
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const map = new Map<string, PlanningWorkflowUiSheetSnapshot[]>();

      // 並列で取得（パフォーマンス重視）
      const results = await Promise.allSettled(
        userEntries.map(async (user) => {
          const items = await repo.listCurrentByUser(user.userId);
          return { userId: user.userId, items };
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { userId, items } = result.value;
          map.set(userId, items.map((item) => toPlanningSheetSnapshot(item)));
        }
        // rejected は無視（計画シートなしとして扱う）
      }

      if (!cancelled) {
        setSheetsByUser(map);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userEntries, repo]);

  // パイプライン実行 + メモ化
  return useMemo(() => {
    const { phases, items } = buildWorkflowItems(userEntries, sheetsByUser);
    const counts = countByPhase(phases);
    const topPriorityItem = items[0]; // buildPlanningWorkflowUi 内でソート済み

    return {
      items,
      counts,
      topPriorityItem,
      isLoading,
      _phasesByUser: phases,
    };
  }, [userEntries, sheetsByUser, isLoading]);
}
