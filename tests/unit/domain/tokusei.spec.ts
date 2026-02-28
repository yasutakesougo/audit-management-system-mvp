import { mapSpRowToTokuseiResponse, parseAggregatedFeatures, parseNumeric, type SpTokuseiRawRow } from '@/domain/assessment/tokusei';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// parseAggregatedFeatures
// ---------------------------------------------------------------------------

describe('parseAggregatedFeatures', () => {
  it('parses labeled lines into entries', () => {
    const input = '【聴覚】大きな音が苦手\n【視覚】蛍光灯のちらつきが気になる';
    const result = parseAggregatedFeatures(input);
    expect(result).toEqual([
      { label: '聴覚', content: '大きな音が苦手' },
      { label: '視覚', content: '蛍光灯のちらつきが気になる' },
    ]);
  });

  it('returns empty array for undefined/empty', () => {
    expect(parseAggregatedFeatures(undefined)).toEqual([]);
    expect(parseAggregatedFeatures('')).toEqual([]);
  });

  it('handles unlabeled lines with fallback label', () => {
    const result = parseAggregatedFeatures('ラベルなしの行');
    expect(result).toEqual([{ label: '情報', content: 'ラベルなしの行' }]);
  });

  it('trims whitespace and skips blank lines', () => {
    const input = '  【聴覚】 テスト \n\n  【視覚】 テスト2  \n   ';
    const result = parseAggregatedFeatures(input);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('テスト');
    expect(result[1].content).toBe('テスト2');
  });

  it('handles single entry', () => {
    const result = parseAggregatedFeatures('【対人関係の難しさ】初対面で緊張が強い');
    expect(result).toEqual([{ label: '対人関係の難しさ', content: '初対面で緊張が強い' }]);
  });
});

// ---------------------------------------------------------------------------
// parseNumeric
// ---------------------------------------------------------------------------

describe('parseNumeric', () => {
  it('returns number for finite number input', () => {
    expect(parseNumeric(42)).toBe(42);
    expect(parseNumeric(0)).toBe(0);
    expect(parseNumeric(-3.5)).toBe(-3.5);
  });

  it('returns null for NaN / Infinity', () => {
    expect(parseNumeric(NaN)).toBeNull();
    expect(parseNumeric(Infinity)).toBeNull();
  });

  it('parses numeric strings', () => {
    expect(parseNumeric('148')).toBe(148);
    expect(parseNumeric('  52.3kg ')).toBeCloseTo(52.3);
  });

  it('returns null for empty / non-numeric strings', () => {
    expect(parseNumeric('')).toBeNull();
    expect(parseNumeric('abc')).toBeNull();
  });

  it('returns null for null / undefined', () => {
    expect(parseNumeric(null)).toBeNull();
    expect(parseNumeric(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapSpRowToTokuseiResponse — basic fields
// ---------------------------------------------------------------------------

describe('mapSpRowToTokuseiResponse', () => {
  const minimalRow: SpTokuseiRawRow = {
    Id: 1,
    ResponderName: ' 山田花子 ',
    FillDate: '2026-01-15T10:00:00Z',
    TargetUserName: 'Aさん',
    Created: '2026-01-15T09:00:00Z',
  };

  it('maps basic fields with trimming', () => {
    const result = mapSpRowToTokuseiResponse(minimalRow);
    expect(result.id).toBe(1);
    expect(result.responderName).toBe('山田花子');
    expect(result.fillDate).toBe('2026-01-15T10:00:00Z');
    expect(result.targetUserName).toBe('Aさん');
    expect(result.createdAt).toBe('2026-01-15T09:00:00Z');
  });

  it('falls back to Created when FillDate is missing', () => {
    const row: SpTokuseiRawRow = { ...minimalRow, FillDate: undefined };
    const result = mapSpRowToTokuseiResponse(row);
    expect(result.fillDate).toBe('2026-01-15T09:00:00Z');
  });

  it('returns 0 for invalid Id', () => {
    const row: SpTokuseiRawRow = { ...minimalRow, Id: NaN as unknown as number };
    expect(mapSpRowToTokuseiResponse(row).id).toBe(0);
  });

  it('passes through optional basic fields', () => {
    const row: SpTokuseiRawRow = {
      ...minimalRow,
      ResponseId: 'RES-001',
      GuardianName: '山田太郎',
      Relation: '母',
      HeightCm: 148,
      WeightKg: '42.5kg',
      Strengths: 'ビーズ作り',
      Notes: '特になし',
    };
    const result = mapSpRowToTokuseiResponse(row);
    expect(result.responseId).toBe('RES-001');
    expect(result.guardianName).toBe('山田太郎');
    expect(result.relation).toBe('母');
    expect(result.heightCm).toBe(148);
    expect(result.weightKg).toBeCloseTo(42.5);
    expect(result.strengths).toBe('ビーズ作り');
    expect(result.notes).toBe('特になし');
  });

  it('returns undefined for empty/missing optional strings', () => {
    const result = mapSpRowToTokuseiResponse(minimalRow);
    expect(result.responderEmail).toBeUndefined();
    expect(result.guardianName).toBeUndefined();
    expect(result.relation).toBeUndefined();
    expect(result.strengths).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// mapSpRowToTokuseiResponse — aggregation: sensoryFeatures
// ---------------------------------------------------------------------------

describe('mapSpRowToTokuseiResponse — sensoryFeatures aggregation', () => {
  const baseRow: SpTokuseiRawRow = {
    Id: 10,
    TargetUserName: 'テスト',
    Created: '2026-01-01T00:00:00Z',
  };

  it('aggregates 5 sense columns with labels', () => {
    const row: SpTokuseiRawRow = {
      ...baseRow,
      Hearing: '大きな音が苦手',
      Vision: '蛍光灯のちらつきが気になる',
      Touch: '',
      Smell: undefined,
      Taste: '偏食あり',
    };
    const result = mapSpRowToTokuseiResponse(row);
    expect(result.sensoryFeatures).toContain('【聴覚】大きな音が苦手');
    expect(result.sensoryFeatures).toContain('【視覚】蛍光灯のちらつきが気になる');
    expect(result.sensoryFeatures).toContain('【味覚】偏食あり');
    // Empty/undefined fields should be excluded
    expect(result.sensoryFeatures).not.toContain('【触覚】');
    expect(result.sensoryFeatures).not.toContain('【嗅覚】');
  });

  it('includes SensoryMultiSelect and SensoryFreeText', () => {
    const row: SpTokuseiRawRow = {
      ...baseRow,
      SensoryMultiSelect: '聴覚過敏;触覚過敏',
      SensoryFreeText: 'イヤーマフで落ち着ける',
    };
    const result = mapSpRowToTokuseiResponse(row);
    expect(result.sensoryFeatures).toContain('【該当する感覚】聴覚過敏;触覚過敏');
    expect(result.sensoryFeatures).toContain('【感覚の詳細】イヤーマフで落ち着ける');
  });

  it('returns undefined when all sensory columns are empty', () => {
    const result = mapSpRowToTokuseiResponse(baseRow);
    expect(result.sensoryFeatures).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// mapSpRowToTokuseiResponse — aggregation: personality
// ---------------------------------------------------------------------------

describe('mapSpRowToTokuseiResponse — personality aggregation', () => {
  const baseRow: SpTokuseiRawRow = {
    Id: 20,
    TargetUserName: 'テスト',
    Created: '2026-01-01T00:00:00Z',
  };

  it('aggregates relational + situational columns', () => {
    const row: SpTokuseiRawRow = {
      ...baseRow,
      RelationalDifficulties: '初対面で緊張が強い',
      SituationalUnderstanding: '暗黙のルールが分かりにくい',
    };
    const result = mapSpRowToTokuseiResponse(row);
    expect(result.personality).toContain('【対人関係の難しさ】初対面で緊張が強い');
    expect(result.personality).toContain('【状況理解の難しさ】暗黙のルールが分かりにくい');
  });

  it('returns undefined when both columns are empty', () => {
    const result = mapSpRowToTokuseiResponse(baseRow);
    expect(result.personality).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// mapSpRowToTokuseiResponse — aggregation: behaviorFeatures
// ---------------------------------------------------------------------------

describe('mapSpRowToTokuseiResponse — behaviorFeatures aggregation', () => {
  const baseRow: SpTokuseiRawRow = {
    Id: 30,
    TargetUserName: 'テスト',
    Created: '2026-01-01T00:00:00Z',
  };

  it('aggregates fixation + communication + behavior columns', () => {
    const row: SpTokuseiRawRow = {
      ...baseRow,
      DifficultyWithChanges: '予定変更でパニック',
      RepetitiveBehaviors: '手をひらひらさせる',
      ComprehensionDifficulty: '比喩が通じにくい',
      BehaviorEpisodes: '先週水曜日に大声を出した',
    };
    const result = mapSpRowToTokuseiResponse(row);
    expect(result.behaviorFeatures).toContain('【変化への対応困難】予定変更でパニック');
    expect(result.behaviorFeatures).toContain('【繰り返し行動】手をひらひらさせる');
    expect(result.behaviorFeatures).toContain('【理解の困難】比喩が通じにくい');
    expect(result.behaviorFeatures).toContain('【行動エピソード】先週水曜日に大声を出した');
    // Empty fields should be excluded
    expect(result.behaviorFeatures).not.toContain('【物の一部への興味】');
    expect(result.behaviorFeatures).not.toContain('【習慣への固執】');
  });

  it('returns undefined when all behavior columns are empty', () => {
    const result = mapSpRowToTokuseiResponse(baseRow);
    expect(result.behaviorFeatures).toBeUndefined();
  });
});
