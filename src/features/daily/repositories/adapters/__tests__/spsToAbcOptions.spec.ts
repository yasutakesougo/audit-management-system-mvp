import { describe, expect, it } from 'vitest';

import type {
  SupportPlanSheet,
  SupportProcedureManual,
} from '@/features/ibd/core/ibdTypes';

import * as canonical from '@/features/daily/adapters/spsToAbcOptions';
import * as compat from '../spsToAbcOptions';

const minimalSPS: SupportPlanSheet = {
  id: 'sps-compat-001',
  userId: 1,
  version: '1.0',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  nextReviewDueDate: '2026-04-01',
  status: 'confirmed',
  confirmedBy: 10,
  confirmedAt: '2026-01-01T00:00:00Z',
  icebergModel: {
    observableBehaviors: ['大声で叫ぶ'],
    underlyingFactors: [],
    environmentalAdjustments: [],
  },
  positiveConditions: ['静かな環境'],
};

const minimalManual: SupportProcedureManual = {
  id: 'manual-compat-001',
  spsId: 'sps-compat-001',
  userId: 1,
  version: '1.0',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  supervisedBy: 10,
  scenes: [
    {
      id: 'scene-compat',
      sceneType: 'arrival',
      label: '来所時',
      iconKey: 'DirectionsWalk',
      positiveConditions: [],
      procedures: [
        {
          order: 1,
          personAction: '席に着く',
          supporterAction: '声かけする',
          stage: 'proactive',
        },
      ],
    },
  ],
};

describe('repositories/adapters/spsToAbcOptions compatibility', () => {
  it('re-exports canonical functions and constants', () => {
    expect(compat.buildSPSDrivenOptions).toBe(canonical.buildSPSDrivenOptions);
    expect(compat.getDefaultSPSDrivenOptions).toBe(canonical.getDefaultSPSDrivenOptions);
    expect(compat.mergeOptionsWithDefaults).toBe(canonical.mergeOptionsWithDefaults);
    expect(compat.DEFAULT_MOOD_OPTIONS).toBe(canonical.DEFAULT_MOOD_OPTIONS);
    expect(compat.DEFAULT_ABC_OPTIONS).toBe(canonical.DEFAULT_ABC_OPTIONS);
  });

  it('returns the same output as canonical path', () => {
    const canonicalResult = canonical.buildSPSDrivenOptions(minimalSPS, minimalManual);
    const compatResult = compat.buildSPSDrivenOptions(minimalSPS, minimalManual);

    expect(compatResult).toEqual(canonicalResult);
  });
});
