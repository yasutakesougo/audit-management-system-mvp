import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UseSP } from '@/lib/spClient';
import {
  createPdfOutputLogRepository,
  __test__,
  type PdfOutputLogCreateInput,
} from '../pdfOutputLogRepository';

const { mapRowToEntry } = __test__;

// ── Mock SP Client ──
const mockAddListItemByTitle = vi.fn();
const mockListItems = vi.fn();

function createMockSp(): UseSP {
  return {
    addListItemByTitle: mockAddListItemByTitle,
    listItems: mockListItems,
  } as unknown as UseSP;
}

describe('pdfOutputLogRepository', () => {
  beforeEach(() => {
    mockAddListItemByTitle.mockReset();
    mockListItems.mockReset();
  });

  describe('mapRowToEntry', () => {
    it('maps SP row to domain entry', () => {
      const row = {
        Id: 42,
        Title: 'monthly-report_U001_2026-03',
        OutputType: 'monthly-report',
        UserCode: 'U001',
        OutputDate: '2026-03-16T10:00:00Z',
        TargetPeriod: '2026-03',
        FileName: 'report_U001_202603.pdf',
        FileUrl: 'https://sp.example.com/file.pdf',
        OutputBy: 'staff@example.com',
        Status: 'success',
        ErrorMessage: null,
        Source: 'manual',
        Created: '2026-03-16T10:00:00Z',
        Modified: '2026-03-16T10:00:00Z',
      };

      const entry = mapRowToEntry(row);

      expect(entry.id).toBe(42);
      expect(entry.outputType).toBe('monthly-report');
      expect(entry.userCode).toBe('U001');
      expect(entry.targetPeriod).toBe('2026-03');
      expect(entry.status).toBe('success');
      expect(entry.errorMessage).toBeUndefined(); // null → undefined
      expect(entry.fileUrl).toBe('https://sp.example.com/file.pdf');
    });
  });

  describe('log', () => {
    it('creates a list item with correct payload', async () => {
      mockAddListItemByTitle.mockResolvedValue({ Id: 99 });
      const sp = createMockSp();
      const repo = createPdfOutputLogRepository(sp);

      const input: PdfOutputLogCreateInput = {
        outputType: 'monthly-report',
        userCode: 'U001',
        targetPeriod: '2026-03',
        fileName: 'report.pdf',
        outputBy: 'staff@example.com',
        status: 'success',
        source: 'manual',
      };

      const id = await repo.log(input);

      expect(id).toBe(99);
      expect(mockAddListItemByTitle).toHaveBeenCalledWith(
        'PdfOutput_Log',
        expect.objectContaining({
          Title: 'monthly-report_U001_2026-03',
          OutputType: 'monthly-report',
          UserCode: 'U001',
          TargetPeriod: '2026-03',
          FileName: 'report.pdf',
          OutputBy: 'staff@example.com',
          Status: 'success',
          Source: 'manual',
        }),
      );
    });

    it('includes optional fields when provided', async () => {
      mockAddListItemByTitle.mockResolvedValue({ Id: 100 });
      const sp = createMockSp();
      const repo = createPdfOutputLogRepository(sp);

      await repo.log({
        outputType: 'billing',
        userCode: 'U002',
        targetPeriod: '2026-02',
        fileName: 'billing.xlsx',
        fileUrl: 'https://sp.example.com/billing.xlsx',
        outputBy: 'admin@example.com',
        status: 'failed',
        errorMessage: 'Template not found',
        source: 'power-automate',
      });

      expect(mockAddListItemByTitle).toHaveBeenCalledWith(
        'PdfOutput_Log',
        expect.objectContaining({
          FileUrl: 'https://sp.example.com/billing.xlsx',
          ErrorMessage: 'Template not found',
        }),
      );
    });
  });

  describe('getByPeriod', () => {
    it('queries with correct filter', async () => {
      mockListItems.mockResolvedValue([]);
      const sp = createMockSp();
      const repo = createPdfOutputLogRepository(sp);

      await repo.getByPeriod('2026-03');

      expect(mockListItems).toHaveBeenCalledWith('PdfOutput_Log', {
        select: expect.arrayContaining(['Id', 'Title', 'OutputType']),
        filter: "TargetPeriod eq '2026-03'",
        orderby: 'OutputDate desc',
        top: 500,
      });
    });
  });

  describe('getByUser', () => {
    it('queries with user filter and default top', async () => {
      mockListItems.mockResolvedValue([]);
      const sp = createMockSp();
      const repo = createPdfOutputLogRepository(sp);

      await repo.getByUser('U001');

      expect(mockListItems).toHaveBeenCalledWith('PdfOutput_Log', {
        select: expect.any(Array),
        filter: "UserCode eq 'U001'",
        orderby: 'OutputDate desc',
        top: 50,
      });
    });

    it('respects custom top parameter', async () => {
      mockListItems.mockResolvedValue([]);
      const sp = createMockSp();
      const repo = createPdfOutputLogRepository(sp);

      await repo.getByUser('U002', 10);

      expect(mockListItems).toHaveBeenCalledWith('PdfOutput_Log', expect.objectContaining({
        top: 10,
      }));
    });
  });
});
