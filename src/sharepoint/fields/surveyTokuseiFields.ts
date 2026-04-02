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
 * FormsResponses_Tokusei (特性アンケート) のドリフト耐性定義
 */
export const SURVEY_TOKUSEI_CANDIDATES = {
  responseId: ['ResponseId', 'Response_x0020_Id'],
  responderEmail: ['ResponderEmail', 'Responder_x0020_Email'],
  responderName: ['ResponderName', 'Responder_x0020_Name'],
  fillDate: ['FillDate', 'Fill_x0020_Date'],
  targetUserName: ['TargetUserName', 'Target_x0020_User_x0020_Name'],
  guardianName: ['GuardianName', 'Guardian_x0020_Name'],
  relation: ['Relation', 'Relation_x0020_to_x0020_User'],
  heightCm: ['HeightCm', 'Height_x0020_cm'],
  weightKg: ['WeightKg', 'Weight_x0020_kg'],
  strengths: ['Strengths', 'UserStrengths'],
  notes: ['Notes', 'General_x0020_Notes'],
  formRowId: ['FormRowId', 'Form_x0020_Row_x0020_Id'],
  startTime: ['StartTime', 'Start_x0020_Time'],
  endTime: ['EndTime', 'End_x0020_Time'],
  relationalDifficulties: ['RelationalDifficulties', 'Relational_x0020_Difficulties'],
  situationalUnderstanding: ['SituationalUnderstanding', 'Situational_x0020_Understanding'],
  hearing: ['Hearing', 'Sensory_x0020_Hearing'],
  vision: ['Vision', 'Sensory_x0020_Vision'],
  touch: ['Touch', 'Sensory_x0020_Touch'],
  smell: ['Smell', 'Sensory_x0020_Smell'],
  taste: ['Taste', 'Sensory_x0020_Taste'],
  sensoryMultiSelect: ['SensoryMultiSelect', 'Sensory_x0020_Multiple'],
  sensoryFreeText: ['SensoryFreeText', 'Sensory_x0020_Notes'],
  difficultyWithChanges: ['DifficultyWithChanges', 'Change_x0020_Difficulties'],
  interestInParts: ['InterestInParts', 'Part_x0020_Interests'],
  repetitiveBehaviors: ['RepetitiveBehaviors', 'Repetitive_x0020_Actions'],
  fixedHabits: ['FixedHabits', 'Fixed_x0020_Routines'],
  comprehensionDifficulty: ['ComprehensionDifficulty', 'Comprehension_x0020_Issues'],
  expressionDifficulty: ['ExpressionDifficulty', 'Expression_x0020_Issues'],
  interactionDifficulty: ['InteractionDifficulty', 'Interaction_x0020_Issues'],
  behaviorMultiSelect: ['BehaviorMultiSelect', 'Behavior_x0020_Multiple'],
  behaviorEpisodes: ['BehaviorEpisodes', 'Behavior_x0020_Details'],
} as const;

export const SURVEY_TOKUSEI_ESSENTIALS: (keyof typeof SURVEY_TOKUSEI_CANDIDATES)[] = [
  'responderName',
];



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

import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';

/**
 * 動的に "存在する列だけ" を select フィールドに含める
 * テナント列差分・列削除・列名変更（Drift）に対応
 */
export async function resolveSurveyTokuseiFields(
  getFieldNames: () => Promise<Set<string>>
): Promise<{ 
  select: string[]; 
  mapping: Record<string, string | undefined>;
  fieldStatus: Record<string, { resolvedName?: string; candidates: string[]; isDrifted: boolean }>;
}> {
  try {
    const availableFields = await getFieldNames();
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(
      availableFields,
      SURVEY_TOKUSEI_CANDIDATES as unknown as Record<string, string[]>
    );

    const mapping = resolved as Record<string, string | undefined>;
    const select = [
      'Id', 
      'Created',
      ...Object.values(mapping).filter((v): v is string => !!v)
    ].filter((v, i, a) => a.indexOf(v) === i);

    return { select, mapping, fieldStatus };
  } catch (error) {
    console.warn('[resolveSurveyTokuseiFields] Fields API 取得失敗、fallback を使用:', error);
    return {
      select: Array.from(SURVEY_TOKUSEI_SELECT_FIELDS),
      mapping: FIELD_MAP_SURVEY_TOKUSEI,
      fieldStatus: {},
    };
  }
}
