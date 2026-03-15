/**
 * @fileoverview ISP ドラフトセクション → ISP Editor フィールドのマッピング
 * @description
 * Phase 5-D:
 *   buildIspPlanDraft のセクション種別 (IspPlanDraftSectionKind) を
 *   SupportPlanForm のフィールドキーに対応付ける。
 *
 * マッピング原理:
 *   - monitoring-findings → monitoringPlan（モニタリング手法）
 *   - goal-assessment     → assessmentSummary（ニーズ・課題の要約）
 *   - decision-summary    → conferenceNotes（会議・同意の記録）
 *   - plan-revision       → reviewTiming（見直しタイミング・判断基準）
 *   - next-actions        → improvementIdeas（改善提案 / 次のアクション）
 *   - overview            → (転記対象外: 期間概要は情報参照用)
 */

import type { IspPlanDraftSectionKind, IspPlanDraft } from './ispPlanDraftTypes';
import type { SupportPlanStringFieldKey } from '@/features/support-plan-guide/types';

// ─── マッピング定義 ─────────────────────────────────────

/**
 * セクション種別 → ISP Editor フィールドキーの対応。
 * null = 転記対象外。
 */
export const DRAFT_SECTION_TO_FIELD: Record<IspPlanDraftSectionKind, SupportPlanStringFieldKey | null> = {
  'overview':            null,                // 情報参照のみ
  'monitoring-findings': 'monitoringPlan',    // モニタリング手法
  'goal-assessment':     'assessmentSummary', // ニーズ・課題の要約
  'decision-summary':    'conferenceNotes',   // 会議・同意の記録
  'plan-revision':       'reviewTiming',      // 見直しタイミング
  'next-actions':        'improvementIdeas',  // 改善提案 / 次のアクション
};

/**
 * セクション種別 → 転記先のフィールド表示名。
 * UI でユーザーに「どこに反映されるか」を明示するために使う。
 */
export const DRAFT_SECTION_TARGET_LABELS: Record<IspPlanDraftSectionKind, string | null> = {
  'overview':            null,
  'monitoring-findings': 'モニタリング手法',
  'goal-assessment':     'ニーズ・課題の要約',
  'decision-summary':    '会議・同意の記録',
  'plan-revision':       '見直しタイミング・判断基準',
  'next-actions':        '改善提案 / 次のアクション',
};

// ─── 転記対象セクションの抽出 ──────────────────────────────

/** 転記対象セクションのみを返す */
export type ApplicableSectionItem = {
  kind: IspPlanDraftSectionKind;
  title: string;
  targetField: SupportPlanStringFieldKey;
  targetLabel: string;
  text: string;
};

/**
 * ドラフトから転記可能なセクションのリストを生成する。
 * overview (null) は除外される。
 */
export function extractApplicableSections(draft: IspPlanDraft): ApplicableSectionItem[] {
  return draft.sections
    .filter((s) => DRAFT_SECTION_TO_FIELD[s.kind] !== null)
    .map((s) => ({
      kind: s.kind,
      title: s.title,
      targetField: DRAFT_SECTION_TO_FIELD[s.kind]!,
      targetLabel: DRAFT_SECTION_TARGET_LABELS[s.kind]!,
      text: s.lines.join('\n'),
    }));
}

/**
 * ドラフトの全転記対象セクションを一括で
 * { fieldKey: text } のマップとして返す。
 */
export function buildDraftFieldMap(
  draft: IspPlanDraft,
): Partial<Record<SupportPlanStringFieldKey, string>> {
  const map: Partial<Record<SupportPlanStringFieldKey, string>> = {};
  for (const item of extractApplicableSections(draft)) {
    map[item.targetField] = item.text;
  }
  return map;
}
