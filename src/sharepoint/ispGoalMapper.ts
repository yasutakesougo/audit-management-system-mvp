/**
 * ISP Goal ↔ SharePoint PlanGoal マッピング・正規化モジュール
 *
 * GoalItem（ドメインモデル） ⇄ SpPlanGoalItem/PlanGoalPayload（SP DTO）
 * 間の変換を一元管理する。
 *
 * 設計ポイント:
 *   - undefined / null の厳密ハンドリング（SP は空文字列を好む）
 *   - GoalItem.domains (string[]) ↔ SP Domains (comma CSV)
 *   - SP Id → GoalItem.id は "sp-{Id}" 規約を維持（upsertGoal 互換）
 */
import type { GoalItem } from '@/features/shared/goal/goalTypes';
import type { SupportPlanForm } from '@/features/support-plan-guide/types';
import {
    PLAN_GOAL_FIELDS,
    type PlanGoalPayload,
    type SpPlanGoalItem,
} from './fields';

/* ────────────────────────────────────────────────────────────────
 * SP 行 → GoalItem（読み取り方向）
 * ──────────────────────────────────────────────────────────────── */

/**
 * SharePoint の PlanGoal 行を GoalItem ドメインモデルに変換する。
 *
 * - `Domains` カラム (CSV) → `string[]`
 * - null / undefined → 空文字列 or 空配列でフォールバック
 */
export function spRowToGoalItem(row: SpPlanGoalItem): GoalItem {
  const domainsRaw = row.Domains ?? '';
  return {
    id: `sp-${row.Id}`,
    type: row.GoalType ?? 'support',
    label: row.GoalLabel ?? '',
    text: row.GoalText ?? '',
    domains: domainsRaw
      ? domainsRaw.split(',').map((d) => d.trim()).filter(Boolean)
      : [],
  };
}

/**
 * PLAN_GOAL_FIELDS ベースの SpPlanGoalRow（Record 型）から GoalItem に変換。
 * 既存の ispRepo.mapSpRowToGoalItem と同等だが、フィールドマップ経由でアクセス。
 */
export function mapFieldRowToGoalItem(row: Record<string, unknown>): GoalItem {
  const F = PLAN_GOAL_FIELDS;
  const domainsRaw = (row[F.domains] as string) ?? '';
  return {
    id: `sp-${row[F.id] ?? row.Id ?? 0}`,
    type: (row[F.goalType] as GoalItem['type']) ?? 'support',
    label: (row[F.goalLabel] as string) ?? '',
    text: (row[F.goalText] as string) ?? '',
    domains: domainsRaw
      ? domainsRaw.split(',').map((d) => d.trim()).filter(Boolean)
      : [],
  };
}

/* ────────────────────────────────────────────────────────────────
 * GoalItem → SP ペイロード（書き込み方向）
 * ──────────────────────────────────────────────────────────────── */

/**
 * GoalItem をSharePoint PlanGoal リストのPATCH/POSTボディに正規化する。
 *
 * **正規化ルール:**
 * - `text` が undefined/null → 空文字列に補正
 * - `domains` が undefined/null → 空配列に補正 → CSV 結合
 * - `type` が不正値 → 'support' にフォールバック
 * - `label` が空 → 型名から自動生成
 *
 * @param goal      - ドメインモデル
 * @param userCode  - Users_Master.UserID
 * @param meta      - 計画メタ情報
 * @param sortOrder - 並び順 (省略時は null)
 */
export function normalizeGoalForSP(
  goal: GoalItem,
  userCode: string,
  meta: {
    planPeriod?: string | null;
    planStatus: 'confirmed' | 'draft';
    certExpiry?: string | null;
  },
  sortOrder?: number | null,
): PlanGoalPayload {
  const validTypes = new Set<GoalItem['type']>(['long', 'short', 'support']);
  const type = validTypes.has(goal.type) ? goal.type : 'support';

  const FALLBACK_LABELS: Record<GoalItem['type'], string> = {
    long: '長期目標',
    short: '短期目標',
    support: '支援内容',
  };

  return {
    UserCode: userCode,
    GoalType: type,
    GoalLabel: (goal.label ?? '').trim() || FALLBACK_LABELS[type],
    GoalText: (goal.text ?? '').trim(),
    Domains: (goal.domains ?? []).filter(Boolean).join(','),
    PlanPeriod: meta.planPeriod ?? null,
    PlanStatus: meta.planStatus,
    CertExpiry: meta.certExpiry ?? null,
    SortOrder: sortOrder ?? null,
  };
}

/* ────────────────────────────────────────────────────────────────
 * SupportPlanForm → GoalItem[] 変換
 * ──────────────────────────────────────────────────────────────── */

/**
 * SupportPlanForm の構造化目標データを返す。
 *
 * Phase 5: form.goals が唯一のデータソース。
 */
export function formToGoals(form: SupportPlanForm): GoalItem[] {
  return form.goals ?? [];
}

/* ────────────────────────────────────────────────────────────────
 * 一括保存ラッパー
 * ──────────────────────────────────────────────────────────────── */

export type ISPGoalSpClient = {
  spFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

/**
 * GoalItem[] をまとめて PlanGoal リストに upsert する。
 *
 * - sp-{id} 形式 → PATCH (既存アイテム更新)
 * - それ以外   → POST  (新規作成)
 *
 * @throws ネットワークエラー / SP エラー時は例外を投げる
 */
export async function batchUpsertGoals(
  client: ISPGoalSpClient,
  goals: GoalItem[],
  userCode: string,
  meta: {
    planPeriod?: string | null;
    planStatus: 'confirmed' | 'draft';
    certExpiry?: string | null;
  },
  listTitle: string,
): Promise<void> {
  const promises = goals.map(async (goal, index) => {
    const payload = normalizeGoalForSP(goal, userCode, meta, index);

    const spIdMatch = goal.id.match(/^sp-(\d+)$/);

    if (spIdMatch) {
      const itemId = Number(spIdMatch[1]);
      const path = `/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items(${itemId})`;
      const res = await client.spFetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;odata=verbose',
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`PATCH goal ${goal.id} failed: ${res.status} ${res.statusText}`);
      }
    } else {
      const path = `/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items`;
      const res = await client.spFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;odata=verbose' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`POST goal ${goal.id} failed: ${res.status} ${res.statusText}`);
      }
    }
  });

  await Promise.all(promises);
}
