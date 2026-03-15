import { describe, expect, it } from 'vitest';

import type { AbcRecord } from '@/domain/abc/abcRecord';
import type { EvidenceLinkMap } from '@/domain/isp/evidenceLink';
import { createEmptyEvidenceLinkMap } from '@/domain/isp/evidenceLink';
import {
  buildAbcLabel,
  getTopReferencedAbcRecords,
  getTopReferencedPdcaItems,
} from '@/domain/isp/getTopReferencedEvidence';

// ── Helpers ──

function makeLinkMap(overrides: Partial<EvidenceLinkMap> = {}): EvidenceLinkMap {
  return { ...createEmptyEvidenceLinkMap(), ...overrides };
}

function abcLink(refId: string) {
  return { type: 'abc' as const, referenceId: refId, label: `ABC-${refId}`, linkedAt: '2026-03-15T10:00:00' };
}

function pdcaLink(refId: string, label: string) {
  return { type: 'pdca' as const, referenceId: refId, label, linkedAt: '2026-03-15T10:00:00' };
}

function makeAbcRecord(id: string, overrides: Partial<AbcRecord> = {}): AbcRecord {
  return {
    id,
    userId: 'user-1',
    userName: 'テスト太郎',
    occurredAt: '2026-03-15T10:30:00',
    setting: '活動場面',
    antecedent: '指示があった',
    behavior: '大声を出して立ち上がった',
    consequence: '職員が対応',
    intensity: 'medium',
    durationMinutes: null,
    riskFlag: false,
    recorderName: '記録者',
    tags: [],
    notes: '',
    createdAt: '2026-03-15T10:30:00',
    ...overrides,
  };
}

// ── buildAbcLabel ──

describe('buildAbcLabel', () => {
  it('generates label with date, setting, and behavior', () => {
    const record = makeAbcRecord('abc-1', {
      occurredAt: '2026-03-15T10:30:00',
      setting: '活動場面',
      behavior: '大声を出して立ち上がった',
    });
    const label = buildAbcLabel(record);
    expect(label).toBe('3/15 活動場面 — 大声を出して立ち上がった');
  });

  it('truncates long behavior to 20 chars with ellipsis', () => {
    const record = makeAbcRecord('abc-1', {
      behavior: 'これはとても長い行動の説明文です。20文字を超えます。',
    });
    const label = buildAbcLabel(record);
    expect(label).toContain('…');
    // "これはとても長い行動の説明文です。20文字" + "…"
    expect(label.length).toBeLessThanOrEqual(50);
  });

  it('omits setting separator when setting is empty', () => {
    const record = makeAbcRecord('abc-1', {
      setting: '',
      behavior: '離席した',
    });
    const label = buildAbcLabel(record);
    expect(label).not.toContain(' — ');
    expect(label).toContain('離席した');
  });
});

// ── getTopReferencedAbcRecords ──

describe('getTopReferencedAbcRecords', () => {
  it('returns empty when no user ABC record IDs', () => {
    const result = getTopReferencedAbcRecords(new Set(), {
      sheet1: makeLinkMap({ antecedentStrategies: [abcLink('abc-1')] }),
    }, []);
    expect(result).toEqual([]);
  });

  it('returns empty when no evidence links exist', () => {
    const result = getTopReferencedAbcRecords(
      new Set(['abc-1']),
      {},
      [makeAbcRecord('abc-1')],
    );
    expect(result).toEqual([]);
  });

  it('counts and ranks ABC records by reference frequency', () => {
    const records = [
      makeAbcRecord('abc-1', { behavior: '行動A' }),
      makeAbcRecord('abc-2', { behavior: '行動B' }),
      makeAbcRecord('abc-3', { behavior: '行動C' }),
    ];
    const userIds = new Set(['abc-1', 'abc-2', 'abc-3']);
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1'), abcLink('abc-2')],
        teachingStrategies: [abcLink('abc-1')],
      }),
      sheet2: makeLinkMap({
        consequenceStrategies: [abcLink('abc-1'), abcLink('abc-3')],
      }),
    };

    const result = getTopReferencedAbcRecords(userIds, allMaps, records);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('abc-1');
    expect(result[0].count).toBe(3);
    expect(result[1].id).toBe('abc-2');
    expect(result[1].count).toBe(1);
  });

  it('limits results to topN', () => {
    const records = [
      makeAbcRecord('abc-1'),
      makeAbcRecord('abc-2'),
      makeAbcRecord('abc-3'),
      makeAbcRecord('abc-4'),
    ];
    const userIds = new Set(['abc-1', 'abc-2', 'abc-3', 'abc-4']);
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1'), abcLink('abc-2'), abcLink('abc-3'), abcLink('abc-4')],
      }),
    };

    const result = getTopReferencedAbcRecords(userIds, allMaps, records, 2);
    expect(result).toHaveLength(2);
  });

  it('ignores IDs not in userAbcRecordIds', () => {
    const records = [makeAbcRecord('abc-1')];
    const userIds = new Set(['abc-1']);
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1'), abcLink('abc-other')],
      }),
    };

    const result = getTopReferencedAbcRecords(userIds, allMaps, records);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('abc-1');
  });

  it('uses fallback label when record not found', () => {
    const userIds = new Set(['abc-missing']);
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({ antecedentStrategies: [abcLink('abc-missing')] }),
    };

    const result = getTopReferencedAbcRecords(userIds, allMaps, []);
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain('ABC-');
  });

  it('ignores PDCA links', () => {
    const records = [makeAbcRecord('abc-1')];
    const userIds = new Set(['abc-1']);
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1'), pdcaLink('pdca-1', '午後活動')],
      }),
    };

    const result = getTopReferencedAbcRecords(userIds, allMaps, records);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('abc-1');
  });
});

// ── getTopReferencedPdcaItems ──

describe('getTopReferencedPdcaItems', () => {
  it('returns empty when no evidence links exist', () => {
    const result = getTopReferencedPdcaItems({});
    expect(result).toEqual([]);
  });

  it('returns empty when only ABC links exist', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [abcLink('abc-1')],
      }),
    };
    const result = getTopReferencedPdcaItems(allMaps);
    expect(result).toEqual([]);
  });

  it('counts and ranks PDCA items by reference frequency', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [
          pdcaLink('pdca-1', '午後活動の不安対応'),
          pdcaLink('pdca-2', '食事場面の予防支援'),
        ],
        teachingStrategies: [
          pdcaLink('pdca-1', '午後活動の不安対応'),
        ],
      }),
      sheet2: makeLinkMap({
        consequenceStrategies: [
          pdcaLink('pdca-1', '午後活動の不安対応'),
          pdcaLink('pdca-3', '見通し提示の標準化'),
        ],
      }),
    };

    const result = getTopReferencedPdcaItems(allMaps);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: 'pdca-1', label: '午後活動の不安対応', count: 3 });
    expect(result[1]).toEqual({ id: 'pdca-2', label: '食事場面の予防支援', count: 1 });
    expect(result[2]).toEqual({ id: 'pdca-3', label: '見通し提示の標準化', count: 1 });
  });

  it('limits results to topN', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [
          pdcaLink('pdca-1', 'A'),
          pdcaLink('pdca-2', 'B'),
          pdcaLink('pdca-3', 'C'),
          pdcaLink('pdca-4', 'D'),
        ],
      }),
    };

    const result = getTopReferencedPdcaItems(allMaps, 2);
    expect(result).toHaveLength(2);
  });

  it('preserves first encountered label for each ID', () => {
    const allMaps: Record<string, EvidenceLinkMap> = {
      sheet1: makeLinkMap({
        antecedentStrategies: [
          pdcaLink('pdca-1', '最初のラベル'),
        ],
      }),
      sheet2: makeLinkMap({
        teachingStrategies: [
          pdcaLink('pdca-1', '別のラベル'),
        ],
      }),
    };

    const result = getTopReferencedPdcaItems(allMaps);
    expect(result[0].label).toBe('最初のラベル');
  });
});
