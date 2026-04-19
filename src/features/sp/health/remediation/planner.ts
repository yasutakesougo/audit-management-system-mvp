/**
 * Remediation Planner — health signal から RemediationPlan を生成する純粋関数
 *
 * 純粋性の契約:
 * - fetch しない
 * - spClient / spFetch を呼ばない
 * - localStorage を読まない
 * - 日時依存を埋め込まない（注入で受ける）
 * - 副作用を持たない
 *
 * 責務:
 * - signal → remediation 候補の変換
 * - reason の組み立て
 * - risk の分類
 * - requiresApproval / autoExecutable の判定材料整理
 *
 * 非責務:
 * - 実際の削除実行
 * - retry / throttle
 * - audit emission
 */

import type { IndexDiffResult, SpIndexedField } from '../indexAdvisor/spIndexLogic';
import type { IndexFieldSpec } from '../indexAdvisor/spIndexKnownConfig';
import type {
  RemediationPlan,
  RemediationRisk,
  RemediationSource,
} from './types';

// ── Input types ──────────────────────────────────────────────────────────────

/** planner に渡すインデックス圧迫診断の入力 */
export interface IndexPressureInput {
  listKey: string;
  /** calculateIndexDiff の結果 */
  diff: IndexDiffResult;
  /** 現在の SP インデックス数 */
  currentIndexCount: number;
  /** SP インデックス上限（通常 20） */
  indexLimit?: number;
}

/** planner のオプション（テスト時の日時注入など） */
export interface PlannerOptions {
  /** plan 生成日時（省略時は呼び出し元が注入すべき） */
  now?: string;
  /** plan の出所 */
  source?: RemediationSource;
  /** ID 生成関数（テスト時に deterministic にするため） */
  idGenerator?: () => string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_INDEX_LIMIT = 20;

/**
 * インデックス圧迫率のしきい値
 * この割合を超えていると remediation を提案する
 */
const INDEX_PRESSURE_THRESHOLD = 0.7;

// ── ID generation ────────────────────────────────────────────────────────────

let _counter = 0;

function defaultIdGenerator(): string {
  _counter += 1;
  return `rem-${Date.now()}-${_counter}`;
}

// ── Risk classification ──────────────────────────────────────────────────────

/**
 * 削除候補フィールドのリスクを分類する
 *
 * - Note/Computed/Counter 型 → safe（SP がそもそもインデックス非対応）
 * - ゾンビ列（連番サフィックス）→ safe
 * - それ以外 → moderate（外部連携で参照されている可能性）
 */
function classifyDeletionRisk(field: SpIndexedField): RemediationRisk {
  const { typeAsString, internalName } = field;

  // SP がインデックス非対応の型 → 削除しても実害なし
  if (typeAsString === 'Note' || typeAsString === 'Computed' || typeAsString === 'Counter' || typeAsString === 'Integer') {
    return 'safe';
  }

  // ゾンビ列（連番サフィックス）→ 設定残骸の可能性が高い
  if (/\d+$/.test(internalName)) {
    return 'safe';
  }

  // それ以外は外部連携への影響がありえる
  return 'moderate';
}

/**
 * 追加候補フィールドのリスクを分類する
 * インデックス追加は常に safe（既存データへの影響なし）
 */
function classifyAdditionRisk(): RemediationRisk {
  return 'safe';
}

// ── Auto-executable policy ───────────────────────────────────────────────────

/**
 * 自動実行ポリシーの判定
 *
 * 現状は保守的に設定:
 * - safe かつ delete_index → true（ゾンビ/非対応型の削除は自動化OK）
 * - safe かつ create_index → true（インデックス追加は安全）
 * - moderate 以上 → false（人間の確認が必要）
 */
function isAutoExecutable(risk: RemediationRisk): boolean {
  return risk === 'safe';
}

// ── Reason builders ──────────────────────────────────────────────────────────

function buildDeletionReason(listKey: string, field: SpIndexedField, pressureRatio: number): string {
  const pressurePercent = Math.round(pressureRatio * 100);
  return `[${listKey}] フィールド "${field.displayName}" (${field.internalName}) のインデックス削除を提案。`
    + ` 理由: ${field.deletionReason}`
    + ` — 現在のインデックス使用率 ${pressurePercent}%`;
}

function buildAdditionReason(listKey: string, field: IndexFieldSpec): string {
  return `[${listKey}] フィールド "${field.displayName}" (${field.internalName}) のインデックス追加を提案。`
    + ` 理由: ${field.reason}`;
}

// ── Main planner ─────────────────────────────────────────────────────────────

/**
 * インデックス圧迫診断から RemediationPlan を生成する
 *
 * @param inputs - 各リストのインデックス圧迫診断結果
 * @param options - 日時注入・ID生成のオーバーライド
 * @returns 生成された RemediationPlan の配列
 */
export function buildRemediationPlans(
  inputs: IndexPressureInput[],
  options: PlannerOptions = {},
): RemediationPlan[] {
  const {
    now = new Date().toISOString(),
    source = 'realtime',
    idGenerator = defaultIdGenerator,
  } = options;

  const plans: RemediationPlan[] = [];

  for (const input of inputs) {
    const { listKey, diff, currentIndexCount, indexLimit = DEFAULT_INDEX_LIMIT } = input;
    const pressureRatio = currentIndexCount / indexLimit;

    // ── 削除候補 → delete_index plan ──────────────────────────────────────
    for (const field of diff.deletionCandidates) {
      const risk = classifyDeletionRisk(field);
      const autoExec = isAutoExecutable(risk);

      plans.push({
        id: idGenerator(),
        target: {
          type: 'index',
          listKey,
          fieldName: field.internalName,
        },
        action: 'delete_index',
        risk,
        autoExecutable: autoExec,
        requiresApproval: !autoExec,
        reason: buildDeletionReason(listKey, field, pressureRatio),
        source,
        createdAt: now,
      });
    }

    // ── 追加候補 → create_index plan（圧迫時のみ抑制しない） ─────────────
    for (const field of diff.additionCandidates) {
      // 圧迫率が高い場合でも追加候補は出す（削除を先にすればスロットが空く）
      // ただし圧迫率が高い場合は autoExecutable を false にする
      const risk = classifyAdditionRisk();
      const autoExec = pressureRatio < INDEX_PRESSURE_THRESHOLD;

      plans.push({
        id: idGenerator(),
        target: {
          type: 'index',
          listKey,
          fieldName: field.internalName,
        },
        action: 'create_index',
        risk,
        autoExecutable: autoExec,
        requiresApproval: !autoExec,
        reason: buildAdditionReason(listKey, field),
        source,
        createdAt: now,
      });
    }
  }

  return plans;
}
