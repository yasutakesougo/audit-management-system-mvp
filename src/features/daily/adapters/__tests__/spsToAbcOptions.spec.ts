// ---------------------------------------------------------------------------
// spsToAbcOptions — Unit Tests
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import type {
    SupportPlanSheet,
    SupportProcedureManual,
} from '@/features/ibd/ibdTypes';

import {
    buildSPSDrivenOptions,
    DEFAULT_ABC_OPTIONS,
    DEFAULT_MOOD_OPTIONS,
    getDefaultSPSDrivenOptions,
    mergeOptionsWithDefaults,
} from '../spsToAbcOptions';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const minimalSPS: SupportPlanSheet = {
  id: 'sps-001',
  userId: 1,
  version: '1.0',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  nextReviewDueDate: '2026-04-01',
  status: 'confirmed',
  confirmedBy: 10,
  confirmedAt: '2026-01-01T00:00:00Z',
  icebergModel: {
    observableBehaviors: ['大声で叫ぶ', '机を叩く'],
    underlyingFactors: ['聴覚過敏', '不安'],
    environmentalAdjustments: ['イヤーマフの提供'],
  },
  positiveConditions: ['静かな環境', '好きな音楽が流れている', '1対1の関わり'],
};

const minimalManual: SupportProcedureManual = {
  id: 'manual-001',
  spsId: 'sps-001',
  userId: 1,
  version: '1.0',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  supervisedBy: 10,
  scenes: [
    {
      id: 'scene-arrival',
      sceneType: 'arrival',
      label: '来所時',
      iconKey: 'DirectionsWalk',
      positiveConditions: ['静かに靴を脱げている'],
      procedures: [
        {
          order: 1,
          personAction: '靴を脱いで下駄箱に入れる',
          supporterAction: '声かけでスケジュールを提示する',
          stage: 'proactive',
        },
        {
          order: 2,
          personAction: '荷物をロッカーに入れる',
          supporterAction: 'イヤーマフを準備する',
          stage: 'proactive',
        },
      ],
    },
    {
      id: 'scene-panic',
      sceneType: 'panic',
      label: 'パニック時',
      iconKey: 'Warning',
      positiveConditions: [],
      procedures: [
        {
          order: 1,
          personAction: '暴れる',
          supporterAction: '安全確保のため距離をとる',
          stage: 'crisisResponse',
        },
        {
          order: 2,
          personAction: '泣く',
          supporterAction: 'クールダウンスペースへ誘導する',
          stage: 'postCrisis',
          category: 'riskManagement',
        },
      ],
    },
  ],
};

const emptySPS: SupportPlanSheet = {
  ...minimalSPS,
  icebergModel: {
    observableBehaviors: [],
    underlyingFactors: [],
    environmentalAdjustments: [],
  },
  positiveConditions: [],
};

const emptyManual: SupportProcedureManual = {
  ...minimalManual,
  scenes: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getDefaultSPSDrivenOptions', () => {
  it('returns default mood options', () => {
    const result = getDefaultSPSDrivenOptions();
    expect(result.moodOptions).toEqual([...DEFAULT_MOOD_OPTIONS]);
  });

  it('returns default ABC options', () => {
    const result = getDefaultSPSDrivenOptions();
    expect(result.abcOptions).toEqual(DEFAULT_ABC_OPTIONS);
  });

  it('returns all 4 stage options', () => {
    const result = getDefaultSPSDrivenOptions();
    expect(result.stageOptions).toHaveLength(4);
    expect(result.stageOptions.map((s) => s.value)).toEqual([
      'proactive', 'earlyResponse', 'crisisResponse', 'postCrisis',
    ]);
  });

  it('returns empty categoryHints', () => {
    const result = getDefaultSPSDrivenOptions();
    expect(result.categoryHints).toEqual([]);
  });
});

describe('buildSPSDrivenOptions', () => {
  it('produces mood options from positiveConditions + defaults', () => {
    const result = buildSPSDrivenOptions(minimalSPS, minimalManual);
    // First 3 from SPS positiveConditions
    expect(result.moodOptions[0]).toBe('静かな環境');
    expect(result.moodOptions[1]).toBe('好きな音楽が流れている');
    expect(result.moodOptions[2]).toBe('1対1の関わり');
    // Defaults come after
    expect(result.moodOptions).toContain('落ち着いている');
    // No duplicates
    expect(new Set(result.moodOptions).size).toBe(result.moodOptions.length);
  });

  it('produces antecedent options from IcebergModel + COMMON_ANTECEDENT_TAGS', () => {
    const result = buildSPSDrivenOptions(minimalSPS, minimalManual);
    // IcebergModel observableBehaviors appear first
    expect(result.abcOptions.antecedent[0]).toBe('大声で叫ぶ');
    expect(result.abcOptions.antecedent[1]).toBe('机を叩く');
    // Common tags are included
    expect(result.abcOptions.antecedent).toContain('予定の変更');
    expect(result.abcOptions.antecedent).toContain('待ち時間');
  });

  it('produces behavior options from manual personAction', () => {
    const result = buildSPSDrivenOptions(minimalSPS, minimalManual);
    expect(result.abcOptions.behavior).toContain('靴を脱いで下駄箱に入れる');
    expect(result.abcOptions.behavior).toContain('暴れる');
    expect(result.abcOptions.behavior).toContain('泣く');
  });

  it('produces consequence options from extractInterventionMethods', () => {
    const result = buildSPSDrivenOptions(minimalSPS, minimalManual);
    expect(result.abcOptions.consequence).toContain('声かけでスケジュールを提示する');
    expect(result.abcOptions.consequence).toContain('安全確保のため距離をとる');
    expect(result.abcOptions.consequence).toContain('クールダウンスペースへ誘導する');
  });

  it('filters stageOptions to only stages present in manual', () => {
    const result = buildSPSDrivenOptions(minimalSPS, minimalManual);
    const stageValues = result.stageOptions.map((s) => s.value);
    expect(stageValues).toContain('proactive');
    expect(stageValues).toContain('crisisResponse');
    expect(stageValues).toContain('postCrisis');
    // earlyResponse is not in the fixture
    expect(stageValues).not.toContain('earlyResponse');
  });

  it('extracts categoryHints from interventions', () => {
    const result = buildSPSDrivenOptions(minimalSPS, minimalManual);
    // The fixture has environmental (proactive) and riskManagement (crisisResponse/postCrisis)
    expect(result.categoryHints.length).toBeGreaterThan(0);
  });

  it('falls back to defaults when SPS has empty data', () => {
    const result = buildSPSDrivenOptions(emptySPS, emptyManual);
    // Mood: Only defaults
    expect(result.moodOptions).toEqual([...DEFAULT_MOOD_OPTIONS]);
    // Behavior: Falls back to default
    expect(result.abcOptions.behavior).toEqual(DEFAULT_ABC_OPTIONS.behavior);
    // Consequence: Falls back to default
    expect(result.abcOptions.consequence).toEqual(DEFAULT_ABC_OPTIONS.consequence);
    // Antecedent: Still has COMMON_ANTECEDENT_TAGS
    expect(result.abcOptions.antecedent.length).toBeGreaterThan(0);
  });

  it('deduplicates all option arrays', () => {
    // Create SPS with duplicate values
    const dupSPS: SupportPlanSheet = {
      ...minimalSPS,
      positiveConditions: ['静かな環境', '静かな環境', '落ち着いている'],
    };
    const result = buildSPSDrivenOptions(dupSPS, minimalManual);
    expect(new Set(result.moodOptions).size).toBe(result.moodOptions.length);
    expect(new Set(result.abcOptions.antecedent).size).toBe(result.abcOptions.antecedent.length);
  });
});

describe('mergeOptionsWithDefaults', () => {
  it('returns full defaults when given empty partial', () => {
    const result = mergeOptionsWithDefaults({});
    expect(result.moodOptions).toEqual([...DEFAULT_MOOD_OPTIONS]);
    expect(result.abcOptions).toEqual(DEFAULT_ABC_OPTIONS);
  });

  it('preserves custom mood options when provided', () => {
    const result = mergeOptionsWithDefaults({
      moodOptions: ['カスタム状態A', 'カスタム状態B'],
    });
    expect(result.moodOptions).toEqual(['カスタム状態A', 'カスタム状態B']);
    // Other fields remain defaults
    expect(result.abcOptions).toEqual(DEFAULT_ABC_OPTIONS);
  });

  it('preserves partial abcOptions and fills missing with defaults', () => {
    const result = mergeOptionsWithDefaults({
      abcOptions: {
        antecedent: ['カスタム先行事象'],
        behavior: [],  // empty → falls back to default
        consequence: ['カスタム結果'],
      },
    });
    expect(result.abcOptions.antecedent).toEqual(['カスタム先行事象']);
    expect(result.abcOptions.behavior).toEqual(DEFAULT_ABC_OPTIONS.behavior);
    expect(result.abcOptions.consequence).toEqual(['カスタム結果']);
  });
});
