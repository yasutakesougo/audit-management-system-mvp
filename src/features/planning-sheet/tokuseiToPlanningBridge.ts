/**
 * tokuseiToPlanningBridge.ts — 特性アンケート → 支援計画シート データブリッジ
 *
 * TokuseiSurveyResponse（特性アンケート回答）を支援計画シートの
 * FormState / PlanningIntake / PlanningAssessment に変換する純関数群。
 *
 * 設計原則:
 *  - 特性アンケート由来データは「候補値」を基本とする
 *  - 高確度のみ自動入力し、解釈を伴う内容は候補提示に留める
 *  - 構造化セクションへの取込は append-first
 *  - 既存記載の上書きは明示操作時のみ許可する
 *  - 全取込フィールドに provenance を保持する
 *
 * @module
 */
import type { SpTokuseiRawRow, TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import { parseAggregatedFeatures } from '@/domain/assessment/tokusei';
import type {
  PlanningAssessment,
  PlanningIntake,
} from '@/domain/isp/schema';
import type { ProvenanceSource } from './assessmentBridge';
import { TOKUSEI_FIELD_MAP } from './tokuseiFieldMap';
import {
  buildAssessmentPatches,
  buildAudit,
  buildCandidates,
  buildFormPatches,
  buildIntakePatches,
  buildProvenance,
  summarizeTokuseiBridge,
} from './tokuseiBridgeBuilders';
import type { ExtractedSignals } from './tokuseiBridgeBuilders';
import {
  extractBehaviorSignals,
  extractChangeRigiditySignals,
  extractCommunicationSignals,
  extractMedicalSignals,
  extractSensorySignals,
} from './tokuseiSignalExtractors';

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

/** 自動入力結果の信頼度 */
export type BridgeConfidence = 'high' | 'medium' | 'low';

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/** 特性アンケート固有の出典エントリ */
export interface TokuseiProvenanceEntry {
  /** 変換先フィールド名 */
  field: string;
  /** 出典種別 */
  source: ProvenanceSource;
  /** 出典の表示ラベル */
  sourceLabel: string;
  /** 変換理由 */
  reason: string;
  /** 追加された値の要約 */
  value: string;
  /** 信頼度 */
  confidence: BridgeConfidence;
  /** 取込日時（ISO 8601） */
  importedAt: string;
}

// ---------------------------------------------------------------------------
// Normalized Source
// ---------------------------------------------------------------------------

/**
 * 細分化データ（SpTokuseiRawRow）と集約データ（TokuseiSurveyResponse）を
 * 統一的に扱うための正規化インターフェース。
 *
 * bridge の内部ではこの型のみを使用し、入力ソースの差異を吸収する。
 */
export interface TokuseiSourceNormalized {
  // ── 対人関係 ──
  relationalDifficulties: string;
  situationalUnderstanding: string;
  // ── 感覚（5種） ──
  hearing: string;
  vision: string;
  touch: string;
  smell: string;
  taste: string;
  sensoryMultiSelect: string;
  sensoryFreeText: string;
  // ── こだわり ──
  difficultyWithChanges: string;
  interestInParts: string;
  repetitiveBehaviors: string;
  fixedHabits: string;
  // ── コミュニケーション ──
  comprehensionDifficulty: string;
  expressionDifficulty: string;
  interactionDifficulty: string;
  // ── 行動 ──
  behaviorMultiSelect: string;
  behaviorEpisodes: string;
  // ── その他 ──
  strengths: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Candidate Types — 確度 low のデータは patch に入れず候補として提示
// ---------------------------------------------------------------------------

/** 対象行動の候補 */
export interface TargetBehaviorCandidate {
  name: string;
  operationalDefinition: string;
  /** アンケートの原文 */
  sourceText: string;
  confidence: BridgeConfidence;
}

/** 行動の機能仮説の候補 */
export interface BehaviorHypothesisCandidate {
  function: string;
  evidence: string;
  /** アンケートの原文 */
  sourceText: string;
  confidence: BridgeConfidence;
}

/** ABC 観察イベントの候補 */
export interface AbcEventCandidate {
  antecedent: string;
  behavior: string;
  consequence: string;
  /** アンケートの原文 */
  sourceText: string;
  confidence: BridgeConfidence;
}

// ---------------------------------------------------------------------------
// Summary / Audit Types
// ---------------------------------------------------------------------------

/** UI 表示用サマリー */
export interface TokuseiBridgeSummary {
  /** §3 氷山分析に入力されたフィールド数 */
  icebergFieldsFilled: number;
  /** 感覚トリガー追加数 */
  sensoryTriggersAdded: number;
  /** 行動仮説候補の生成数 */
  hypothesesGenerated: number;
  /** 対象行動の候補数 */
  targetBehaviorCandidates: number;
}

/** 監査・ログ用の詳細情報 */
export interface TokuseiBridgeAudit {
  /** 元の回答 ID */
  sourceResponseId: string;
  /** 元の回答更新日時 */
  sourceUpdatedAt?: string;
  /** 値を入れたフィールドの一覧 */
  fieldsTouched: string[];
  /** 空のためスキップしたフィールドの一覧 */
  skippedFields: string[];
  /** 処理中の警告 */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Bridge Result
// ---------------------------------------------------------------------------

/**
 * 特性アンケートブリッジの出力。
 *
 * - `*Patches`: 確度 high/medium → 自動入力対象
 * - `candidates`: 確度 low → 候補提示のみ（ユーザー選択で確定）
 */
export interface TokuseiBridgeResult {
  /** NewPlanningSheetForm の FormState 向けパッチ */
  formPatches: Record<string, string>;
  /** PlanningIntake 向けパッチ */
  intakePatches: Partial<PlanningIntake>;
  /** PlanningAssessment 向けパッチ */
  assessmentPatches: Partial<PlanningAssessment>;

  /** 確度 low — 候補提示のみ */
  candidates: {
    targetBehaviors: TargetBehaviorCandidate[];
    hypotheses: BehaviorHypothesisCandidate[];
    abcEvents: AbcEventCandidate[];
  };

  /** 出典追跡 */
  provenance: TokuseiProvenanceEntry[];
  /** UI 向けサマリー */
  summary: TokuseiBridgeSummary;
  /** 監査向け詳細 */
  audit: TokuseiBridgeAudit;
}

// ---------------------------------------------------------------------------
// Reflection Policy Types
// ---------------------------------------------------------------------------

/**
 * フィールドへの反映ポリシー。
 *
 * - `empty-only`: 既存値が空の場合のみ上書き
 * - `append`: 既存値に追記（重複除去）
 * - `candidate`: 候補として提示のみ
 */
export type ReflectionPolicy = 'empty-only' | 'append' | 'candidate';

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * SpTokuseiRawRow（細分化データ）を TokuseiSourceNormalized に変換する。
 * 細分化データが利用可能なら、mapSpRowToTokuseiResponse を通さずこちらを使う。
 */
export function normalizeTokuseiFromRaw(row: SpTokuseiRawRow): TokuseiSourceNormalized {
  return {
    relationalDifficulties: s(row.RelationalDifficulties),
    situationalUnderstanding: s(row.SituationalUnderstanding),
    hearing: s(row.Hearing),
    vision: s(row.Vision),
    touch: s(row.Touch),
    smell: s(row.Smell),
    taste: s(row.Taste),
    sensoryMultiSelect: s(row.SensoryMultiSelect),
    sensoryFreeText: s(row.SensoryFreeText),
    difficultyWithChanges: s(row.DifficultyWithChanges),
    interestInParts: s(row.InterestInParts),
    repetitiveBehaviors: s(row.RepetitiveBehaviors),
    fixedHabits: s(row.FixedHabits),
    comprehensionDifficulty: s(row.ComprehensionDifficulty),
    expressionDifficulty: s(row.ExpressionDifficulty),
    interactionDifficulty: s(row.InteractionDifficulty),
    behaviorMultiSelect: s(row.BehaviorMultiSelect),
    behaviorEpisodes: s(row.BehaviorEpisodes),
    strengths: s(row.Strengths),
    notes: s(row.Notes),
  };
}

/**
 * TokuseiSurveyResponse（集約データ）を TokuseiSourceNormalized に変換する。
 * 集約文字列（personality, sensoryFeatures, behaviorFeatures）を再分解して
 * 細分化フィールドに分配する。情報量は細分化データより落ちる場合がある。
 */
export function normalizeTokuseiFromAggregated(
  response: TokuseiSurveyResponse,
): TokuseiSourceNormalized {
  // 集約文字列を再パースする
  const personalityEntries = parseAggregatedFeatures(response.personality);
  const sensoryEntries = parseAggregatedFeatures(response.sensoryFeatures);
  const behaviorEntries = parseAggregatedFeatures(response.behaviorFeatures);

  /** ラベルから値を引く（前方一致） */
  const findEntry = (entries: { label: string; content: string }[], label: string): string =>
    entries.find((e) => e.label === label)?.content ?? '';

  return {
    relationalDifficulties: findEntry(personalityEntries, '対人関係の難しさ'),
    situationalUnderstanding: findEntry(personalityEntries, '状況理解の難しさ'),
    hearing: findEntry(sensoryEntries, '聴覚'),
    vision: findEntry(sensoryEntries, '視覚'),
    touch: findEntry(sensoryEntries, '触覚'),
    smell: findEntry(sensoryEntries, '嗅覚'),
    taste: findEntry(sensoryEntries, '味覚'),
    sensoryMultiSelect: findEntry(sensoryEntries, '該当する感覚'),
    sensoryFreeText: findEntry(sensoryEntries, '感覚の詳細'),
    difficultyWithChanges: findEntry(behaviorEntries, '変化への対応困難'),
    interestInParts: findEntry(behaviorEntries, '物の一部への興味'),
    repetitiveBehaviors: findEntry(behaviorEntries, '繰り返し行動'),
    fixedHabits: findEntry(behaviorEntries, '習慣への固執'),
    comprehensionDifficulty: findEntry(behaviorEntries, '理解の困難'),
    expressionDifficulty: findEntry(behaviorEntries, '発信の困難'),
    interactionDifficulty: findEntry(behaviorEntries, 'やり取りの困難'),
    behaviorMultiSelect: findEntry(behaviorEntries, '該当する行動'),
    behaviorEpisodes: findEntry(behaviorEntries, '行動エピソード'),
    strengths: s(response.strengths),
    notes: s(response.notes),
  };
}

// ---------------------------------------------------------------------------
// Empty Normalized (default)
// ---------------------------------------------------------------------------

/** すべてのフィールドが空文字の正規化ソース */
export function emptyNormalized(): TokuseiSourceNormalized {
  return {
    relationalDifficulties: '',
    situationalUnderstanding: '',
    hearing: '',
    vision: '',
    touch: '',
    smell: '',
    taste: '',
    sensoryMultiSelect: '',
    sensoryFreeText: '',
    difficultyWithChanges: '',
    interestInParts: '',
    repetitiveBehaviors: '',
    fixedHabits: '',
    comprehensionDifficulty: '',
    expressionDifficulty: '',
    interactionDifficulty: '',
    behaviorMultiSelect: '',
    behaviorEpisodes: '',
    strengths: '',
    notes: '',
  };
}

// ---------------------------------------------------------------------------
// Empty Result
// ---------------------------------------------------------------------------

/** 空の変換結果 */
export function emptyBridgeResult(sourceResponseId = ''): TokuseiBridgeResult {
  return {
    formPatches: {},
    intakePatches: {},
    assessmentPatches: {},
    candidates: {
      targetBehaviors: [],
      hypotheses: [],
      abcEvents: [],
    },
    provenance: [],
    summary: {
      icebergFieldsFilled: 0,
      sensoryTriggersAdded: 0,
      hypothesesGenerated: 0,
      targetBehaviorCandidates: 0,
    },
    audit: {
      sourceResponseId,
      fieldsTouched: [],
      skippedFields: [],
      warnings: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Bridge Entry Point
// ---------------------------------------------------------------------------

/** ブリッジへの入力（raw / aggregated を自動判別） */
export type TokuseiBridgeInput =
  | { kind: 'raw'; row: SpTokuseiRawRow; responseId: string; updatedAt?: string }
  | { kind: 'aggregated'; response: TokuseiSurveyResponse; responseId: string; updatedAt?: string };

/**
 * 特性アンケート → 支援計画シート データブリッジ エントリ関数。
 *
 * 1. 入力を正規化
 * 2. signal extractors を実行
 * 3. builder 群を実行
 * 4. summary / provenance / audit を束ねて TokuseiBridgeResult を返す
 *
 * raw / aggregated の両経路をサポートする。
 */
export function tokuseiToPlanningBridge(input: TokuseiBridgeInput): TokuseiBridgeResult {
  // 1. 正規化
  const isAggregatedFallback = input.kind === 'aggregated';
  const normalized = input.kind === 'raw'
    ? normalizeTokuseiFromRaw(input.row)
    : normalizeTokuseiFromAggregated(input.response);

  // 全フィールド空チェック
  const allEmpty = (Object.values(normalized) as string[]).every((v) => !v);
  if (allEmpty) {
    return emptyBridgeResult(input.responseId);
  }

  // 2. signal extractors 実行
  const signals: ExtractedSignals = {
    sensory: extractSensorySignals(normalized),
    communication: extractCommunicationSignals(normalized),
    behavior: extractBehaviorSignals(normalized),
    changeRigidity: extractChangeRigiditySignals(normalized),
    medical: extractMedicalSignals(normalized),
  };

  // 3. builder 群実行
  const formPatches = buildFormPatches(normalized, signals);
  const intakePatches = buildIntakePatches(normalized, signals);
  const assessmentPatches = buildAssessmentPatches(normalized, signals);
  const candidates = buildCandidates(normalized, signals);

  // 4. 束ねる
  const provenance = buildProvenance(
    formPatches,
    intakePatches,
    assessmentPatches,
    candidates,
    input.responseId,
    TOKUSEI_FIELD_MAP,
  );

  const summary = summarizeTokuseiBridge(formPatches, intakePatches, candidates);

  const audit = buildAudit(
    input.responseId,
    input.updatedAt,
    normalized,
    formPatches,
    intakePatches,
    assessmentPatches,
    candidates,
    isAggregatedFallback,
  );

  return {
    formPatches,
    intakePatches,
    assessmentPatches,
    candidates,
    provenance,
    summary,
    audit,
  };
}
