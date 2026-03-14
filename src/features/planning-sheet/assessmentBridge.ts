/**
 * assessmentBridge.ts — アセスメント → 支援計画シート データブリッジ
 *
 * UserAssessment（ICF 分類）と TokuseiSurveyResponse（特性アンケート）を
 * PlanningIntake / PlanningSheetFormValues の該当フィールドに変換する純関数群。
 *
 * 設計方針:
 *  - 上書きではなく「マージ」: 既存データを保持しつつ新規情報を追記
 *  - 出典の明示: 取り込んだ情報には出典ラベルを付与
 *  - 冪等性: 同一データの再取込は重複を生まない
 */
import type { TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import { parseAggregatedFeatures } from '@/domain/assessment/tokusei';
import type { PlanningIntake, PlanningSheetFormValues } from '@/domain/isp/schema';
import type { AssessmentItem, SensoryProfile, UserAssessment } from '@/features/assessment/domain/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 出典の種別 */
export type ProvenanceSource =
  | 'assessment_sensory'   // アセスメント: 感覚プロファイル
  | 'assessment_icf'       // アセスメント: ICF 分類アイテム
  | 'assessment_tags'      // アセスメント: 分析タグ
  | 'tokusei_survey'       // 特性アンケート回答
  | 'planning_sheet'       // 支援計画シート（→手順書兼記録へのブリッジ）
  | 'monitoring'           // モニタリング: 総合所見・意向
  | 'monitoring_goal'      // モニタリング: 目標達成評価
  | 'monitoring_decision'; // モニタリング: 決定事項

/** 変換根拠の1エントリ */
export interface ProvenanceEntry {
  /** 変換先フィールド名 */
  field: string;
  /** 出典の種別 */
  source: ProvenanceSource;
  /** 出典の表示ラベル（例: 「感覚プロファイル」「特性アンケート（保護者A）」） */
  sourceLabel: string;
  /** 変換理由（例: 「聴覚スコア 5/5 ≥ 4 のため過敏として追加」） */
  reason: string;
  /** 追加された値の要約 */
  value: string;
  /** 取込日時（ISO 8601） */
  importedAt: string;
}

/** ブリッジ結果: 変換されたフィールドのサブセット */
export interface AssessmentBridgeResult {
  /** 支援計画シートの概要向けフィールド */
  formPatches: Partial<PlanningSheetFormValues>;
  /** インテーク向けフィールド */
  intakePatches: Partial<PlanningIntake>;
  /** 取込件数サマリー */
  summary: {
    sensoryTriggersAdded: number;
    observationFactsAppended: boolean;
    collectedInfoAppended: boolean;
    medicalFlagsAdded: number;
  };
  /** 出典追跡（provenance）: 各フィールドの変換根拠 */
  provenance: ProvenanceEntry[];
}

// ---------------------------------------------------------------------------
// Sensory Profile → sensoryTriggers
// ---------------------------------------------------------------------------

const SENSORY_LABELS: Record<keyof SensoryProfile, string> = {
  visual: '視覚',
  auditory: '聴覚',
  tactile: '触覚',
  olfactory: '嗅覚',
  vestibular: '前庭覚',
  proprioceptive: '固有受容覚',
};

/**
 * SensoryProfile の数値を感覚トリガー文字列に変換する。
 * 値が 4 以上 (過敏傾向) のものをトリガーとして抽出。
 */
export function sensoryProfileToTriggers(profile: SensoryProfile): string[] {
  const triggers: string[] = [];
  for (const [key, value] of Object.entries(profile)) {
    if (value >= 4) {
      const label = SENSORY_LABELS[key as keyof SensoryProfile];
      triggers.push(`${label}過敏 (スコア: ${value}/5)`);
    }
  }
  return triggers;
}

// ---------------------------------------------------------------------------
// AssessmentItem → テキスト集約
// ---------------------------------------------------------------------------

/**
 * AssessmentItem[] から特定カテゴリのテキストを抽出し整形する。
 */
function extractItemText(
  items: AssessmentItem[],
  category: AssessmentItem['category'],
): string {
  const filtered = items.filter((item) => item.category === category);
  if (filtered.length === 0) return '';
  return filtered
    .map((item) => {
      const statusLabel = item.status === 'strength' ? '🟢' : item.status === 'challenge' ? '🔴' : '⚪';
      return `${statusLabel} ${item.topic}: ${item.description}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// TokuseiSurveyResponse → 行動観察テキスト
// ---------------------------------------------------------------------------

/**
 * 特性アンケートの集約フィールドから行動観察用テキストを生成する。
 */
export function tokuseiToObservationText(response: TokuseiSurveyResponse): string {
  const lines: string[] = [];

  // 性格・対人関係
  if (response.personality) {
    const entries = parseAggregatedFeatures(response.personality);
    if (entries.length > 0) {
      lines.push('■ 性格・対人関係');
      entries.forEach((e) => lines.push(`  ${e.label}: ${e.content}`));
    }
  }

  // 行動特性
  if (response.behaviorFeatures) {
    const entries = parseAggregatedFeatures(response.behaviorFeatures);
    if (entries.length > 0) {
      lines.push('■ 行動特性');
      entries.forEach((e) => lines.push(`  ${e.label}: ${e.content}`));
    }
  }

  return lines.join('\n');
}

/**
 * 特性アンケートの感覚フィールドから収集情報テキストを生成する。
 */
export function tokuseiToCollectedInfo(response: TokuseiSurveyResponse): string {
  const lines: string[] = [];

  if (response.sensoryFeatures) {
    const entries = parseAggregatedFeatures(response.sensoryFeatures);
    if (entries.length > 0) {
      lines.push('■ 感覚特性（特性アンケートより）');
      entries.forEach((e) => lines.push(`  ${e.label}: ${e.content}`));
    }
  }

  if (response.strengths) {
    lines.push('■ 得意なこと・強み');
    lines.push(`  ${response.strengths}`);
  }

  if (response.notes) {
    lines.push('■ 特記事項');
    lines.push(`  ${response.notes}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 重複除去ヘルパー
// ---------------------------------------------------------------------------

/** 既存配列に含まれない要素だけを追加する */
function mergeUnique(existing: string[], additions: string[]): string[] {
  const set = new Set(existing);
  const result = [...existing];
  for (const item of additions) {
    if (!set.has(item)) {
      set.add(item);
      result.push(item);
    }
  }
  return result;
}

/** テキストが既に含まれていなければ追記する */
function appendIfNew(existing: string, addition: string, separator = '\n\n'): string {
  if (!addition.trim()) return existing;
  if (existing.includes(addition.trim())) return existing;
  return existing ? `${existing}${separator}${addition}` : addition;
}

// ---------------------------------------------------------------------------
// Main Bridge Function
// ---------------------------------------------------------------------------

/**
 * UserAssessment と（オプションで）TokuseiSurveyResponse を
 * 支援計画シートの各フィールドに変換する。
 *
 * @param assessment - アセスメント画面で管理している UserAssessment
 * @param tokuseiResponse - 特性アンケートの回答（任意）。指定時は直接テキスト抽出。
 * @param currentForm - 現在のフォーム値（マージ元）
 * @param currentIntake - 現在のインテーク値（マージ元）
 */
export function bridgeAssessmentToPlanningSheet(
  assessment: UserAssessment,
  tokuseiResponse: TokuseiSurveyResponse | null,
  currentForm: PlanningSheetFormValues,
  currentIntake: PlanningIntake,
): AssessmentBridgeResult {
  const now = new Date().toISOString();
  const provenance: ProvenanceEntry[] = [];

  // 1. 感覚トリガー
  const newTriggers = sensoryProfileToTriggers(assessment.sensory);
  const mergedTriggers = mergeUnique(currentIntake.sensoryTriggers, newTriggers);

  // provenance: 感覚トリガー
  for (const [key, value] of Object.entries(assessment.sensory)) {
    if (value >= 4) {
      const label = SENSORY_LABELS[key as keyof SensoryProfile];
      provenance.push({
        field: 'intake.sensoryTriggers',
        source: 'assessment_sensory',
        sourceLabel: '感覚プロファイル',
        reason: `${label}スコア ${value}/5 ≥ 4 のため過敏として追加`,
        value: `${label}過敏 (スコア: ${value}/5)`,
        importedAt: now,
      });
    }
  }

  // 2. 行動観察（observationFacts）
  let observationAddition = '';
  const bodyItems = extractItemText(assessment.items, 'body');
  const activityItems = extractItemText(assessment.items, 'activity');
  if (bodyItems || activityItems) {
    const parts: string[] = ['── アセスメントからの取込 ──'];
    if (bodyItems) parts.push(`[身体機能]\n${bodyItems}`);
    if (activityItems) parts.push(`[活動]\n${activityItems}`);
    observationAddition = parts.join('\n');

    // provenance: ICF body/activity → observationFacts
    const bodyCount = assessment.items.filter((i) => i.category === 'body').length;
    const actCount = assessment.items.filter((i) => i.category === 'activity').length;
    if (bodyCount > 0) {
      provenance.push({
        field: 'observationFacts',
        source: 'assessment_icf',
        sourceLabel: 'ICF 分類（身体機能）',
        reason: `身体機能カテゴリのアセスメント項目 ${bodyCount}件を行動観察に追記`,
        value: bodyItems.substring(0, 80) + (bodyItems.length > 80 ? '…' : ''),
        importedAt: now,
      });
    }
    if (actCount > 0) {
      provenance.push({
        field: 'observationFacts',
        source: 'assessment_icf',
        sourceLabel: 'ICF 分類（活動）',
        reason: `活動カテゴリのアセスメント項目 ${actCount}件を行動観察に追記`,
        value: activityItems.substring(0, 80) + (activityItems.length > 80 ? '…' : ''),
        importedAt: now,
      });
    }
  }

  // 特性アンケートから直接取込
  if (tokuseiResponse) {
    const tokuseiObs = tokuseiToObservationText(tokuseiResponse);
    if (tokuseiObs) {
      const responder = tokuseiResponse.responderName || '不明';
      const source = `── 特性アンケート（回答者: ${responder}）──`;
      observationAddition = observationAddition
        ? `${observationAddition}\n\n${source}\n${tokuseiObs}`
        : `${source}\n${tokuseiObs}`;

      provenance.push({
        field: 'observationFacts',
        source: 'tokusei_survey',
        sourceLabel: `特性アンケート（回答者: ${responder}）`,
        reason: '性格・対人関係／行動特性の回答を行動観察に追記',
        value: tokuseiObs.substring(0, 80) + (tokuseiObs.length > 80 ? '…' : ''),
        importedAt: now,
      });
    }
  }

  const mergedObservationFacts = appendIfNew(
    currentForm.observationFacts,
    observationAddition,
  );

  // 3. 収集情報（collectedInformation）
  let collectedAddition = '';
  const envItems = extractItemText(assessment.items, 'environment');
  const personalItems = extractItemText(assessment.items, 'personal');
  if (envItems || personalItems) {
    const parts: string[] = ['── アセスメントからの取込 ──'];
    if (envItems) parts.push(`[環境因子]\n${envItems}`);
    if (personalItems) parts.push(`[個人因子]\n${personalItems}`);
    collectedAddition = parts.join('\n');

    // provenance: ICF env/personal → collectedInformation
    const envCount = assessment.items.filter((i) => i.category === 'environment').length;
    const persCount = assessment.items.filter((i) => i.category === 'personal').length;
    if (envCount > 0) {
      provenance.push({
        field: 'collectedInformation',
        source: 'assessment_icf',
        sourceLabel: 'ICF 分類（環境因子）',
        reason: `環境因子カテゴリのアセスメント項目 ${envCount}件を収集情報に追記`,
        value: envItems.substring(0, 80) + (envItems.length > 80 ? '…' : ''),
        importedAt: now,
      });
    }
    if (persCount > 0) {
      provenance.push({
        field: 'collectedInformation',
        source: 'assessment_icf',
        sourceLabel: 'ICF 分類（個人因子）',
        reason: `個人因子カテゴリのアセスメント項目 ${persCount}件を収集情報に追記`,
        value: personalItems.substring(0, 80) + (personalItems.length > 80 ? '…' : ''),
        importedAt: now,
      });
    }
  }

  if (tokuseiResponse) {
    const tokuseiCollected = tokuseiToCollectedInfo(tokuseiResponse);
    if (tokuseiCollected) {
      collectedAddition = collectedAddition
        ? `${collectedAddition}\n\n${tokuseiCollected}`
        : tokuseiCollected;

      provenance.push({
        field: 'collectedInformation',
        source: 'tokusei_survey',
        sourceLabel: `特性アンケート（回答者: ${tokuseiResponse.responderName || '不明'}）`,
        reason: '感覚特性・得意なこと・特記事項を収集情報に追記',
        value: tokuseiCollected.substring(0, 80) + (tokuseiCollected.length > 80 ? '…' : ''),
        importedAt: now,
      });
    }
  }

  const mergedCollectedInformation = appendIfNew(
    currentForm.collectedInformation,
    collectedAddition,
  );

  // 4. 医療フラグ（analysisTags → medicalFlags）
  const medicalKeywords = ['てんかん', '投薬', '服薬', '医療', 'アレルギー', '持病'];
  const newMedicalFlags = assessment.analysisTags.filter((tag) =>
    medicalKeywords.some((kw) => tag.includes(kw)),
  );
  const mergedMedicalFlags = mergeUnique(currentIntake.medicalFlags, newMedicalFlags);

  // provenance: 医療フラグ
  for (const flag of newMedicalFlags) {
    if (!currentIntake.medicalFlags.includes(flag)) {
      const matchedKw = medicalKeywords.find((kw) => flag.includes(kw)) ?? '';
      provenance.push({
        field: 'intake.medicalFlags',
        source: 'assessment_tags',
        sourceLabel: '分析タグ',
        reason: `タグ内に医療関連キーワード「${matchedKw}」を検出したため追加`,
        value: flag,
        importedAt: now,
      });
    }
  }

  return {
    formPatches: {
      observationFacts: mergedObservationFacts,
      collectedInformation: mergedCollectedInformation,
    },
    intakePatches: {
      sensoryTriggers: mergedTriggers,
      medicalFlags: mergedMedicalFlags,
    },
    summary: {
      sensoryTriggersAdded: mergedTriggers.length - currentIntake.sensoryTriggers.length,
      observationFactsAppended: mergedObservationFacts !== currentForm.observationFacts,
      collectedInfoAppended: mergedCollectedInformation !== currentForm.collectedInformation,
      medicalFlagsAdded: mergedMedicalFlags.length - currentIntake.medicalFlags.length,
    },
    provenance,
  };
}
