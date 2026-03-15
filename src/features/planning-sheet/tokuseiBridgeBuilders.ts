/**
 * tokuseiBridgeBuilders.ts — 特性アンケート → 支援計画シート builder 群
 *
 * PR1 の signal extractors が返す「素材」を、
 * 支援計画シートの各セクションに適した patch / candidate / provenance に変換する。
 *
 * 設計原則:
 *  - 全関数が pure function（副作用なし）
 *  - low confidence は patch に入れず candidate 側に寄せる
 *  - 文字列結合は deterministic（安定順序）
 *  - 重複除去を徹底する
 *  - UI merge policy の実適用は行わない（audit/provenance で表現）
 *
 * @module
 */
import type { PlanningAssessment, PlanningIntake } from '@/domain/isp/schema';
import type { TOKUSEI_FIELD_MAP } from './tokuseiFieldMap';
import type {
  AbcEventCandidate,
  BehaviorHypothesisCandidate,
  BridgeConfidence,
  TargetBehaviorCandidate,
  TokuseiBridgeAudit,
  TokuseiBridgeResult,
  TokuseiBridgeSummary,
  TokuseiProvenanceEntry,
  TokuseiSourceNormalized,
} from './tokuseiToPlanningBridge';
import type {
  BehaviorSignal,
  ChangeRigiditySignal,
  CommunicationSignal,
  MedicalSignal,
  SensorySignal,
} from './tokuseiSignalExtractors';

// ═══════════════════════════════════════════════════════════════════════════
// Internal Types
// ═══════════════════════════════════════════════════════════════════════════

/** 全 signal を束ねた入力型 */
export interface ExtractedSignals {
  sensory: SensorySignal[];
  communication: CommunicationSignal[];
  behavior: BehaviorSignal | null;
  changeRigidity: ChangeRigiditySignal[];
  medical: MedicalSignal[];
}

/** TOKUSEI_FIELD_MAP の型参照用 */
type FieldMapType = typeof TOKUSEI_FIELD_MAP;

// ═══════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** 安定順序で重複除去した配列を返す */
const dedupe = (arr: string[]): string[] => [...new Set(arr)];

/** 空文字・undefined をフィルターする */
const nonEmpty = (arr: (string | undefined)[]): string[] =>
  arr.filter((v): v is string => !!v && v.trim().length > 0).map((v) => v.trim());

/** 安定順序で文字列を結合（改行区切り、空行なし） */
const joinLines = (lines: string[]): string =>
  dedupe(nonEmpty(lines)).join('\n');

/** 感覚レベルの日本語ラベル */
const LEVEL_LABEL: Record<string, string> = {
  hypersensitive: '過敏',
  hyposensitive: '鈍麻',
  typical: '標準',
};

/** 感覚の日本語名 */
const SENSE_LABEL: Record<string, string> = {
  hearing: '聴覚',
  vision: '視覚',
  touch: '触覚',
  smell: '嗅覚',
  taste: '味覚',
};

/** コミュニケーション種別の日本語名 */
const COMM_LABEL: Record<string, string> = {
  comprehension: '理解',
  expression: '表出',
  interaction: 'やり取り',
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. buildFormPatches
// ═══════════════════════════════════════════════════════════════════════════

/**
 * FormState (PlanningSheetFormValues) 向けのパッチを構築する。
 *
 * 出力は Record<string, string> 形式。
 * UI 側で empty-only / append を適用する。
 */
export function buildFormPatches(
  normalized: TokuseiSourceNormalized,
  signals: ExtractedSignals,
): Record<string, string> {
  const patches: Record<string, string> = {};

  // ── environmentFactors: 感覚過敏/鈍麻 ──
  const envFactorLines: string[] = [];
  for (const sig of signals.sensory) {
    const label = SENSE_LABEL[sig.sense] ?? sig.sense;
    const levelLabel = LEVEL_LABEL[sig.level] ?? '';
    if (levelLabel) {
      envFactorLines.push(`【${label}${levelLabel}】${sig.rawText}`);
    } else if (sig.rawText) {
      envFactorLines.push(`【${label}】${sig.rawText}`);
    }
  }
  const envFactors = joinLines(envFactorLines);
  if (envFactors) patches.environmentFactors = envFactors;

  // ── triggers: 変化困難・固執 ──
  const triggerLines: string[] = [];
  for (const sig of signals.changeRigidity) {
    if (sig.confidence !== 'low') {
      const prefix = sig.kind === 'change-difficulty' ? '【予定変更等】' : '【こだわり】';
      triggerLines.push(`${prefix}${sig.rawText}`);
    }
  }
  const triggers = joinLines(triggerLines);
  if (triggers) patches.triggers = triggers;

  // ── emotions: 対人関係の難しさ ──
  if (normalized.relationalDifficulties) {
    patches.emotions = `【対人関係】${normalized.relationalDifficulties}`;
  }

  // ── cognition: 状況理解 ──
  if (normalized.situationalUnderstanding) {
    patches.cognition = `【状況理解】${normalized.situationalUnderstanding}`;
  }

  // ── behaviorFunctionDetail: コミュニケーション困難 ──
  const bfdLines: string[] = [];
  for (const sig of signals.communication) {
    const kindLabel = COMM_LABEL[sig.kind] ?? sig.kind;
    bfdLines.push(`【${kindLabel}の困難】${sig.rawText}`);
  }
  const bfd = joinLines(bfdLines);
  if (bfd) patches.behaviorFunctionDetail = bfd;

  // ── environmentalAdjustment: 感覚対処法 + sensoryFreeText ──
  const adjLines: string[] = [];
  for (const sig of signals.sensory) {
    if (sig.copingStrategies.length > 0) {
      const label = SENSE_LABEL[sig.sense] ?? sig.sense;
      adjLines.push(`【${label}対処】${sig.copingStrategies.join('、')}`);
    }
  }
  if (normalized.sensoryFreeText) {
    adjLines.push(`【感覚詳細】${normalized.sensoryFreeText}`);
  }
  const adj = joinLines(adjLines);
  if (adj) patches.environmentalAdjustment = adj;

  // ── visualSupport: 繰り返し行動 → 見通し支援素材 ──
  const vsLines: string[] = [];
  for (const sig of signals.changeRigidity) {
    if (sig.kind === 'repetitive-behavior' && sig.rawText) {
      vsLines.push(`【繰り返し行動からの支援手がかり】${sig.rawText}`);
    }
  }
  const vs = joinLines(vsLines);
  if (vs) patches.visualSupport = vs;

  // ── reinforcementMethod: 得意なこと・強み + 物の一部への興味 ──
  const rmLines: string[] = [];
  if (normalized.strengths) {
    rmLines.push(`【得意なこと・強み】${normalized.strengths}`);
  }
  for (const sig of signals.changeRigidity) {
    if (sig.kind === 'interest-in-parts' && sig.rawText) {
      rmLines.push(`【興味の対象】${sig.rawText}`);
    }
  }
  const rm = joinLines(rmLines);
  if (rm) patches.reinforcementMethod = rm;

  // ── teamConsensusNote: notes ──
  if (normalized.notes) {
    patches.teamConsensusNote = `【特性アンケート特記事項】${normalized.notes}`;
  }

  return patches;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. buildIntakePatches
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PlanningIntake 向けのパッチを構築する。
 * append-first 前提。追加候補として自然な値にする。
 */
export function buildIntakePatches(
  _normalized: TokuseiSourceNormalized,
  signals: ExtractedSignals,
): Partial<PlanningIntake> {
  const patches: Partial<PlanningIntake> = {};

  // ── sensoryTriggers: 感覚過敏/鈍麻 ──
  const triggers: string[] = [];
  for (const sig of signals.sensory) {
    if (sig.level === 'hypersensitive' || sig.level === 'hyposensitive') {
      const label = SENSE_LABEL[sig.sense] ?? sig.sense;
      const levelLabel = LEVEL_LABEL[sig.level] ?? '';
      triggers.push(`${label}${levelLabel}`);
    }
  }
  if (triggers.length > 0) {
    patches.sensoryTriggers = dedupe(triggers);
  }

  // ── communicationModes: コミュニケーションモード ──
  const modes: string[] = [];
  for (const sig of signals.communication) {
    modes.push(...sig.inferredModes);
  }
  const deduped = dedupe(modes);
  if (deduped.length > 0) {
    patches.communicationModes = deduped;
  }

  // ── presentingProblem: 行動ラベル要約 ──
  if (signals.behavior && signals.behavior.labels.length > 0) {
    patches.presentingProblem =
      `【特性アンケート主訴】${dedupe(signals.behavior.labels).join('、')}`;
  }

  // ── medicalFlags: 医療キーワード ──
  const flags: string[] = [];
  for (const sig of signals.medical) {
    flags.push(sig.keyword);
  }
  if (flags.length > 0) {
    patches.medicalFlags = dedupe(flags);
  }

  return patches;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. buildAssessmentPatches
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PlanningAssessment 向けのパッチを構築する。
 *
 * 原則として多くは candidate に寄せ、ここは限定的。
 * 医療情報は高確度なので healthFactors に入れてよい。
 */
export function buildAssessmentPatches(
  _normalized: TokuseiSourceNormalized,
  signals: ExtractedSignals,
): Partial<PlanningAssessment> {
  const patches: Partial<PlanningAssessment> = {};

  // ── healthFactors: 医療キーワード（高確度） ──
  const healthFactors: string[] = [];
  for (const sig of signals.medical) {
    if (sig.confidence === 'high') {
      healthFactors.push(`${sig.keyword}（${sig.context}）`);
    }
  }
  if (healthFactors.length > 0) {
    patches.healthFactors = dedupe(healthFactors);
  }

  return patches;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. buildCandidates
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 確度 low / medium で解釈を伴う候補を構築する。
 * UI で明示選択して初めて確定するデータ。
 */
export function buildCandidates(
  _normalized: TokuseiSourceNormalized,
  signals: ExtractedSignals,
): TokuseiBridgeResult['candidates'] {
  const targetBehaviors: TargetBehaviorCandidate[] = [];
  const hypotheses: BehaviorHypothesisCandidate[] = [];
  const abcEvents: AbcEventCandidate[] = [];

  // ── targetBehaviors: 行動エピソード → 対象行動候補 ──
  if (signals.behavior) {
    const { labels, rawEpisode, operationalHints, confidence } = signals.behavior;

    for (const label of dedupe(labels)) {
      targetBehaviors.push({
        name: label,
        operationalDefinition: operationalHints.length > 0
          ? operationalHints[0]
          : '（操作的定義の補完が必要）',
        sourceText: rawEpisode ?? label,
        confidence,
      });
    }

    // エピソード自体が操作的定義のヒントになる
    if (rawEpisode && labels.length === 0) {
      targetBehaviors.push({
        name: '（行動エピソードからの候補）',
        operationalDefinition: operationalHints.join('。'),
        sourceText: rawEpisode,
        confidence: 'low',
      });
    }
  }

  // ── hypotheses: コミュニケーション困難 → 仮説候補 ──
  for (const sig of signals.communication) {
    const kindLabel = COMM_LABEL[sig.kind] ?? sig.kind;
    hypotheses.push({
      function: `コミュニケーション（${kindLabel}）の困難による要求・回避`,
      evidence: sig.rawText,
      sourceText: sig.rawText,
      confidence: sig.confidence,
    });
  }

  // ── hypotheses: 感覚回避 → 仮説候補 ──
  for (const sig of signals.sensory) {
    if (sig.level === 'hypersensitive') {
      const label = SENSE_LABEL[sig.sense] ?? sig.sense;
      hypotheses.push({
        function: `${label}過敏による感覚回避`,
        evidence: sig.rawText,
        sourceText: sig.rawText,
        confidence: sig.confidence,
      });
    }
  }

  // ── abcEvents: 変化困難 → ABC テンプレート候補 ──
  for (const sig of signals.changeRigidity) {
    if (sig.kind === 'change-difficulty') {
      abcEvents.push({
        antecedent: `予定変更・環境変化: ${sig.rawText}`,
        behavior: '（行動の特定が必要）',
        consequence: '（結果の観察が必要）',
        sourceText: sig.rawText,
        confidence: 'low',
      });
    }
  }

  // 重複除去（name ベース）
  const dedupeTargets = dedupeByKey(targetBehaviors, (c) => c.name);
  const dedupeHypotheses = dedupeByKey(hypotheses, (c) => c.function);
  const dedupeAbcEvents = dedupeByKey(abcEvents, (c) => c.antecedent);

  return {
    targetBehaviors: dedupeTargets,
    hypotheses: dedupeHypotheses,
    abcEvents: dedupeAbcEvents,
  };
}

/** キーで重複除去するヘルパー */
function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. buildProvenance
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 変換根拠の一覧を構築する。
 * touched field ごとに provenance entry を作る。
 */
export function buildProvenance(
  formPatches: Record<string, string>,
  intakePatches: Partial<PlanningIntake>,
  assessmentPatches: Partial<PlanningAssessment>,
  candidates: TokuseiBridgeResult['candidates'],
  sourceId: string,
  fieldMap: FieldMapType,
): TokuseiProvenanceEntry[] {
  const now = new Date().toISOString();
  const entries: TokuseiProvenanceEntry[] = [];

  // form patches
  for (const [field, value] of Object.entries(formPatches)) {
    entries.push({
      field: `formPatches.${field}`,
      source: 'tokusei_survey',
      sourceLabel: `特性アンケート`,
      reason: buildReason(field, fieldMap),
      value: truncate(value, 80),
      confidence: getConfidenceForField(field, fieldMap),
      importedAt: now,
    });
  }

  // intake patches
  for (const [field, value] of Object.entries(intakePatches)) {
    const display = Array.isArray(value) ? (value as string[]).join(', ') : String(value);
    entries.push({
      field: `intakePatches.${field}`,
      source: 'tokusei_survey',
      sourceLabel: `特性アンケート`,
      reason: `特性アンケートの回答から${field}を抽出`,
      value: truncate(display, 80),
      confidence: 'medium',
      importedAt: now,
    });
  }

  // assessment patches
  for (const [field, value] of Object.entries(assessmentPatches)) {
    const display = Array.isArray(value) ? (value as string[]).join(', ') : String(value);
    entries.push({
      field: `assessmentPatches.${field}`,
      source: 'tokusei_survey',
      sourceLabel: `特性アンケート`,
      reason: `特性アンケートの回答から${field}を抽出`,
      value: truncate(display, 80),
      confidence: 'high',
      importedAt: now,
    });
  }

  // candidate fields
  if (candidates.targetBehaviors.length > 0) {
    entries.push({
      field: 'candidates.targetBehaviors',
      source: 'tokusei_survey',
      sourceLabel: '特性アンケート',
      reason: '行動エピソード・選択肢から対象行動候補を生成',
      value: `${candidates.targetBehaviors.length}件の候補`,
      confidence: 'low',
      importedAt: now,
    });
  }
  if (candidates.hypotheses.length > 0) {
    entries.push({
      field: 'candidates.hypotheses',
      source: 'tokusei_survey',
      sourceLabel: '特性アンケート',
      reason: 'コミュニケーション困難・感覚回避から仮説候補を生成',
      value: `${candidates.hypotheses.length}件の候補`,
      confidence: 'low',
      importedAt: now,
    });
  }
  if (candidates.abcEvents.length > 0) {
    entries.push({
      field: 'candidates.abcEvents',
      source: 'tokusei_survey',
      sourceLabel: '特性アンケート',
      reason: '変化困難からABCテンプレート候補を生成',
      value: `${candidates.abcEvents.length}件の候補`,
      confidence: 'low',
      importedAt: now,
    });
  }

  return entries;
}

/** フィールド名から変換理由を構築 */
function buildReason(field: string, fieldMap: FieldMapType): string {
  // fieldMap のエントリから sourceLabel を探す
  for (const [, entry] of Object.entries(fieldMap)) {
    if (entry.target === field) {
      return `特性アンケート「${entry.sourceLabel}」から${field}へ転記`;
    }
  }
  return `特性アンケートの回答から${field}を抽出`;
}

/** フィールド名から confidence を取得 */
function getConfidenceForField(field: string, fieldMap: FieldMapType): BridgeConfidence {
  for (const [, entry] of Object.entries(fieldMap)) {
    if (entry.target === field) {
      return entry.confidence;
    }
  }
  return 'medium';
}

/** 文字列を指定長に切り詰める */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. summarizeTokuseiBridge
// ═══════════════════════════════════════════════════════════════════════════

/**
 * UI 表示用のサマリーを構築する。
 */
export function summarizeTokuseiBridge(
  formPatches: Record<string, string>,
  intakePatches: Partial<PlanningIntake>,
  candidates: TokuseiBridgeResult['candidates'],
): TokuseiBridgeSummary {
  // §3 氷山分析フィールド
  const icebergFields = [
    'environmentFactors',
    'triggers',
    'emotions',
    'cognition',
  ];
  const icebergFieldsFilled = icebergFields.filter((f) => f in formPatches).length;

  const sensoryTriggersAdded = intakePatches.sensoryTriggers?.length ?? 0;

  return {
    icebergFieldsFilled,
    sensoryTriggersAdded,
    hypothesesGenerated: candidates.hypotheses.length,
    targetBehaviorCandidates: candidates.targetBehaviors.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. buildAudit
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 監査・ログ用の詳細情報を構築する。
 */
export function buildAudit(
  sourceResponseId: string,
  sourceUpdatedAt: string | undefined,
  normalized: TokuseiSourceNormalized,
  formPatches: Record<string, string>,
  intakePatches: Partial<PlanningIntake>,
  assessmentPatches: Partial<PlanningAssessment>,
  candidates: TokuseiBridgeResult['candidates'],
  isAggregatedFallback: boolean,
): TokuseiBridgeAudit {
  const fieldsTouched = [
    ...Object.keys(formPatches).map((k) => `formPatches.${k}`),
    ...Object.keys(intakePatches).map((k) => `intakePatches.${k}`),
    ...Object.keys(assessmentPatches).map((k) => `assessmentPatches.${k}`),
  ];

  // スキップ判定: normalized で空だったフィールド
  const allFields = Object.keys(normalized) as (keyof TokuseiSourceNormalized)[];
  const skippedFields = allFields.filter((f) => !normalized[f]);

  const warnings: string[] = [];

  // 警告 1: aggregated fallback
  if (isAggregatedFallback) {
    warnings.push('集約データからの再分解のため、精度が限定的です');
  }

  // 警告 2: patch が空で候補のみ
  if (Object.keys(formPatches).length === 0 && Object.keys(intakePatches).length === 0) {
    if (
      candidates.targetBehaviors.length > 0 ||
      candidates.hypotheses.length > 0 ||
      candidates.abcEvents.length > 0
    ) {
      warnings.push('low confidence 候補のみで patch が空です');
    }
  }

  // 警告 3: 医療語検出あるが文脈不十分
  const medicalInAssessment = assessmentPatches.healthFactors ?? [];
  for (const hf of medicalInAssessment) {
    if (hf.length < 10) {
      warnings.push(`医療語は検出しましたが文脈が不十分: ${hf}`);
    }
  }

  // 警告 4: 行動エピソードあるが操作的定義未確定
  if (normalized.behaviorEpisodes && candidates.targetBehaviors.length > 0) {
    const hasUndefined = candidates.targetBehaviors.some(
      (c) => c.operationalDefinition.includes('操作的定義の補完'),
    );
    if (hasUndefined) {
      warnings.push('行動エピソードはありますが操作的定義は未確定です');
    }
  }

  return {
    sourceResponseId,
    sourceUpdatedAt,
    fieldsTouched,
    skippedFields: skippedFields.map(String),
    warnings,
  };
}
