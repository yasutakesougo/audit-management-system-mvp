/**
 * findingEvidenceSummary.spec.ts
 *
 * finding ごとの Iceberg 分析根拠サマリー解決のテスト。
 */
import { describe, it, expect } from 'vitest';
import {
  resolveFindingEvidence,
  resolveAllFindingEvidence,
  type IcebergEvidenceBySheet,
} from '@/domain/regulatory/findingEvidenceSummary';
import type { AuditFinding } from '@/domain/regulatory';

function makeFinding(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    id: 'f-001',
    type: 'review_overdue',
    severity: 'medium',
    userId: 'U001',
    planningSheetId: 'sheet-1',
    message: 'テスト',
    domain: 'sheet',
    detectedAt: '2026-03-13',
    ...overrides,
  };
}

const sampleEvidence: IcebergEvidenceBySheet = {
  sessionCount: {
    'sheet-1': 3,
    'sheet-2': 0,
  },
  latestAnalysisDate: {
    'sheet-1': '2026-03-08',
  },
};

describe('resolveFindingEvidence', () => {
  it('returns evidence summary when sheet has iceberg data', () => {
    const result = resolveFindingEvidence(makeFinding(), sampleEvidence);
    expect(result.hasEvidence).toBe(true);
    expect(result.icebergCount).toBe(3);
    expect(result.latestIcebergDate).toBe('2026-03-08');
    expect(result.displayText).toContain('Iceberg 3件');
    expect(result.displayText).toContain('2026-03-08');
  });

  it('returns "no evidence" when sheet has 0 sessions', () => {
    const finding = makeFinding({ planningSheetId: 'sheet-2' });
    const result = resolveFindingEvidence(finding, sampleEvidence);
    expect(result.hasEvidence).toBe(false);
    expect(result.icebergCount).toBe(0);
    expect(result.displayText).toContain('分析なし');
  });

  it('returns empty when planningSheetId is undefined', () => {
    const finding = makeFinding({ planningSheetId: undefined });
    const result = resolveFindingEvidence(finding, sampleEvidence);
    expect(result.hasEvidence).toBe(false);
    expect(result.displayText).toBe('');
  });

  it('returns empty when icebergData is null', () => {
    const result = resolveFindingEvidence(makeFinding(), null);
    expect(result.hasEvidence).toBe(false);
    expect(result.displayText).toBe('');
  });

  it('returns "no evidence" when sheet is not in evidence data', () => {
    const finding = makeFinding({ planningSheetId: 'sheet-unknown' });
    const result = resolveFindingEvidence(finding, sampleEvidence);
    expect(result.hasEvidence).toBe(false);
    expect(result.displayText).toContain('分析なし');
  });
});

describe('resolveAllFindingEvidence', () => {
  it('returns a map of all finding evidence', () => {
    const findings = [
      makeFinding({ id: 'f-001', planningSheetId: 'sheet-1' }),
      makeFinding({ id: 'f-002', planningSheetId: 'sheet-2' }),
      makeFinding({ id: 'f-003', planningSheetId: undefined }),
    ];
    const result = resolveAllFindingEvidence(findings, sampleEvidence);

    expect(result.size).toBe(3);
    expect(result.get('f-001')!.hasEvidence).toBe(true);
    expect(result.get('f-002')!.hasEvidence).toBe(false);
    expect(result.get('f-003')!.displayText).toBe('');
  });

  it('returns empty map for empty findings', () => {
    const result = resolveAllFindingEvidence([], sampleEvidence);
    expect(result.size).toBe(0);
  });

  it('handles null icebergData gracefully', () => {
    const findings = [makeFinding()];
    const result = resolveAllFindingEvidence(findings, null);
    expect(result.size).toBe(1);
    expect(result.get('f-001')!.hasEvidence).toBe(false);
  });
});
