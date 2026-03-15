/**
 * tokuseiToPlanningBridge.spec.ts — P0: 型定義・正規化レイヤーのユニットテスト
 */
import { describe, expect, it } from 'vitest';
import type { SpTokuseiRawRow, TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import {
  emptyBridgeResult,
  emptyNormalized,
  normalizeTokuseiFromAggregated,
  normalizeTokuseiFromRaw,
} from '../tokuseiToPlanningBridge';
import { getFieldsByMinConfidence, getFieldsBySection, TOKUSEI_FIELD_MAP } from '../tokuseiFieldMap';

// ---------------------------------------------------------------------------
// normalizeTokuseiFromRaw
// ---------------------------------------------------------------------------

describe('normalizeTokuseiFromRaw', () => {
  it('should extract all fine-grained fields from SpTokuseiRawRow', () => {
    const row: SpTokuseiRawRow = {
      Id: 1,
      Hearing: '大きな音が苦手',
      Vision: '蛍光灯のちらつきが辛い',
      Touch: 'タグ付きの服が着られない',
      Smell: '',
      Taste: undefined,
      DifficultyWithChanges: '予定変更で泣いてしまう',
      RelationalDifficulties: '初対面で緊張が強い',
      SituationalUnderstanding: '言語指示だけでは理解しにくい',
      ComprehensionDifficulty: '複雑な指示は伝わりにくい',
      ExpressionDifficulty: '言葉で気持ちを伝えるのが難しい',
      InteractionDifficulty: '',
      BehaviorEpisodes: '休憩の終わりに離席を拒否',
      Strengths: '手先が器用',
      Notes: 'てんかんの既往あり',
    };

    const result = normalizeTokuseiFromRaw(row);

    expect(result.hearing).toBe('大きな音が苦手');
    expect(result.vision).toBe('蛍光灯のちらつきが辛い');
    expect(result.touch).toBe('タグ付きの服が着られない');
    expect(result.smell).toBe('');
    expect(result.taste).toBe('');
    expect(result.difficultyWithChanges).toBe('予定変更で泣いてしまう');
    expect(result.relationalDifficulties).toBe('初対面で緊張が強い');
    expect(result.situationalUnderstanding).toBe('言語指示だけでは理解しにくい');
    expect(result.comprehensionDifficulty).toBe('複雑な指示は伝わりにくい');
    expect(result.expressionDifficulty).toBe('言葉で気持ちを伝えるのが難しい');
    expect(result.interactionDifficulty).toBe('');
    expect(result.behaviorEpisodes).toBe('休憩の終わりに離席を拒否');
    expect(result.strengths).toBe('手先が器用');
    expect(result.notes).toBe('てんかんの既往あり');
  });

  it('should handle completely empty row', () => {
    const row: SpTokuseiRawRow = { Id: 99 };
    const result = normalizeTokuseiFromRaw(row);

    // 全フィールドが空文字列であること
    for (const value of Object.values(result)) {
      expect(value).toBe('');
    }
  });

  it('should trim whitespace from values', () => {
    const row: SpTokuseiRawRow = {
      Id: 1,
      Hearing: '  音が苦手  ',
      Notes: '\n特記事項\n',
    };
    const result = normalizeTokuseiFromRaw(row);
    expect(result.hearing).toBe('音が苦手');
    expect(result.notes).toBe('特記事項');
  });
});

// ---------------------------------------------------------------------------
// normalizeTokuseiFromAggregated
// ---------------------------------------------------------------------------

describe('normalizeTokuseiFromAggregated', () => {
  it('should re-decompose aggregated personality field', () => {
    const response: TokuseiSurveyResponse = {
      id: 1,
      responseId: 'TEST-001',
      responderName: 'テスト',
      fillDate: '2026-03-15',
      targetUserName: 'Aさん',
      createdAt: '2026-03-15',
      personality: '【対人関係の難しさ】初対面が苦手\n【状況理解の難しさ】言語指示だけでは分からない',
    };

    const result = normalizeTokuseiFromAggregated(response);

    expect(result.relationalDifficulties).toBe('初対面が苦手');
    expect(result.situationalUnderstanding).toBe('言語指示だけでは分からない');
  });

  it('should re-decompose aggregated sensoryFeatures field', () => {
    const response: TokuseiSurveyResponse = {
      id: 1,
      responseId: 'TEST-002',
      responderName: 'テスト',
      fillDate: '2026-03-15',
      targetUserName: 'Aさん',
      createdAt: '2026-03-15',
      sensoryFeatures: '【聴覚】大きな音が苦手\n【触覚】タグ付きの服NG',
    };

    const result = normalizeTokuseiFromAggregated(response);

    expect(result.hearing).toBe('大きな音が苦手');
    expect(result.touch).toBe('タグ付きの服NG');
    expect(result.vision).toBe('');
  });

  it('should re-decompose aggregated behaviorFeatures field', () => {
    const response: TokuseiSurveyResponse = {
      id: 1,
      responseId: 'TEST-003',
      responderName: 'テスト',
      fillDate: '2026-03-15',
      targetUserName: 'Aさん',
      createdAt: '2026-03-15',
      behaviorFeatures:
        '【変化への対応困難】予定変更で泣く\n【理解の困難】複雑な指示は伝わらない\n【行動エピソード】休憩終了時に離席拒否',
    };

    const result = normalizeTokuseiFromAggregated(response);

    expect(result.difficultyWithChanges).toBe('予定変更で泣く');
    expect(result.comprehensionDifficulty).toBe('複雑な指示は伝わらない');
    expect(result.behaviorEpisodes).toBe('休憩終了時に離席拒否');
  });

  it('should handle response with only strengths and notes', () => {
    const response: TokuseiSurveyResponse = {
      id: 1,
      responseId: 'TEST-004',
      responderName: 'テスト',
      fillDate: '2026-03-15',
      targetUserName: 'Aさん',
      createdAt: '2026-03-15',
      strengths: '手先が器用',
      notes: 'てんかんの既往あり',
    };

    const result = normalizeTokuseiFromAggregated(response);

    expect(result.strengths).toBe('手先が器用');
    expect(result.notes).toBe('てんかんの既往あり');
    // 集約フィールドが undefined の場合、分解結果は空
    expect(result.hearing).toBe('');
  });

  it('should handle completely empty response', () => {
    const response: TokuseiSurveyResponse = {
      id: 1,
      responseId: 'TEST-005',
      responderName: '',
      fillDate: '',
      targetUserName: '',
      createdAt: '',
    };

    const result = normalizeTokuseiFromAggregated(response);
    for (const value of Object.values(result)) {
      expect(value).toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// TOKUSEI_FIELD_MAP
// ---------------------------------------------------------------------------

describe('TOKUSEI_FIELD_MAP', () => {
  it('should have entries for all TokuseiSourceNormalized keys', () => {
    const normalizedKeys = Object.keys(emptyNormalized());
    const mapKeys = Object.keys(TOKUSEI_FIELD_MAP);

    expect(mapKeys.sort()).toEqual(normalizedKeys.sort());
  });

  it('should assign all sensory fields to iceberg section', () => {
    const sensoryFields = ['hearing', 'vision', 'touch', 'smell', 'taste'] as const;
    for (const field of sensoryFields) {
      expect(TOKUSEI_FIELD_MAP[field].section).toBe('iceberg');
      expect(TOKUSEI_FIELD_MAP[field].target).toBe('environmentFactors');
      expect(TOKUSEI_FIELD_MAP[field].confidence).toBe('high');
    }
  });

  it('should assign behaviorEpisodes as low confidence', () => {
    expect(TOKUSEI_FIELD_MAP.behaviorEpisodes.confidence).toBe('low');
  });

  it('should assign communication fields to fba section', () => {
    const commFields = ['comprehensionDifficulty', 'expressionDifficulty', 'interactionDifficulty'] as const;
    for (const field of commFields) {
      expect(TOKUSEI_FIELD_MAP[field].section).toBe('fba');
    }
  });
});

// ---------------------------------------------------------------------------
// getFieldsBySection / getFieldsByMinConfidence
// ---------------------------------------------------------------------------

describe('getFieldsBySection', () => {
  it('should return iceberg fields', () => {
    const icebergFields = getFieldsBySection('iceberg');
    expect(icebergFields).toContain('hearing');
    expect(icebergFields).toContain('difficultyWithChanges');
    expect(icebergFields).toContain('situationalUnderstanding');
    expect(icebergFields).not.toContain('strengths');
  });

  it('should return fba fields', () => {
    const fbaFields = getFieldsBySection('fba');
    expect(fbaFields).toContain('comprehensionDifficulty');
    expect(fbaFields).toContain('expressionDifficulty');
    expect(fbaFields).toContain('interactionDifficulty');
    expect(fbaFields).toHaveLength(3);
  });
});

describe('getFieldsByMinConfidence', () => {
  it('should include all fields for min=low', () => {
    const allFields = getFieldsByMinConfidence('low');
    const normalizedKeys = Object.keys(emptyNormalized());
    expect(allFields.length).toBe(normalizedKeys.length);
  });

  it('should exclude low-confidence fields for min=medium', () => {
    const mediumAndAbove = getFieldsByMinConfidence('medium');
    // behaviorEpisodes is low → should be excluded
    expect(mediumAndAbove).not.toContain('behaviorEpisodes');
  });

  it('should return only high-confidence fields for min=high', () => {
    const highOnly = getFieldsByMinConfidence('high');
    expect(highOnly).toContain('hearing');
    expect(highOnly).toContain('situationalUnderstanding');
    expect(highOnly).not.toContain('relationalDifficulties'); // medium
    expect(highOnly).not.toContain('behaviorEpisodes'); // low
  });
});

// ---------------------------------------------------------------------------
// emptyBridgeResult
// ---------------------------------------------------------------------------

describe('emptyBridgeResult', () => {
  it('should return all-empty result', () => {
    const result = emptyBridgeResult('TEST');
    expect(result.formPatches).toEqual({});
    expect(result.intakePatches).toEqual({});
    expect(result.assessmentPatches).toEqual({});
    expect(result.candidates.targetBehaviors).toEqual([]);
    expect(result.candidates.hypotheses).toEqual([]);
    expect(result.candidates.abcEvents).toEqual([]);
    expect(result.provenance).toEqual([]);
    expect(result.summary.icebergFieldsFilled).toBe(0);
    expect(result.audit.sourceResponseId).toBe('TEST');
    expect(result.audit.fieldsTouched).toEqual([]);
    expect(result.audit.skippedFields).toEqual([]);
    expect(result.audit.warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// emptyNormalized
// ---------------------------------------------------------------------------

describe('emptyNormalized', () => {
  it('should return object with all empty strings', () => {
    const result = emptyNormalized();
    const values = Object.values(result);
    expect(values.length).toBe(20);
    for (const v of values) {
      expect(v).toBe('');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PR2: Builder Functions & Entry Point Tests
// ═══════════════════════════════════════════════════════════════════════════

import {
  tokuseiToPlanningBridge,
} from '../tokuseiToPlanningBridge';
import type { TokuseiBridgeInput } from '../tokuseiToPlanningBridge';
import {
  buildAssessmentPatches,
  buildAudit,
  buildCandidates,
  buildFormPatches,
  buildIntakePatches,
  buildProvenance,
  summarizeTokuseiBridge,
} from '../tokuseiBridgeBuilders';
import type { ExtractedSignals } from '../tokuseiBridgeBuilders';
import {
  extractBehaviorSignals,
  extractChangeRigiditySignals,
  extractCommunicationSignals,
  extractMedicalSignals,
  extractSensorySignals,
} from '../tokuseiSignalExtractors';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

/** 全フィールドが埋まった raw row */
const RICH_RAW_ROW: SpTokuseiRawRow = {
  Id: 1,
  Hearing: '大きな音が苦手。イヤーマフを使用している',
  Vision: '蛍光灯のちらつきが辛い',
  Touch: 'タグ付きの服が着られない',
  Smell: '',
  Taste: '',
  SensoryMultiSelect: '聴覚,触覚',
  SensoryFreeText: '静かな環境を好む。サングラスも使用',
  DifficultyWithChanges: '予定変更で泣いてしまう',
  FixedHabits: '朝の準備は毎日同じ順番でないと混乱する',
  RepetitiveBehaviors: '手をひらひらさせる',
  InterestInParts: 'ミニカーのタイヤに注目する',
  RelationalDifficulties: '初対面で緊張が強い',
  SituationalUnderstanding: '言語指示だけでは理解しにくい',
  ComprehensionDifficulty: '複雑な指示は伝わりにくい。絵カードなら理解できる',
  ExpressionDifficulty: '言葉で気持ちを伝えるのが難しい。指差しで伝える',
  InteractionDifficulty: '1対1なら落ち着いて話せる',
  BehaviorMultiSelect: '自傷,他害,離席',
  BehaviorEpisodes: '休憩の終わりに離席を拒否して壁を叩く。スケジュール提示で落ち着く',
  Strengths: '手先が器用。パズルが得意',
  Notes: 'てんかんの既往あり。服薬中。アレルギー（卵）あり',
};

/** 全signal を一括抽出するヘルパー */
function extractAllSignals(normalized: ReturnType<typeof normalizeTokuseiFromRaw>): ExtractedSignals {
  return {
    sensory: extractSensorySignals(normalized),
    communication: extractCommunicationSignals(normalized),
    behavior: extractBehaviorSignals(normalized),
    changeRigidity: extractChangeRigiditySignals(normalized),
    medical: extractMedicalSignals(normalized),
  };
}

// ---------------------------------------------------------------------------
// tokuseiToPlanningBridge (entry function)
// ---------------------------------------------------------------------------

describe('tokuseiToPlanningBridge (entry function)', () => {
  it('should return empty result for all-empty input', () => {
    const input: TokuseiBridgeInput = {
      kind: 'raw',
      row: { Id: 99 },
      responseId: 'EMPTY-001',
    };
    const result = tokuseiToPlanningBridge(input);

    expect(result.formPatches).toEqual({});
    expect(result.intakePatches).toEqual({});
    expect(result.assessmentPatches).toEqual({});
    expect(result.candidates.targetBehaviors).toEqual([]);
    expect(result.candidates.hypotheses).toEqual([]);
    expect(result.candidates.abcEvents).toEqual([]);
    expect(result.summary.icebergFieldsFilled).toBe(0);
    expect(result.audit.sourceResponseId).toBe('EMPTY-001');
  });

  it('should process raw input and return full result', () => {
    const input: TokuseiBridgeInput = {
      kind: 'raw',
      row: RICH_RAW_ROW,
      responseId: 'RAW-001',
      updatedAt: '2026-03-15T00:00:00Z',
    };
    const result = tokuseiToPlanningBridge(input);

    // formPatches が入っている
    expect(Object.keys(result.formPatches).length).toBeGreaterThan(0);
    // intakePatches が入っている
    expect(Object.keys(result.intakePatches).length).toBeGreaterThan(0);
    // candidates が入っている
    expect(result.candidates.targetBehaviors.length).toBeGreaterThan(0);
    expect(result.candidates.hypotheses.length).toBeGreaterThan(0);
    // provenance が入っている
    expect(result.provenance.length).toBeGreaterThan(0);
    // summary が集計されている
    expect(result.summary.icebergFieldsFilled).toBeGreaterThan(0);
    // audit の sourceResponseId
    expect(result.audit.sourceResponseId).toBe('RAW-001');
    expect(result.audit.sourceUpdatedAt).toBe('2026-03-15T00:00:00Z');
    expect(result.audit.fieldsTouched.length).toBeGreaterThan(0);
  });

  it('should process aggregated input and include fallback warning', () => {
    const input: TokuseiBridgeInput = {
      kind: 'aggregated',
      response: {
        id: 1,
        responseId: 'AGG-001',
        responderName: 'テスト',
        fillDate: '2026-03-15',
        targetUserName: 'Aさん',
        createdAt: '2026-03-15',
        sensoryFeatures: '【聴覚】大きな音がパニックの原因',
        behaviorFeatures: '【変化への対応困難】予定変更で泣く',
        strengths: 'パズルが得意',
        notes: 'てんかんあり',
      },
      responseId: 'AGG-001',
    };
    const result = tokuseiToPlanningBridge(input);

    // aggregated fallback warning
    expect(result.audit.warnings).toContain('集約データからの再分解のため、精度が限定的です');
    // formPatches に何か入っている
    expect(Object.keys(result.formPatches).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// buildFormPatches
// ---------------------------------------------------------------------------

describe('buildFormPatches', () => {
  it('should map hearing hypersensitivity to environmentFactors', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      Hearing: '大きな音が苦手',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildFormPatches(normalized, signals);

    expect(patches.environmentFactors).toContain('聴覚');
    expect(patches.environmentFactors).toContain('過敏');
  });

  it('should map difficultyWithChanges to triggers', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      DifficultyWithChanges: '予定変更で泣いてしまう',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildFormPatches(normalized, signals);

    expect(patches.triggers).toContain('予定変更');
  });

  it('should map sensoryFreeText to environmentalAdjustment', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      Hearing: '音が苦手でイヤーマフ使用',
      SensoryFreeText: '静かな環境を好む',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildFormPatches(normalized, signals);

    expect(patches.environmentalAdjustment).toContain('感覚詳細');
    expect(patches.environmentalAdjustment).toContain('静かな環境');
  });

  it('should map notes to teamConsensusNote', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      Notes: '保護者の希望あり',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildFormPatches(normalized, signals);

    expect(patches.teamConsensusNote).toContain('保護者の希望');
  });

  it('should map strengths to reinforcementMethod', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      Strengths: '手先が器用',
      InterestInParts: 'ミニカーのタイヤ',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildFormPatches(normalized, signals);

    expect(patches.reinforcementMethod).toContain('得意なこと');
    expect(patches.reinforcementMethod).toContain('手先が器用');
    expect(patches.reinforcementMethod).toContain('興味の対象');
  });

  it('should return empty object for empty input', () => {
    const normalized = emptyNormalized();
    const signals = extractAllSignals(normalized);
    const patches = buildFormPatches(normalized, signals);

    expect(patches).toEqual({});
  });

  it('should map relationalDifficulties to emotions', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      RelationalDifficulties: '初対面で緊張が強い',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildFormPatches(normalized, signals);

    expect(patches.emotions).toContain('対人関係');
  });

  it('should map situationalUnderstanding to cognition', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      SituationalUnderstanding: '言語指示だけでは理解しにくい',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildFormPatches(normalized, signals);

    expect(patches.cognition).toContain('状況理解');
  });
});

// ---------------------------------------------------------------------------
// buildIntakePatches
// ---------------------------------------------------------------------------

describe('buildIntakePatches', () => {
  it('should extract sensoryTriggers from hypersensitivity', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      Hearing: '大きな音が苦手',
      Touch: 'タグ付きの服が着られない',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildIntakePatches(normalized, signals);

    expect(patches.sensoryTriggers).toContain('聴覚過敏');
    expect(patches.sensoryTriggers).toContain('触覚過敏');
  });

  it('should extract communicationModes from difficulties', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      ComprehensionDifficulty: '絵カードなら理解できる',
      ExpressionDifficulty: '指差しで伝える',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildIntakePatches(normalized, signals);

    expect(patches.communicationModes).toContain('視覚支援（絵カード）');
    expect(patches.communicationModes).toContain('ジェスチャー（指差し）');
  });

  it('should extract presentingProblem from behavior labels', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      BehaviorMultiSelect: '自傷,他害,離席',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildIntakePatches(normalized, signals);

    expect(patches.presentingProblem).toContain('自傷');
    expect(patches.presentingProblem).toContain('他害');
    expect(patches.presentingProblem).toContain('離席');
  });

  it('should extract medicalFlags from medical keywords', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      Notes: 'てんかんの既往あり。服薬中。アレルギーあり',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildIntakePatches(normalized, signals);

    expect(patches.medicalFlags).toContain('てんかん');
    expect(patches.medicalFlags).toContain('服薬');
    expect(patches.medicalFlags).toContain('アレルギー');
  });

  it('should deduplicate communicationModes', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      ComprehensionDifficulty: '絵カードの提示',
      ExpressionDifficulty: '絵カードで選ぶ',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildIntakePatches(normalized, signals);

    const count = patches.communicationModes?.filter((m) => m === '視覚支援（絵カード）').length;
    expect(count).toBe(1);
  });

  it('should return empty for empty signals', () => {
    const normalized = emptyNormalized();
    const signals = extractAllSignals(normalized);
    const patches = buildIntakePatches(normalized, signals);

    expect(Object.keys(patches)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildAssessmentPatches
// ---------------------------------------------------------------------------

describe('buildAssessmentPatches', () => {
  it('should extract healthFactors from medical signals', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      Notes: 'てんかんの既往あり。アレルギー（卵）あり',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildAssessmentPatches(normalized, signals);

    expect(patches.healthFactors).toBeDefined();
    expect(patches.healthFactors!.length).toBeGreaterThan(0);
    expect(patches.healthFactors!.some((f) => f.includes('てんかん'))).toBe(true);
  });

  it('should return empty for no medical signals', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      Hearing: '大きな音が苦手',
    });
    const signals = extractAllSignals(normalized);
    const patches = buildAssessmentPatches(normalized, signals);

    expect(Object.keys(patches)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildCandidates
// ---------------------------------------------------------------------------

describe('buildCandidates', () => {
  it('should generate targetBehavior candidates from behavior episode', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      BehaviorMultiSelect: '自傷,他害',
      BehaviorEpisodes: '休憩の終わりに壁を叩く。原因はスケジュール変更',
    });
    const signals = extractAllSignals(normalized);
    const candidates = buildCandidates(normalized, signals);

    expect(candidates.targetBehaviors.length).toBeGreaterThan(0);
    expect(candidates.targetBehaviors.some((c) => c.name === '自傷')).toBe(true);
    expect(candidates.targetBehaviors.some((c) => c.name === '他害')).toBe(true);
  });

  it('should generate hypotheses from communication difficulty', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      ComprehensionDifficulty: '複雑な指示は伝わりにくい',
    });
    const signals = extractAllSignals(normalized);
    const candidates = buildCandidates(normalized, signals);

    expect(candidates.hypotheses.length).toBeGreaterThan(0);
    expect(candidates.hypotheses.some((h) => h.function.includes('コミュニケーション'))).toBe(true);
  });

  it('should generate hypotheses from sensory avoidance', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      Hearing: '大きな音が苦手でパニックになる',
    });
    const signals = extractAllSignals(normalized);
    const candidates = buildCandidates(normalized, signals);

    expect(candidates.hypotheses.some((h) => h.function.includes('聴覚過敏'))).toBe(true);
  });

  it('should generate abcEvent candidates from change difficulty', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      DifficultyWithChanges: '予定変更で泣いてしまう',
    });
    const signals = extractAllSignals(normalized);
    const candidates = buildCandidates(normalized, signals);

    expect(candidates.abcEvents.length).toBeGreaterThan(0);
    expect(candidates.abcEvents[0].antecedent).toContain('予定変更');
    expect(candidates.abcEvents[0].confidence).toBe('low');
  });

  it('should not include low confidence in patches', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      BehaviorEpisodes: '壁を叩く',
    });
    const signals = extractAllSignals(normalized);

    // form patches should NOT include behavior episodes (low confidence)
    const formPatches = buildFormPatches(normalized, signals);
    expect(formPatches).not.toHaveProperty('targetBehavior');
    expect(formPatches).not.toHaveProperty('targetBehaviors');

    // but candidates should have it
    const candidates = buildCandidates(normalized, signals);
    expect(candidates.targetBehaviors.length).toBeGreaterThan(0);
  });

  it('should deduplicate candidates', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      BehaviorMultiSelect: '自傷,自傷,他害',
    });
    const signals = extractAllSignals(normalized);
    const candidates = buildCandidates(normalized, signals);

    const selfInjury = candidates.targetBehaviors.filter((c) => c.name === '自傷');
    expect(selfInjury.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildProvenance
// ---------------------------------------------------------------------------

describe('buildProvenance', () => {
  it('should create provenance entries for touched fields', () => {
    const normalized = normalizeTokuseiFromRaw(RICH_RAW_ROW);
    const signals = extractAllSignals(normalized);
    const formPatches = buildFormPatches(normalized, signals);
    const intakePatches = buildIntakePatches(normalized, signals);
    const assessmentPatches = buildAssessmentPatches(normalized, signals);
    const candidates = buildCandidates(normalized, signals);

    const provenance = buildProvenance(
      formPatches,
      intakePatches,
      assessmentPatches,
      candidates,
      'TEST-001',
      TOKUSEI_FIELD_MAP,
    );

    expect(provenance.length).toBeGreaterThan(0);
    // All entries should have tokusei_survey source
    for (const entry of provenance) {
      expect(entry.source).toBe('tokusei_survey');
    }
    // formPatches keys should appear in provenance
    const formFieldNames = provenance
      .filter((p) => p.field.startsWith('formPatches.'))
      .map((p) => p.field.replace('formPatches.', ''));
    expect(formFieldNames).toContain('environmentFactors');
  });

  it('should include candidate provenance when candidates exist', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      BehaviorMultiSelect: '自傷',
      BehaviorEpisodes: '壁を叩く',
    });
    const signals = extractAllSignals(normalized);
    const candidates = buildCandidates(normalized, signals);
    const provenance = buildProvenance({}, {}, {}, candidates, 'TEST', TOKUSEI_FIELD_MAP);

    expect(provenance.some((p) => p.field === 'candidates.targetBehaviors')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// summarizeTokuseiBridge
// ---------------------------------------------------------------------------

describe('summarizeTokuseiBridge', () => {
  it('should count iceberg fields correctly', () => {
    const formPatches = {
      environmentFactors: 'test',
      triggers: 'test',
      emotions: 'test',
    };
    const intakePatches = { sensoryTriggers: ['聴覚過敏'] };
    const candidates = { targetBehaviors: [{ name: 'a', operationalDefinition: '', sourceText: '', confidence: 'low' as const }], hypotheses: [], abcEvents: [] };

    const summary = summarizeTokuseiBridge(formPatches, intakePatches, candidates);

    expect(summary.icebergFieldsFilled).toBe(3);
    expect(summary.sensoryTriggersAdded).toBe(1);
    expect(summary.targetBehaviorCandidates).toBe(1);
    expect(summary.hypothesesGenerated).toBe(0);
  });

  it('should return zeros for empty patches', () => {
    const summary = summarizeTokuseiBridge({}, {}, { targetBehaviors: [], hypotheses: [], abcEvents: [] });

    expect(summary.icebergFieldsFilled).toBe(0);
    expect(summary.sensoryTriggersAdded).toBe(0);
    expect(summary.hypothesesGenerated).toBe(0);
    expect(summary.targetBehaviorCandidates).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildAudit
// ---------------------------------------------------------------------------

describe('buildAudit', () => {
  it('should include aggregated fallback warning', () => {
    const normalized = emptyNormalized();
    const audit = buildAudit(
      'TEST', undefined, normalized, {}, {}, {},
      { targetBehaviors: [], hypotheses: [], abcEvents: [] },
      true,
    );

    expect(audit.warnings).toContain('集約データからの再分解のため、精度が限定的です');
  });

  it('should include warning when only low confidence candidates exist', () => {
    const normalized = emptyNormalized();
    const audit = buildAudit(
      'TEST', undefined, normalized, {}, {}, {},
      {
        targetBehaviors: [{ name: 'a', operationalDefinition: '', sourceText: '', confidence: 'low' }],
        hypotheses: [],
        abcEvents: [],
      },
      false,
    );

    expect(audit.warnings).toContain('low confidence 候補のみで patch が空です');
  });

  it('should track touched fields', () => {
    const normalized = normalizeTokuseiFromRaw(RICH_RAW_ROW);
    const signals = extractAllSignals(normalized);
    const formPatches = buildFormPatches(normalized, signals);
    const intakePatches = buildIntakePatches(normalized, signals);
    const assessmentPatches = buildAssessmentPatches(normalized, signals);
    const candidates = buildCandidates(normalized, signals);

    const audit = buildAudit(
      'RAW-001', '2026-03-15',
      normalized,
      formPatches,
      intakePatches,
      assessmentPatches,
      candidates,
      false,
    );

    expect(audit.sourceResponseId).toBe('RAW-001');
    expect(audit.fieldsTouched.length).toBeGreaterThan(0);
    expect(audit.fieldsTouched.some((f) => f.startsWith('formPatches.'))).toBe(true);
    expect(audit.fieldsTouched.some((f) => f.startsWith('intakePatches.'))).toBe(true);
  });

  it('should track skipped (empty) fields', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      Hearing: '音が苦手',
      // 他は全部空
    });
    const audit = buildAudit(
      'TEST', undefined, normalized, {}, {}, {},
      { targetBehaviors: [], hypotheses: [], abcEvents: [] },
      false,
    );

    // smell, taste, etc. should be skipped
    expect(audit.skippedFields.length).toBeGreaterThan(0);
    expect(audit.skippedFields).toContain('smell');
    expect(audit.skippedFields).toContain('taste');
    expect(audit.skippedFields).not.toContain('hearing');
  });

  it('should include operational definition warning', () => {
    const normalized = normalizeTokuseiFromRaw({
      Id: 1,
      BehaviorMultiSelect: '自傷',
      BehaviorEpisodes: '叩く',
    });
    const signals = extractAllSignals(normalized);
    const candidates = buildCandidates(normalized, signals);

    const audit = buildAudit(
      'TEST', undefined, normalized, {}, {}, {}, candidates, false,
    );

    expect(audit.warnings.some((w) => w.includes('操作的定義は未確定'))).toBe(true);
  });
});

