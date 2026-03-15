/**
 * tokuseiSignalExtractors.ts — 特性アンケート シグナル抽出レイヤー
 *
 * 正規化された TokuseiSourceNormalized から
 * 「解釈前の素材」を抽出する純関数群。
 *
 * 設計原則:
 *  - 抽出レイヤーは「signal を返す」に徹する
 *  - patch / candidate / provenance への変換は bridge 本体の責務
 *  - キーワード辞書ベースの軽量判定
 *
 * @module
 */
import type { BridgeConfidence, TokuseiSourceNormalized } from './tokuseiToPlanningBridge';

// ═══════════════════════════════════════════════════════════════════════════
// Signal Types
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// 1. Sensory Signal
// ---------------------------------------------------------------------------

/** 感覚の過敏 / 鈍麻レベル */
export type SensoryLevel = 'hypersensitive' | 'hyposensitive' | 'typical' | 'unknown';

/** 感覚種別 */
export type SenseKind = 'hearing' | 'vision' | 'touch' | 'smell' | 'taste';

/** 変換先候補 */
export type SensoryTarget = 'environmentFactors' | 'sensoryTriggers' | 'environmentalAdjustment';

/** 感覚シグナル */
export interface SensorySignal {
  sense: SenseKind;
  rawText: string;
  level: SensoryLevel;
  copingStrategies: string[];
  confidence: BridgeConfidence;
  suggestedTargets: SensoryTarget[];
}

// ---------------------------------------------------------------------------
// 2. Communication Signal
// ---------------------------------------------------------------------------

/** コミュニケーション種別 */
export type CommunicationKind = 'comprehension' | 'expression' | 'interaction';

/** 変換先候補 */
export type CommunicationTarget = 'communicationModes' | 'behaviorFunctionDetail' | 'hypotheses';

/** コミュニケーションシグナル */
export interface CommunicationSignal {
  kind: CommunicationKind;
  rawText: string;
  inferredModes: string[];
  confidence: BridgeConfidence;
  suggestedTargets: CommunicationTarget[];
}

// ---------------------------------------------------------------------------
// 3. Behavior Signal
// ---------------------------------------------------------------------------

/** 変換先候補 */
export type BehaviorTarget = 'targetBehavior' | 'presentingProblem' | 'targetBehaviors';

/** 行動シグナル */
export interface BehaviorSignal {
  rawEpisode?: string;
  labels: string[];
  operationalHints: string[];
  confidence: BridgeConfidence;
  suggestedTargets: BehaviorTarget[];
}

// ---------------------------------------------------------------------------
// 4. Change / Rigidity Signal
// ---------------------------------------------------------------------------

/** 変換先候補 */
export type ChangeRigidityTarget = 'triggers' | 'visualSupport' | 'environmentalAdjustment';

/** 変化・固執シグナル */
export interface ChangeRigiditySignal {
  kind: 'change-difficulty' | 'fixed-habit' | 'repetitive-behavior' | 'interest-in-parts';
  rawText: string;
  confidence: BridgeConfidence;
  suggestedTargets: ChangeRigidityTarget[];
}

// ---------------------------------------------------------------------------
// 5. Medical Signal
// ---------------------------------------------------------------------------

/** 医療シグナル */
export interface MedicalSignal {
  keyword: string;
  context: string;
  confidence: BridgeConfidence;
}

// ═══════════════════════════════════════════════════════════════════════════
// Keyword Dictionaries
// ═══════════════════════════════════════════════════════════════════════════

/** 過敏キーワード */
const HYPERSENSITIVE_KEYWORDS = [
  '苦手',
  '嫌',
  '怖い',
  '怖がる',
  'パニック',
  '叫ぶ',
  '泣く',
  '耐えられない',
  '辛い',
  '嫌がる',
  '逃げる',
  '拒否',
  '過敏',
  '着られない',
  'NG',
  '不快',
  '避ける',
  '混乱',
];

/** 鈍麻キーワード */
const HYPOSENSITIVE_KEYWORDS = [
  '気づかない',
  '鈍い',
  '反応しない',
  '感じにくい',
  '鈍麻',
  '気にならない',
  '気にしない',
  '無頓着',
  '低感度',
];

/** 対処法キーワード → 対処法ラベル */
const COPING_KEYWORDS: [keyword: string, label: string][] = [
  ['イヤーマフ', 'イヤーマフ'],
  ['耳栓', '耳栓'],
  ['ヘッドホン', 'ヘッドホン'],
  ['ヘッドフォン', 'ヘッドホン'],
  ['サングラス', 'サングラス'],
  ['マスク', 'マスク'],
  ['加圧ベスト', '加圧ベスト'],
  ['重いブランケット', '加重ブランケット'],
  ['加重ブランケット', '加重ブランケット'],
  ['タイマー', 'タイマー'],
  ['スケジュール', 'スケジュール表'],
  ['カード', 'コミュニケーションカード'],
  ['PECS', 'PECS'],
  ['シークエンスボード', 'シークエンスボード'],
];

/** コミュニケーションモード推論キーワード */
const COMMUNICATION_MODE_KEYWORDS: [keyword: string, mode: string][] = [
  ['絵カード', '視覚支援（絵カード）'],
  ['写真', '視覚支援（写真）'],
  ['指差し', 'ジェスチャー（指差し）'],
  ['ジェスチャー', 'ジェスチャー'],
  ['身振り', 'ジェスチャー'],
  ['サイン', 'サイン言語'],
  ['タブレット', 'AAC（タブレット）'],
  ['VOCA', 'AAC（VOCA）'],
  ['短い文', '簡潔な言語指示'],
  ['ゆっくり', 'ゆっくりした話し方'],
  ['視覚', '視覚的指示'],
  ['見て分かる', '視覚的指示'],
  ['実物', '実物提示'],
  ['手本', 'モデリング'],
  ['やって見せ', 'モデリング'],
  ['1対1', '1対1の環境'],
  ['個別', '1対1の環境'],
  ['声かけ', '個別声かけ'],
];

/** 医療フラグキーワード */
const MEDICAL_KEYWORDS = [
  'てんかん',
  '発作',
  '服薬',
  '薬',
  '通院',
  '医療機関',
  'アレルギー',
  '睡眠',
  '不眠',
  '食事制限',
  '吸引',
  '経管',
  '酸素',
  '透析',
  '人工',
  '喘息',
  '注射',
  'インスリン',
  '血糖',
  '褥瘡',
  '骨折',
  '手術',
];

// ═══════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** テキスト内にキーワードが含まれるか判定 */
const containsAny = (text: string, keywords: string[]): boolean =>
  keywords.some((kw) => text.includes(kw));

/** テキストから一致するキーワードを全て返す */
const findAll = (text: string, keywords: string[]): string[] =>
  keywords.filter((kw) => text.includes(kw));

/** テキストからマッチする (keyword, label) ペアを返す（重複除去） */
const findAllLabeled = (text: string, pairs: [string, string][]): string[] => {
  const labels = new Set<string>();
  for (const [kw, label] of pairs) {
    if (text.includes(kw)) {
      labels.add(label);
    }
  }
  return [...labels];
};

/** 感覚レベルを判定する */
const classifySensoryLevel = (text: string): SensoryLevel => {
  if (!text) return 'unknown';
  if (containsAny(text, HYPERSENSITIVE_KEYWORDS)) return 'hypersensitive';
  if (containsAny(text, HYPOSENSITIVE_KEYWORDS)) return 'hyposensitive';
  // テキストがあるが判定キーワードにヒットしない → typical ではなく unknown
  return 'unknown';
};

// ═══════════════════════════════════════════════════════════════════════════
// Extractor Functions
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// 1. extractSensorySignals
// ---------------------------------------------------------------------------

/**
 * 感覚フィールド（5感 + sensoryFreeText）からシグナルを抽出する。
 *
 * - 各感覚に記述がある場合、過敏 / 鈍麻 / unknown を判定
 * - 対処法キーワードを抽出
 * - sensoryMultiSelect, sensoryFreeText も補完的に使用
 */
export function extractSensorySignals(source: TokuseiSourceNormalized): SensorySignal[] {
  const senses: { kind: SenseKind; field: keyof TokuseiSourceNormalized }[] = [
    { kind: 'hearing', field: 'hearing' },
    { kind: 'vision', field: 'vision' },
    { kind: 'touch', field: 'touch' },
    { kind: 'smell', field: 'smell' },
    { kind: 'taste', field: 'taste' },
  ];

  const signals: SensorySignal[] = [];

  for (const { kind, field } of senses) {
    const rawText = source[field];
    if (!rawText) continue;

    // sensoryFreeText も併せて coping を探す
    const combinedTextForCoping = `${rawText} ${source.sensoryFreeText}`;

    const level = classifySensoryLevel(rawText);
    const copingStrategies = findAllLabeled(combinedTextForCoping, COPING_KEYWORDS);

    // 変換先候補の決定
    const suggestedTargets: SensoryTarget[] = ['environmentFactors'];
    if (level === 'hypersensitive' || level === 'hyposensitive') {
      suggestedTargets.push('sensoryTriggers');
    }
    if (copingStrategies.length > 0) {
      suggestedTargets.push('environmentalAdjustment');
    }

    signals.push({
      sense: kind,
      rawText,
      level,
      copingStrategies,
      confidence: level === 'unknown' ? 'medium' : 'high',
      suggestedTargets,
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// 2. extractCommunicationSignals
// ---------------------------------------------------------------------------

/**
 * コミュニケーション3領域から表現モード候補を推論する。
 *
 * - 理解困難 → 視覚支援 / ジェスチャー候補
 * - 表出困難 → AAC / カード候補
 * - やり取り困難 → 1対1環境 / モデリング候補
 *
 * 素材抽出に徹し、hypothesis は作らない。
 */
export function extractCommunicationSignals(
  source: TokuseiSourceNormalized,
): CommunicationSignal[] {
  const fields: { kind: CommunicationKind; field: keyof TokuseiSourceNormalized }[] = [
    { kind: 'comprehension', field: 'comprehensionDifficulty' },
    { kind: 'expression', field: 'expressionDifficulty' },
    { kind: 'interaction', field: 'interactionDifficulty' },
  ];

  const signals: CommunicationSignal[] = [];

  for (const { kind, field } of fields) {
    const rawText = source[field];
    if (!rawText) continue;

    const inferredModes = findAllLabeled(rawText, COMMUNICATION_MODE_KEYWORDS);

    // テキストはあるがモード候補が見つからない場合もシグナルは返す
    const suggestedTargets: CommunicationTarget[] = ['behaviorFunctionDetail'];
    if (inferredModes.length > 0) {
      suggestedTargets.push('communicationModes');
    }
    // コミュニケーション困難は仮説の素材にもなる
    suggestedTargets.push('hypotheses');

    signals.push({
      kind,
      rawText,
      inferredModes,
      confidence: inferredModes.length > 0 ? 'medium' : 'low',
      suggestedTargets,
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// 3. extractBehaviorSignals
// ---------------------------------------------------------------------------

/**
 * 行動関連フィールドから対象行動の素材を抽出する。
 *
 * - behaviorMultiSelect → ラベル一覧（カンマ / セミコロン区切り）
 * - behaviorEpisodes → 操作的定義のヒント
 *
 * まだ AssessedBehavior にはしない。
 */
export function extractBehaviorSignals(source: TokuseiSourceNormalized): BehaviorSignal | null {
  const labels = parseLabelList(source.behaviorMultiSelect);
  const episode = source.behaviorEpisodes || undefined;

  if (labels.length === 0 && !episode) return null;

  // エピソードから操作的定義のヒントを抽出
  const operationalHints: string[] = [];
  if (episode) {
    // 文を分割（句点、改行）して、それぞれをヒントとする
    const sentences = episode
      .split(/[。\n、]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3); // 短すぎるフラグメントは除外
    operationalHints.push(...sentences);
  }

  const suggestedTargets: BehaviorTarget[] = [];
  if (labels.length > 0) suggestedTargets.push('targetBehaviors');
  if (episode) suggestedTargets.push('targetBehavior', 'presentingProblem');

  return {
    rawEpisode: episode,
    labels: [...new Set(labels)], // 重複除去
    operationalHints,
    confidence: episode ? 'medium' : 'low',
    suggestedTargets,
  };
}

// ---------------------------------------------------------------------------
// 4. extractChangeRigiditySignals
// ---------------------------------------------------------------------------

/**
 * こだわり / 変化困難フィールドからシグナルを抽出する。
 *
 * 氷山分析の triggers、予防的支援の visualSupport に直結する。
 */
export function extractChangeRigiditySignals(
  source: TokuseiSourceNormalized,
): ChangeRigiditySignal[] {
  const fields: {
    kind: ChangeRigiditySignal['kind'];
    field: keyof TokuseiSourceNormalized;
    targets: ChangeRigidityTarget[];
    confidence: BridgeConfidence;
  }[] = [
    {
      kind: 'change-difficulty',
      field: 'difficultyWithChanges',
      targets: ['triggers', 'visualSupport'],
      confidence: 'high',
    },
    {
      kind: 'fixed-habit',
      field: 'fixedHabits',
      targets: ['triggers', 'environmentalAdjustment'],
      confidence: 'high',
    },
    {
      kind: 'repetitive-behavior',
      field: 'repetitiveBehaviors',
      targets: ['visualSupport', 'environmentalAdjustment'],
      confidence: 'medium',
    },
    {
      kind: 'interest-in-parts',
      field: 'interestInParts',
      targets: ['environmentalAdjustment'],
      confidence: 'medium',
    },
  ];

  const signals: ChangeRigiditySignal[] = [];

  for (const { kind, field, targets, confidence } of fields) {
    const rawText = source[field];
    if (!rawText) continue;

    signals.push({
      kind,
      rawText,
      confidence,
      suggestedTargets: targets,
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// 5. extractMedicalSignals
// ---------------------------------------------------------------------------

/**
 * Notes フィールドから医療関連キーワードを抽出する。
 *
 * 辞書ベースの軽量判定。
 * 一致キーワードとその前後の文脈を返す。
 */
export function extractMedicalSignals(source: TokuseiSourceNormalized): MedicalSignal[] {
  const text = source.notes;
  if (!text) return [];

  const matchedKeywords = findAll(text, MEDICAL_KEYWORDS);
  if (matchedKeywords.length === 0) return [];

  return matchedKeywords.map((keyword) => ({
    keyword,
    context: extractContextAroundKeyword(text, keyword),
    confidence: 'high' as BridgeConfidence,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Helpers (exported for testing)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * カンマ / セミコロン / 全角区切りのラベルリストをパースする。
 * 重複は除去しない（呼び出し側で制御）。
 */
export function parseLabelList(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[,;、；\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * テキスト中のキーワード前後の文脈を返す。
 * 句点区切りの文を基準にし、キーワードを含む文を返す。
 */
export function extractContextAroundKeyword(text: string, keyword: string): string {
  // 句点区切りで文を分割
  const sentences = text.split(/[。\n]/).map((s) => s.trim()).filter(Boolean);
  const matched = sentences.find((s) => s.includes(keyword));
  return matched ?? text;
}
