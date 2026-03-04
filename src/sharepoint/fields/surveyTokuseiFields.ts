/**
 * SharePoint フィールド定義 — FormsResponses_Tokusei (Survey)
 */

export const FIELD_MAP_SURVEY_TOKUSEI = {
  id: 'Id',
  responseId: 'ResponseId',
  responderEmail: 'ResponderEmail',
  responderName: 'ResponderName',
  fillDate: 'FillDate',
  targetUserName: 'TargetUserName',
  guardianName: 'GuardianName',
  relation: 'Relation',
  heightCm: 'HeightCm',
  weightKg: 'WeightKg',
  strengths: 'Strengths',
  notes: 'Notes',
  created: 'Created',

  // -- Forms メタ（SP 物理列あり） --
  formRowId: 'FormRowId',
  startTime: 'StartTime',
  endTime: 'EndTime',

  // -- 対人関係（SP 物理列あり） --
  relationalDifficulties: 'RelationalDifficulties',
  situationalUnderstanding: 'SituationalUnderstanding',

  // -- 感覚（5感別 — SP 物理列あり） --
  hearing: 'Hearing',
  vision: 'Vision',
  touch: 'Touch',
  smell: 'Smell',
  taste: 'Taste',
  sensoryMultiSelect: 'SensoryMultiSelect',
  sensoryFreeText: 'SensoryFreeText',

  // -- こだわり（SP 物理列あり） --
  difficultyWithChanges: 'DifficultyWithChanges',
  interestInParts: 'InterestInParts',
  repetitiveBehaviors: 'RepetitiveBehaviors',
  fixedHabits: 'FixedHabits',

  // -- コミュニケーション（SP 物理列あり） --
  comprehensionDifficulty: 'ComprehensionDifficulty',
  expressionDifficulty: 'ExpressionDifficulty',
  interactionDifficulty: 'InteractionDifficulty',

  // -- 行動（SP 物理列あり） --
  behaviorMultiSelect: 'BehaviorMultiSelect',
  behaviorEpisodes: 'BehaviorEpisodes',
} as const;

/**
 * Tokusei の派生フィールド（SP 物理列なし）
 *
 * ⚠️ OData $select には使用不可 — 400 エラーの原因になる。
 * Adapter 層 (mapSpRowToTokuseiResponse) が個別 SP 列から動的に合成する。
 */
export const FIELD_DERIVED_TOKUSEI = {
  personality: 'Personality',
  sensoryFeatures: 'SensoryFeatures',
  behaviorFeatures: 'BehaviorFeatures',
} as const;

/** FIELD_MAP_SURVEY_TOKUSEI（物理列）+ FIELD_DERIVED_TOKUSEI（派生列）の統合 */
export const FIELD_MAP_SURVEY_TOKUSEI_ALL = {
  ...FIELD_MAP_SURVEY_TOKUSEI,
  ...FIELD_DERIVED_TOKUSEI,
} as const;

// Exclude fields we know are missing based on 400 error cascade; allow others
export const SURVEY_TOKUSEI_SELECT_FIELDS: readonly string[] = Object.entries(FIELD_MAP_SURVEY_TOKUSEI)
  .filter(([key]) =>
    key !== 'responseId' &&
    key !== 'guardianName' &&
    key !== 'relation' &&
    key !== 'heightCm' &&
    key !== 'weightKg' &&
    key !== 'personality' &&
    key !== 'sensoryFeatures' &&
    key !== 'behaviorFeatures'
  )
  .map(([, value]) => value);

/**
 * 動的に "存在する列だけ" を select フィールドに含める
 * テナント列差分・列削除・列名変更に対応
 */
export async function buildSurveyTokuseiSelectFields(
  getFieldNames: () => Promise<Set<string>>
): Promise<string[]> {
  try {
    const availableFields = await getFieldNames();
    const availableLower = new Set(Array.from(availableFields).map((name) => name.toLowerCase()));
    const allCandidates = Object.values(FIELD_MAP_SURVEY_TOKUSEI);
    const selected = allCandidates.filter((fieldName) => fieldName === 'Id' || availableLower.has(fieldName.toLowerCase()));

    // 🔍 デバッグ出力：何が存在して何が除外されたか可視化
    console.debug('[TokuseiSelect] 📊 Fields API から取得した内部名（最初の50個）:', Array.from(availableFields).slice(0, 50));
    console.debug('[TokuseiSelect] 📋 FIELD_MAP から candidate（全数）:', allCandidates);
    console.debug('[TokuseiSelect] ✅ selected（存在する列）:', selected);
    console.debug('[TokuseiSelect] ❌ dropped（見つからない列）:', allCandidates.filter(x => !selected.includes(x)));

    return selected;
  } catch (error) {
    // Fallback: エラー時は既知フィールドの除外版を使う
    console.warn('[buildSurveyTokuseiSelectFields] Fields API 取得失敗、fallback を使用:', error);
    return Array.from(SURVEY_TOKUSEI_SELECT_FIELDS);
  }
}
