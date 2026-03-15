// ---------------------------------------------------------------------------
// localEvidenceLinkRepository.spec.ts — Evidence Links 永続化のユニットテスト
//
// CRUD 操作・空初期化・サマリー集計をテストする。
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from 'vitest';
import { localEvidenceLinkRepository } from '@/infra/localStorage/localEvidenceLinkRepository';
import type { EvidenceLinkMap, EvidenceLink } from '@/domain/isp/evidenceLink';
import { createEmptyEvidenceLinkMap } from '@/domain/isp/evidenceLink';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeLink(overrides: Partial<EvidenceLink> = {}): EvidenceLink {
  return {
    type: 'abc',
    referenceId: `ref_${Date.now()}`,
    label: '[ABC] テスト行動',
    linkedAt: '2026-03-15T10:00:00Z',
    ...overrides,
  };
}

function makePopulatedMap(overrides: Partial<EvidenceLinkMap> = {}): EvidenceLinkMap {
  return {
    antecedentStrategies: [makeLink({ referenceId: 'abc_1', type: 'abc' })],
    teachingStrategies: [makeLink({ referenceId: 'pdca_1', type: 'pdca', label: '[PDCA] テスト' })],
    consequenceStrategies: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

// =========================================================================
// get / save
// =========================================================================

describe('localEvidenceLinkRepository', () => {
  describe('get()', () => {
    it('returns empty map for non-existent sheet', () => {
      const result = localEvidenceLinkRepository.get('nonexistent');

      expect(result.antecedentStrategies).toEqual([]);
      expect(result.teachingStrategies).toEqual([]);
      expect(result.consequenceStrategies).toEqual([]);
    });

    it('returns stored map after save', () => {
      const map = makePopulatedMap();
      localEvidenceLinkRepository.save('sheet_1', map);

      const result = localEvidenceLinkRepository.get('sheet_1');
      expect(result.antecedentStrategies).toHaveLength(1);
      expect(result.antecedentStrategies[0].referenceId).toBe('abc_1');
      expect(result.teachingStrategies).toHaveLength(1);
      expect(result.teachingStrategies[0].referenceId).toBe('pdca_1');
      expect(result.consequenceStrategies).toHaveLength(0);
    });

    it('isolates data between different sheets', () => {
      const map1 = makePopulatedMap({
        antecedentStrategies: [makeLink({ referenceId: 'abc_A' })],
      });
      const map2 = makePopulatedMap({
        antecedentStrategies: [makeLink({ referenceId: 'abc_B' })],
      });

      localEvidenceLinkRepository.save('sheet_1', map1);
      localEvidenceLinkRepository.save('sheet_2', map2);

      expect(localEvidenceLinkRepository.get('sheet_1').antecedentStrategies[0].referenceId).toBe('abc_A');
      expect(localEvidenceLinkRepository.get('sheet_2').antecedentStrategies[0].referenceId).toBe('abc_B');
    });
  });

  // =========================================================================
  // save (overwrite)
  // =========================================================================

  describe('save()', () => {
    it('overwrites existing data for the same sheet', () => {
      const original = makePopulatedMap();
      localEvidenceLinkRepository.save('sheet_1', original);

      const updated: EvidenceLinkMap = {
        antecedentStrategies: [],
        teachingStrategies: [],
        consequenceStrategies: [makeLink({ referenceId: 'abc_new', type: 'abc' })],
      };
      localEvidenceLinkRepository.save('sheet_1', updated);

      const result = localEvidenceLinkRepository.get('sheet_1');
      expect(result.antecedentStrategies).toHaveLength(0);
      expect(result.consequenceStrategies).toHaveLength(1);
      expect(result.consequenceStrategies[0].referenceId).toBe('abc_new');
    });

    it('preserves other sheets when updating one', () => {
      localEvidenceLinkRepository.save('sheet_1', makePopulatedMap());
      localEvidenceLinkRepository.save('sheet_2', createEmptyEvidenceLinkMap());

      // Update sheet_2 only
      const updatedMap: EvidenceLinkMap = {
        antecedentStrategies: [makeLink({ referenceId: 'new_link' })],
        teachingStrategies: [],
        consequenceStrategies: [],
      };
      localEvidenceLinkRepository.save('sheet_2', updatedMap);

      // sheet_1 should be unchanged
      expect(localEvidenceLinkRepository.get('sheet_1').antecedentStrategies).toHaveLength(1);
      expect(localEvidenceLinkRepository.get('sheet_1').antecedentStrategies[0].referenceId).toBe('abc_1');
      // sheet_2 should be updated
      expect(localEvidenceLinkRepository.get('sheet_2').antecedentStrategies[0].referenceId).toBe('new_link');
    });
  });

  // =========================================================================
  // delete
  // =========================================================================

  describe('delete()', () => {
    it('removes data for a specific sheet', () => {
      localEvidenceLinkRepository.save('sheet_1', makePopulatedMap());
      localEvidenceLinkRepository.delete('sheet_1');

      const result = localEvidenceLinkRepository.get('sheet_1');
      expect(result.antecedentStrategies).toEqual([]);
      expect(result.teachingStrategies).toEqual([]);
      expect(result.consequenceStrategies).toEqual([]);
    });

    it('does not affect other sheets when deleting', () => {
      localEvidenceLinkRepository.save('sheet_1', makePopulatedMap());
      localEvidenceLinkRepository.save('sheet_2', makePopulatedMap());

      localEvidenceLinkRepository.delete('sheet_1');

      // sheet_2 still intact
      expect(localEvidenceLinkRepository.get('sheet_2').antecedentStrategies).toHaveLength(1);
    });

    it('is safe to delete non-existent sheet', () => {
      expect(() => localEvidenceLinkRepository.delete('nonexistent')).not.toThrow();
    });
  });

  // =========================================================================
  // getSummary
  // =========================================================================

  describe('getSummary()', () => {
    it('returns empty object when no data', () => {
      expect(localEvidenceLinkRepository.getSummary()).toEqual({});
    });

    it('counts abc and pdca links per sheet', () => {
      const map: EvidenceLinkMap = {
        antecedentStrategies: [
          makeLink({ referenceId: 'a1', type: 'abc' }),
          makeLink({ referenceId: 'a2', type: 'abc' }),
        ],
        teachingStrategies: [
          makeLink({ referenceId: 'p1', type: 'pdca' }),
        ],
        consequenceStrategies: [
          makeLink({ referenceId: 'a3', type: 'abc' }),
          makeLink({ referenceId: 'p2', type: 'pdca' }),
        ],
      };
      localEvidenceLinkRepository.save('sheet_1', map);

      const summary = localEvidenceLinkRepository.getSummary();
      expect(summary['sheet_1']).toEqual({ abc: 3, pdca: 2 });
    });

    it('excludes sheets with no links', () => {
      localEvidenceLinkRepository.save('sheet_empty', createEmptyEvidenceLinkMap());
      localEvidenceLinkRepository.save('sheet_full', makePopulatedMap());

      const summary = localEvidenceLinkRepository.getSummary();
      expect(summary['sheet_empty']).toBeUndefined();
      expect(summary['sheet_full']).toBeDefined();
    });

    it('aggregates across multiple sheets', () => {
      localEvidenceLinkRepository.save('s1', makePopulatedMap());
      localEvidenceLinkRepository.save('s2', makePopulatedMap());

      const summary = localEvidenceLinkRepository.getSummary();
      expect(Object.keys(summary)).toHaveLength(2);
      expect(summary['s1']).toEqual({ abc: 1, pdca: 1 });
      expect(summary['s2']).toEqual({ abc: 1, pdca: 1 });
    });
  });

  // =========================================================================
  // Resilience
  // =========================================================================

  describe('resilience', () => {
    it('returns empty map when localStorage contains invalid JSON', () => {
      localStorage.setItem('evidence-links', 'not-valid-json');

      const result = localEvidenceLinkRepository.get('sheet_1');
      expect(result.antecedentStrategies).toEqual([]);
      expect(result.teachingStrategies).toEqual([]);
      expect(result.consequenceStrategies).toEqual([]);
    });

    it('can save after recovering from corrupt data', () => {
      localStorage.setItem('evidence-links', '{broken');

      // Should not throw
      localEvidenceLinkRepository.save('sheet_1', makePopulatedMap());

      const result = localEvidenceLinkRepository.get('sheet_1');
      expect(result.antecedentStrategies).toHaveLength(1);
    });
  });
});
