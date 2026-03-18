import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildIndexAuditReportModel, renderIndexAuditMarkdown } from './reportGenerator';
import type { TelemetrySummary } from '../computeTelemetrySummary';

describe('reportGenerator', () => {
  const dummySummary: TelemetrySummary = {
    total: 10,
    slowCount: 2,
    errorCount: 0,
    lowCount: 5,
    mediumCount: 3,
    highCount: 0,
    byWarningCode: {},
    topIndexCandidates: [
      { listName: 'Issues', field: 'Status', score: 10, count: 5, reasons: ['filter', 'orderby'] },
      { listName: 'Issues', field: 'UserCode', score: 4, count: 2, reasons: ['startswith'] },
      { listName: 'Approvals', field: 'Modified', score: 2, count: 1, reasons: ['orderby'] },
    ],
  };

  beforeEach(() => {
    // Mock date to ensure consistent 'generatedAt' testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T01:23:45Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('buildIndexAuditReportModel', () => {
    it('1. Default options apply threshold 4 and return correct items', () => {
      const model = buildIndexAuditReportModel(dummySummary);
      expect(model.totalCandidates).toBe(2);
      expect(model.totalLists).toBe(1); // Only Issues passed threshold
      expect(model.thresholdFilter).toBe(4);
      expect(model.generatedAt).toBe('2026-03-18T01:23:45.000Z');
      expect(model.items.map(i => i.field)).toEqual(['Status', 'UserCode']);
    });

    it('2. minScoreThreshold rules out top candidates correctly', () => {
      const model = buildIndexAuditReportModel(dummySummary, { minScoreThreshold: 5 });
      expect(model.totalCandidates).toBe(1);
      expect(model.items[0].field).toBe('Status');
    });

    it('3. topN limits returned candidates', () => {
      const model = buildIndexAuditReportModel(dummySummary, { minScoreThreshold: 1, topN: 2 });
      expect(model.totalCandidates).toBe(2);
      expect(model.totalLists).toBe(1);
    });
    
    it('4. Handles empty candidates gracefully', () => {
      const model = buildIndexAuditReportModel({ ...dummySummary, topIndexCandidates: [] });
      expect(model.totalCandidates).toBe(0);
      expect(model.items).toEqual([]);
    });
  });

  describe('renderIndexAuditMarkdown', () => {
    it('1. Renders Markdown containing candidates', () => {
      const model = buildIndexAuditReportModel(dummySummary);
      const md = renderIndexAuditMarkdown(model);
      
      expect(md).toContain('# SharePoint Index Audit Report');
      expect(md).toContain('Generated: 2026-03-18T01:23:45.000Z');
      expect(md).toContain('- Lists with candidates: 1');
      expect(md).toContain('- Total candidates: 2');
      expect(md).toContain('- Status — score 10, count 5, reasons: filter, orderby');
      expect(md).toContain('- UserCode — score 4, count 2, reasons: startswith');
    });

    it('2. Renders no candidates fallback correctly when empty', () => {
      const model = buildIndexAuditReportModel({ ...dummySummary, topIndexCandidates: [] });
      const md = renderIndexAuditMarkdown(model);
      
      expect(md).toContain('現在、推奨されるインデックス候補はありません。');
      expect(md).not.toContain('###'); // No list headers should exist
    });
  });
});
