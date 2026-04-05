import type { UseSP } from '@/lib/spClient';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetDiagnosticsReportFieldResolutionForTest,
  upsertDiagnosticsReport,
} from './diagnosticsReports';

type MockSpClient = {
  getListFieldInternalNames: ReturnType<typeof vi.fn>;
  getListItemsByTitle: ReturnType<typeof vi.fn>;
  addListItemByTitle: ReturnType<typeof vi.fn>;
  updateItemByTitle: ReturnType<typeof vi.fn>;
};

const createMockSp = (): MockSpClient => ({
  getListFieldInternalNames: vi.fn(),
  getListItemsByTitle: vi.fn(),
  addListItemByTitle: vi.fn(),
  updateItemByTitle: vi.fn(),
});

describe('upsertDiagnosticsReport field drift handling', () => {
  beforeEach(() => {
    __resetDiagnosticsReportFieldResolutionForTest();
  });

  it('uses TopIssue0 when TopIssue is drifted with suffix', async () => {
    const sp = createMockSp();
    sp.getListFieldInternalNames.mockResolvedValue(
      new Set([
        'Id',
        'Title',
        'Overall',
        'TopIssue0',
        'SummaryText',
        'ReportLink',
        'Notified',
        'Created',
        'Modified',
      ]),
    );
    sp.getListItemsByTitle
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          Id: 12,
          Title: 'health:https://example.sharepoint.com/sites/Audit',
          Overall: { Value: 'fail' },
          TopIssue0: 'Token期限切れ',
          SummaryText: 'PASS: 0, WARN: 1, FAIL: 1',
          ReportLink: null,
          Notified: false,
          Created: '2026-04-05T00:00:00Z',
          Modified: '2026-04-05T00:00:00Z',
        },
      ]);
    sp.addListItemByTitle.mockResolvedValue({ Id: 12 });

    const result = await upsertDiagnosticsReport(sp as unknown as UseSP, {
      title: 'health:https://example.sharepoint.com/sites/Audit',
      overall: 'fail',
      topIssue: 'Token期限切れ',
      summaryText: 'PASS: 0, WARN: 1, FAIL: 1',
      notified: false,
    });

    const firstSelect = sp.getListItemsByTitle.mock.calls[0][1] as string[];
    expect(firstSelect).toContain('TopIssue0');

    const payload = sp.addListItemByTitle.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.Overall).toBe('fail');
    expect(payload.TopIssue0).toBe('Token期限切れ');
    expect(payload.TopIssue).toBeUndefined();

    expect(result?.TopIssue).toBe('Token期限切れ');
  });

  it('skips topIssue payload when tenant schema has no topIssue field', async () => {
    const sp = createMockSp();
    sp.getListFieldInternalNames.mockResolvedValue(
      new Set([
        'Id',
        'Title',
        'Overall',
        'SummaryText',
        'ReportLink',
        'Notified',
        'Created',
        'Modified',
      ]),
    );
    sp.getListItemsByTitle
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          Id: 21,
          Title: 'health:https://example2.sharepoint.com/sites/Audit',
          Overall: { Value: 'warn' },
          SummaryText: 'PASS: 1, WARN: 2, FAIL: 0',
          ReportLink: null,
          Notified: false,
          Created: '2026-04-05T00:00:00Z',
          Modified: '2026-04-05T00:00:00Z',
        },
      ]);
    sp.addListItemByTitle.mockResolvedValue({ Id: 21 });

    const result = await upsertDiagnosticsReport(sp as unknown as UseSP, {
      title: 'health:https://example2.sharepoint.com/sites/Audit',
      overall: 'warn',
      topIssue: '要確認',
      summaryText: 'PASS: 1, WARN: 2, FAIL: 0',
      notified: false,
    });

    const payload = sp.addListItemByTitle.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.TopIssue).toBeUndefined();
    expect(payload.TopIssue0).toBeUndefined();

    expect(result?.TopIssue).toBeNull();
  });
});
