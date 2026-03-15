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
