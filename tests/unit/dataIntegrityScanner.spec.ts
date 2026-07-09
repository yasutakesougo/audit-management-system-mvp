import {
    DUPLICATE_REPORT_TEXT,
    formatScanSummary,
    scanAll,
    validateItems,
    type ScanProgress,
    type ScanTarget,
    type TargetData,
} from '@/lib/dataIntegrityScanner';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ────────────────────────────────────────────────────────────────────────────

const testSchema = z.object({
  Id: z.number(),
  Title: z.string(),
  Email: z.string().min(1),
});

const validItem = { Id: 1, Title: '田中太郎', Email: 'tanaka@example.com' };
const invalidItem = { Id: 2, Title: 123, Email: '' }; // Title wrong type + Email empty

const testTarget: ScanTarget = {
  name: 'test-users',
  listTitle: 'Users_Test',
  schema: testSchema,
  selectFields: ['Id', 'Title', 'Email'],
};

const duplicateTarget: ScanTarget = {
  name: 'test-daily-dup',
  listTitle: 'Daily_Duplicate_Test',
  schema: z.object({
    Id: z.number(),
    UserCode: z.string(),
    RecordDate: z.string(),
    Process: z.string(),
  }),
  selectFields: ['Id', 'UserCode', 'RecordDate', 'Process'],
  duplicateChecks: [
    {
      id: 'user-date-process',
      label: '利用者・日付・工程',
      fields: ['UserCode', 'RecordDate', 'Process'],
      ignoreMissing: true,
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// validateItems
// ────────────────────────────────────────────────────────────────────────────

describe('validateItems', () => {
  it('counts all items as valid when data is correct', () => {
    const result = validateItems(
      [validItem, { Id: 3, Title: '鈴木花子', Email: 'suzuki@example.com' }],
      testSchema,
      'users',
    );

    expect(result.valid).toBe(2);
    expect(result.invalid).toBe(0);
    expect(result.issues).toHaveLength(0);
  });

  it('detects invalid items and returns translated messages', () => {
    const result = validateItems(
      [validItem, invalidItem],
      testSchema,
      'users',
    );

    expect(result.valid).toBe(1);
    expect(result.invalid).toBe(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].recordId).toBe(2);
    expect(result.issues[0].target).toBe('users');
    expect(result.issues[0].messages.length).toBeGreaterThan(0);
    // Should contain Japanese translated messages
    expect(result.issues[0].messages.some((m) => m.includes('想定外') || m.includes('必須'))).toBe(true);
  });

  it('handles empty array', () => {
    const result = validateItems([], testSchema, 'users');

    expect(result.valid).toBe(0);
    expect(result.invalid).toBe(0);
    expect(result.issues).toHaveLength(0);
  });

  it('uses "unknown" for items without Id', () => {
    const noId = { Title: '不明', Email: 'ok@test.com' };
    const result = validateItems([noId], testSchema, 'users');

    expect(result.invalid).toBe(1);
    expect(result.issues[0].recordId).toBe('unknown');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// scanAll
// ────────────────────────────────────────────────────────────────────────────

describe('scanAll', () => {
  it('processes multiple targets and returns results', () => {
    const target2: ScanTarget = {
      name: 'test-daily',
      listTitle: 'Daily_Test',
      schema: z.object({ Id: z.number(), Date: z.string() }),
      selectFields: ['Id', 'Date'],
    };

    const data = new Map<string, TargetData>([
      ['test-users', { items: [validItem, invalidItem], fetchStatus: 'success' }],
      ['test-daily', { items: [{ Id: 10, Date: '2026-01-01' }], fetchStatus: 'success' }],
    ]);

    const results = scanAll([testTarget, target2], data);

    expect(results).toHaveLength(2);
    expect(results[0].target).toBe('test-users');
    expect(results[0].valid).toBe(1);
    expect(results[0].invalid).toBe(1);
    expect(results[1].target).toBe('test-daily');
    expect(results[1].valid).toBe(1);
    expect(results[1].invalid).toBe(0);
  });

  it('calls onProgress callback', () => {
    const progressLog: ScanProgress[] = [];
    const data = new Map<string, TargetData>([
      ['test-users', { items: [validItem], fetchStatus: 'success' }],
    ]);

    scanAll([testTarget], data, (p) => progressLog.push({ ...p }));

    expect(progressLog.length).toBeGreaterThanOrEqual(2);
    expect(progressLog[0].phase).toBe('validating');
    expect(progressLog[progressLog.length - 1].phase).toBe('done');
  });

  it('respects AbortSignal', () => {
    const controller = new AbortController();
    controller.abort();

    const data = new Map<string, TargetData>([
      ['test-users', { items: [validItem], fetchStatus: 'success' }],
    ]);

    const results = scanAll([testTarget], data, undefined, controller.signal);
    expect(results).toHaveLength(0);
  });

  it('handles missing data for a target', () => {
    const data = new Map<string, TargetData>(); // empty map

    const results = scanAll([testTarget], data);

    expect(results).toHaveLength(1);
    expect(results[0].total).toBe(0);
    expect(results[0].valid).toBe(0);
    expect(results[0].invalid).toBe(0);
  });

  it('returns duplicateCount 0 when no duplicate keys exist', () => {
    const data = new Map<string, TargetData>([
      [
        'test-daily-dup',
        {
          items: [
            { Id: 1, UserCode: 'U001', RecordDate: '2026-07-09', Process: 'A' },
            { Id: 2, UserCode: 'U002', RecordDate: '2026-07-10', Process: 'A' },
            { Id: 3, UserCode: 'U001', RecordDate: '2026-07-09', Process: 'B' },
          ],
          fetchStatus: 'success',
        },
      ],
    ]);

    const [result] = scanAll([duplicateTarget], data);

    expect(result.duplicateCount).toBe(0);
    expect(result.duplicateIssues).toHaveLength(0);
  });

  it('detects duplicate groups for identical keys and counts excess rows', () => {
    const data = new Map<string, TargetData>([
      [
        'test-daily-dup',
        {
          items: [
            { Id: 101, UserCode: 'U001', RecordDate: '2026-07-09', Process: 'A' },
            { Id: 102, UserCode: 'U001', RecordDate: '2026-07-09', Process: 'A' },
            { Id: 103, UserCode: 'U002', RecordDate: '2026-07-09', Process: 'A' },
          ],
          fetchStatus: 'success',
        },
      ],
    ]);

    const [result] = scanAll([duplicateTarget], data);

    expect(result.duplicateIssues).toHaveLength(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.duplicateIssues[0].recordIds).toEqual([101, 102]);
    expect(result.duplicateIssues[0].recordCount).toBe(2);
  });

  it('normalizes date formats so 2026-07-09 and 2026/07/09 match', () => {
    const data = new Map<string, TargetData>([
      [
        'test-daily-dup',
        {
          items: [
            { Id: 201, UserCode: 'U001', RecordDate: '2026-07-09', Process: 'A' },
            { Id: 202, UserCode: 'U001', RecordDate: '2026/07/09', Process: 'A' },
            { Id: 203, UserCode: 'U002', RecordDate: '2026-07-10', Process: 'B' },
          ],
          fetchStatus: 'success',
        },
      ],
    ]);

    const [result] = scanAll([duplicateTarget], data);

    expect(result.duplicateCount).toBe(1);
    expect(result.duplicateIssues).toHaveLength(1);
    expect(result.duplicateIssues[0].keyValues).toEqual({
      UserCode: 'u001',
      RecordDate: '2026-07-09',
      Process: 'a',
    });
  });

  it('does not treat similar records with different process as duplicates', () => {
    const data = new Map<string, TargetData>([
      [
        'test-daily-dup',
        {
          items: [
            { Id: 301, UserCode: 'U001', RecordDate: '2026-07-09', Process: 'A' },
            { Id: 302, UserCode: 'U001', RecordDate: '2026-07-09', Process: 'B' },
          ],
          fetchStatus: 'success',
        },
      ],
    ]);

    const [result] = scanAll([duplicateTarget], data);

    expect(result.duplicateCount).toBe(0);
    expect(result.duplicateIssues).toHaveLength(0);
  });

  it('does not create duplicate flags only from missing key values when ignoreMissing is true', () => {
    const data = new Map<string, TargetData>([
      [
        'test-daily-dup',
        {
          items: [
            { Id: 401, UserCode: 'U001', RecordDate: '', Process: 'A' },
            { Id: 402, UserCode: '', RecordDate: '', Process: 'A' },
            { Id: 403, UserCode: '', RecordDate: '2026-07-09', Process: 'A' },
          ],
          fetchStatus: 'success',
        },
      ],
    ]);

    const [result] = scanAll([duplicateTarget], data);

    expect(result.duplicateCount).toBe(0);
    expect(result.duplicateIssues).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// skippedFields propagation
// ────────────────────────────────────────────────────────────────────────────

describe('skippedFields propagation in scanAll', () => {
  it('passes skippedFields from TargetData to ScanResult', () => {
    const data = new Map<string, TargetData>([
      ['test-users', { items: [validItem], fetchStatus: 'success', skippedFields: ['UserID'] }],
    ]);

    const [result] = scanAll([testTarget], data);

    expect(result.skippedFields).toEqual(['UserID']);
  });

  it('ScanResult.skippedFields is undefined when TargetData has no skippedFields', () => {
    const data = new Map<string, TargetData>([
      ['test-users', { items: [validItem], fetchStatus: 'success' }],
    ]);

    const [result] = scanAll([testTarget], data);

    expect(result.skippedFields).toBeUndefined();
  });

  it('preserves empty skippedFields array as-is', () => {
    const data = new Map<string, TargetData>([
      ['test-users', { items: [validItem], fetchStatus: 'success', skippedFields: [] }],
    ]);

    const [result] = scanAll([testTarget], data);

    expect(result.skippedFields).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// formatScanSummary
// ────────────────────────────────────────────────────────────────────────────

describe('formatScanSummary', () => {
  it('generates clean report for all-valid data', () => {
    const results = scanAll(
      [testTarget],
      new Map<string, TargetData>([['test-users', { items: [validItem], fetchStatus: 'success' }]]),
    );

    const summary = formatScanSummary(results);
    expect(summary).toContain('1件中 1件 OK / 0件 エラー');
    expect(summary).toContain('すべてのデータが正常');
  });

  it('generates report with error details for invalid data', () => {
    const results = scanAll(
      [testTarget],
      new Map<string, TargetData>([['test-users', { items: [validItem, invalidItem], fetchStatus: 'success' }]]),
    );

    const summary = formatScanSummary(results);
    expect(summary).toContain('2件中 1件 OK / 1件 エラー');
    expect(summary).toContain('ID 2');
    expect(summary).toContain('不整合データが見つかりました');
    expect(summary).toContain(DUPLICATE_REPORT_TEXT.possible);
  });

  it('includes ⚠ 列スキップ line when skippedFields are present', () => {
    const results = scanAll(
      [testTarget],
      new Map<string, TargetData>([
        ['test-users', { items: [validItem], fetchStatus: 'success', skippedFields: ['UserID', 'Email'] }],
      ]),
    );

    const summary = formatScanSummary(results);
    expect(summary).toContain('⚠ 列スキップ: UserID, Email');
  });

  it('omits ⚠ 列スキップ line when skippedFields is absent', () => {
    const results = scanAll(
      [testTarget],
      new Map<string, TargetData>([['test-users', { items: [validItem], fetchStatus: 'success' }]]),
    );

    const summary = formatScanSummary(results);
    expect(summary).not.toContain('列スキップ');
  });
});
