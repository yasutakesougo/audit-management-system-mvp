/**
 * monitoringToPlanningBridge.ts — 行動モニタリング → 支援計画シート更新ブリッジ
 *
 * PDCA ループの C→A（L2→L2）を接続する第3ブリッジ。
 * 行動モニタリングの結果を、支援計画シートの更新候補として安全に橋渡しする。
 *
 * 入力: BehaviorMonitoringRecord（L2 行動モニタリング専用型）
 * ※ ISPモニタリング（MonitoringMeetingRecord）とは明確に分離
 *
 * 設計方針:
 *  - 2つの反映モード: 自動追記（低リスク）+ 候補提示（職員選択）
 *  - 第1・第2ブリッジと同じ原則: 純関数 / 追記マージ / 冪等性 / provenance
 *  - 計画変更判断は職員に委ねる（候補提示が主軸）
 *
 * @see docs/architecture/isp-three-layer-model.md
 * @see docs/adr/ADR-007-assessment-planning-record-bridge.md
 */
import type { ProvenanceEntry, ProvenanceSource } from '@/features/planning-sheet/assessmentBridge';
import type {
  BehaviorMonitoringRecord,
  SupportMethodEvaluation,
  BehaviorAchievementLevel,
  EnvironmentFinding,
} from '@/domain/isp/behaviorMonitoring';
import type { PlanningSheetFormValues } from '@/domain/isp/schema';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 重複照合に使う先頭文字数 */
const DEDUP_PREFIX_LEN = 30;

/** 方針関連キーワード（recommendedChanges の分類用） */
const POLICY_KEYWORDS = [
  '方針', '目標', '支援', '対応', '関わり', '声かけ',
  '手順', '頻度', '見守り', 'アプローチ', '介入',
] as const;

/** 環境関連キーワード（recommendedChanges の分類用） */
const ENVIRONMENT_KEYWORDS = [
  '環境', '場所', 'スペース', '照明', '音', '温度',
  '座席', '整理', 'レイアウト', 'パーティション', '配置',
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 候補の種類 */
export type MonitoringCandidateCategory =
  | 'effective_support'   // 有効だった支援
  | 'revision_needed'     // 見直し候補
  | 'environment'         // 環境調整
  | 'policy';             // 支援方針

/** 候補提示エントリ */
export interface MonitoringCandidate {
  /** 候補 ID */
  id: string;
  /** 反映先フィールド */
  targetField: keyof PlanningSheetFormValues;
  /** 追記テキスト */
  text: string;
  /** 候補の種類 */
  category: MonitoringCandidateCategory;
  /** 元データの参照ラベル */
  sourceLabel: string;
  /** 変換理由（rationale） */
  reason: string;
}

/** ブリッジ結果 */
export interface MonitoringToPlanningResult {
  /** 自動追記パッチ（低リスク項目） */
  autoPatches: Partial<PlanningSheetFormValues>;
  /** 候補提示（職員が選択して反映） */
  candidates: MonitoringCandidate[];
  /** provenance エントリ */
  provenance: ProvenanceEntry[];
  /** サマリー */
  summary: {
    autoFieldCount: number;
    candidateCount: number;
    goalsContinued: number;
    goalsToRevise: number;
    decisionsApplied: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** テキストの先頭N文字を正規化して返す（重複照合用） */
function dedup(text: string): string {
  return text.trim().slice(0, DEDUP_PREFIX_LEN);
}

/** 既存テキストにブロックが含まれているか */
function alreadyContains(existing: string, block: string): boolean {
  if (!block.trim()) return true;
  return existing.includes(dedup(block));
}

/** テキストを安全に追記する */
function appendText(existing: string, addition: string): string {
  if (!addition.trim()) return existing;
  if (alreadyContains(existing, addition)) return existing;
  return existing ? `${existing}\n\n${addition}` : addition;
}

/** 達成度が「有効な支援」に該当するか */
function isEffective(level: BehaviorAchievementLevel): boolean {
  return level === 'effective' || level === 'mostly_effective';
}

/** 達成度が「見直し候補」に該当するか */
function needsRevision(level: BehaviorAchievementLevel): boolean {
  return level === 'not_effective' || level === 'partial';
}

/** テキストが環境関連キーワードを含むか */
function isEnvironmentRelated(text: string): boolean {
  return ENVIRONMENT_KEYWORDS.some((kw) => text.includes(kw));
}

/** テキストが方針関連キーワードを含むか */
function isPolicyRelated(text: string): boolean {
  return POLICY_KEYWORDS.some((kw) => text.includes(kw));
}

/** 候補 ID を生成する */
function candidateId(category: string, index: number): string {
  return `mc-${category}-${index}`;
}

/** ProvenanceEntry を生成する */
function prov(
  field: string,
  source: ProvenanceSource,
  sourceLabel: string,
  reason: string,
  value: string,
): ProvenanceEntry {
  return {
    field,
    source,
    sourceLabel,
    reason,
    value: value.slice(0, 100),
    importedAt: new Date().toISOString(),
  };
}

/** 期間表示用の文字列 */
function periodLabel(record: BehaviorMonitoringRecord): string {
  if (record.periodStart === record.periodEnd) return record.periodStart;
  return `${record.periodStart}〜${record.periodEnd}`;
}

// ---------------------------------------------------------------------------
// Main Bridge Function
// ---------------------------------------------------------------------------

/**
 * 行動モニタリングの結果を支援計画シートの更新情報に変換する。
 *
 * @param record - 行動モニタリング記録（L2）
 * @param currentForm - 現在のフォーム値（重複照合に使用）
 * @returns 自動追記パッチ + 候補提示 + provenance + summary
 */
export function bridgeMonitoringToPlanning(
  record: BehaviorMonitoringRecord,
  currentForm: PlanningSheetFormValues,
): MonitoringToPlanningResult {
  const patches: Partial<PlanningSheetFormValues> = {};
  const candidates: MonitoringCandidate[] = [];
  const provenanceEntries: ProvenanceEntry[] = [];
  const period = periodLabel(record);

  let autoFieldCount = 0;

  // ── 自動追記: 総合所見 → collectedInformation ──
  if (record.summary.trim()) {
    const block = `【行動モニタリング所見】${record.summary.trim()}`;
    const current = currentForm.collectedInformation ?? '';
    if (!alreadyContains(current, block)) {
      patches.collectedInformation = appendText(current, block);
      provenanceEntries.push(prov(
        'collectedInformation',
        'monitoring',
        `行動モニタリング (${period})`,
        '総合所見を収集情報に追記',
        record.summary,
      ));
      autoFieldCount++;
    }
  }

  // ── 自動追記: 利用者の意向 → collectedInformation ──
  if (record.userFeedback.trim()) {
    const block = `【本人の意向】${record.userFeedback.trim()}`;
    const current = patches.collectedInformation ?? currentForm.collectedInformation ?? '';
    if (!alreadyContains(current, block)) {
      patches.collectedInformation = appendText(current, block);
      provenanceEntries.push(prov(
        'collectedInformation',
        'monitoring',
        `行動モニタリング (${period})`,
        '利用者の意向を収集情報に追記',
        record.userFeedback,
      ));
      autoFieldCount++;
    }
  }

  // ── 自動追記: 家族の意向 → collectedInformation ──
  if (record.familyFeedback.trim()) {
    const block = `【家族の意向】${record.familyFeedback.trim()}`;
    const current = patches.collectedInformation ?? currentForm.collectedInformation ?? '';
    if (!alreadyContains(current, block)) {
      patches.collectedInformation = appendText(current, block);
      provenanceEntries.push(prov(
        'collectedInformation',
        'monitoring',
        `行動モニタリング (${period})`,
        '家族の意向を収集情報に追記',
        record.familyFeedback,
      ));
      autoFieldCount++;
    }
  }

  // ── 自動追記: 困難場面 → observationFacts ──
  if (record.difficultiesObserved.trim()) {
    const block = `【困難場面】${record.difficultiesObserved.trim()}`;
    const current = currentForm.observationFacts ?? '';
    if (!alreadyContains(current, block)) {
      patches.observationFacts = appendText(current, block);
      provenanceEntries.push(prov(
        'observationFacts',
        'monitoring',
        `行動モニタリング (${period})`,
        '困難が見られた場面を行動観察に追記',
        record.difficultiesObserved,
      ));
      autoFieldCount++;
    }
  }

  // ── 自動追記: 医療安全 → observationFacts ──
  if (record.medicalSafetyNotes.trim()) {
    const block = `【医療・安全メモ】${record.medicalSafetyNotes.trim()}`;
    const current = patches.observationFacts ?? currentForm.observationFacts ?? '';
    if (!alreadyContains(current, block)) {
      patches.observationFacts = appendText(current, block);
      provenanceEntries.push(prov(
        'observationFacts',
        'monitoring',
        `行動モニタリング (${period})`,
        '医療・安全面の所見を行動観察に追記',
        record.medicalSafetyNotes,
      ));
      autoFieldCount++;
    }
  }

  // ── 候補提示: 支援方法の評価 ──
  let goalsContinued = 0;
  let goalsToRevise = 0;

  record.supportEvaluations.forEach((se: SupportMethodEvaluation, i: number) => {
    if (!se.methodDescription.trim()) return;

    if (isEffective(se.achievementLevel)) {
      const text = `✅ 有効な支援: ${se.methodDescription} — ${se.comment || '継続推奨'}`;
      const current = currentForm.concreteApproaches ?? '';
      if (!alreadyContains(current, text)) {
        candidates.push({
          id: candidateId('effective', i),
          targetField: 'concreteApproaches',
          text,
          category: 'effective_support',
          sourceLabel: `支援評価: ${se.methodDescription.slice(0, 20)}`,
          reason: `支援方法「${se.methodDescription.slice(0, 20)}」が${se.achievementLevel === 'effective' ? '有効' : '概ね有効'}と評価されたため、具体策として候補提示`,
        });
        provenanceEntries.push(prov(
          'concreteApproaches',
          'monitoring_goal',
          `支援評価: ${se.methodDescription.slice(0, 20)}`,
          `評価「${se.achievementLevel}」: 有効な支援として候補提示`,
          text,
        ));
        goalsContinued++;
      }
    } else if (needsRevision(se.achievementLevel)) {
      const text = `⚠ 見直し候補: ${se.methodDescription} — ${se.comment || '方針再検討'}`;
      const current = currentForm.supportPolicy ?? '';
      if (!alreadyContains(current, text)) {
        candidates.push({
          id: candidateId('revision', i),
          targetField: 'supportPolicy',
          text,
          category: 'revision_needed',
          sourceLabel: `支援評価: ${se.methodDescription.slice(0, 20)}`,
          reason: `支援方法「${se.methodDescription.slice(0, 20)}」が${se.achievementLevel === 'not_effective' ? '効果なし' : '一部有効'}と評価されたため、方針見直し候補として提示`,
        });
        provenanceEntries.push(prov(
          'supportPolicy',
          'monitoring_goal',
          `支援評価: ${se.methodDescription.slice(0, 20)}`,
          `評価「${se.achievementLevel}」: 方針見直し候補として提示`,
          text,
        ));
        goalsToRevise++;
      }
    }
    // not_observed は候補対象外
  });

  // ── 候補提示: 環境調整の効果 ──
  record.environmentFindings.forEach((ef: EnvironmentFinding, i: number) => {
    if (!ef.adjustment.trim()) return;

    if (ef.wasEffective) {
      const text = `✅ 有効な環境調整: ${ef.adjustment} — ${ef.comment || '継続'}`;
      const current = currentForm.environmentalAdjustments ?? '';
      if (!alreadyContains(current, text)) {
        candidates.push({
          id: candidateId('env-ok', i),
          targetField: 'environmentalAdjustments',
          text,
          category: 'environment',
          sourceLabel: `環境評価: ${ef.adjustment.slice(0, 20)}`,
          reason: '環境調整が有効と確認されたため、継続候補として提示',
        });
        provenanceEntries.push(prov(
          'environmentalAdjustments',
          'monitoring_decision',
          `環境評価: ${ef.adjustment.slice(0, 20)}`,
          '有効な環境調整として候補提示',
          text,
        ));
      }
    } else {
      const text = `⚠ 環境調整見直し: ${ef.adjustment} — ${ef.comment || '要改善'}`;
      const current = currentForm.environmentalAdjustments ?? '';
      if (!alreadyContains(current, text)) {
        candidates.push({
          id: candidateId('env-ng', i),
          targetField: 'environmentalAdjustments',
          text,
          category: 'environment',
          sourceLabel: `環境評価: ${ef.adjustment.slice(0, 20)}`,
          reason: '環境調整の効果が不十分と観察されたため、見直し候補として提示',
        });
        provenanceEntries.push(prov(
          'environmentalAdjustments',
          'monitoring_decision',
          `環境評価: ${ef.adjustment.slice(0, 20)}`,
          '効果不十分な環境調整として見直し候補提示',
          text,
        ));
      }
    }
  });

  // ── 候補提示: 推奨変更事項の分類 ──
  let decisionsApplied = 0;

  record.recommendedChanges.forEach((change: string, i: number) => {
    if (!change.trim()) return;

    if (isEnvironmentRelated(change)) {
      const current = currentForm.environmentalAdjustments ?? '';
      if (!alreadyContains(current, change)) {
        candidates.push({
          id: candidateId('rec-env', i),
          targetField: 'environmentalAdjustments',
          text: change.trim(),
          category: 'environment',
          sourceLabel: `推奨変更 #${i + 1}`,
          reason: '推奨変更事項に環境調整の記載があるため、環境調整欄への候補として提示',
        });
        provenanceEntries.push(prov(
          'environmentalAdjustments',
          'monitoring_decision',
          `推奨変更 #${i + 1}`,
          '環境関連の推奨変更を環境調整候補として提示',
          change,
        ));
        decisionsApplied++;
      }
    } else if (isPolicyRelated(change)) {
      const current = currentForm.supportPolicy ?? '';
      if (!alreadyContains(current, change)) {
        candidates.push({
          id: candidateId('rec-pol', i),
          targetField: 'supportPolicy',
          text: change.trim(),
          category: 'policy',
          sourceLabel: `推奨変更 #${i + 1}`,
          reason: '推奨変更事項に支援方針の記載があるため、方針欄への候補として提示',
        });
        provenanceEntries.push(prov(
          'supportPolicy',
          'monitoring_decision',
          `推奨変更 #${i + 1}`,
          '方針関連の推奨変更を支援方針候補として提示',
          change,
        ));
        decisionsApplied++;
      }
    }
  });

  return {
    autoPatches: patches,
    candidates,
    provenance: provenanceEntries,
    summary: {
      autoFieldCount,
      candidateCount: candidates.length,
      goalsContinued,
      goalsToRevise,
      decisionsApplied,
    },
  };
}
