import { describe, it, expect } from 'vitest';
import {
  scanDailyRecordIntegrity,
  mapIntegrityToExceptionItem,
  ScanSourceParent,
  ScanSourceChild
} from '../dailyIntegrityChecker';

describe('dailyIntegrityChecker', () => {
  const now = new Date('2026-03-30T10:00:00Z');

  describe('scanDailyRecordIntegrity', () => {
    it('should detect orphan_parent when LatestVersion+LatestCommitId has no matching children', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 1, latestCommitId: 'commit-1' }
      ];
      const children: ScanSourceChild[] = [];

      const results = scanDailyRecordIntegrity(parents, children, [], now);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('orphan_parent');
      expect(results[0].severity).toBe('error');
      expect(results[0].details).toContain('CommitId commit-1');
    });

    it('AC-14: Version > LatestVersion ghost', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 1, latestCommitId: 'commit-1' }
      ];
      const children: ScanSourceChild[] = [
        { parentId: '1', userId: 'U1', version: 1, commitId: 'commit-1', status: 'committed', recordedAt: '2026-03-30T09:00:00Z' },
        { parentId: '1', userId: 'U1', version: 2, commitId: 'failed-A', status: 'committed', recordedAt: '2026-03-30T09:05:00Z' },
      ];

      const accessories = [{ type: 'transport' as const, userId: 'U1' }];
      const results = scanDailyRecordIntegrity(parents, children, accessories, now);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('version_mismatch');
      expect(results[0].details).toContain('Version ghost records found');
    });

    it('AC-14: Version == LatestVersion but CommitId != LatestCommitId', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 5, latestCommitId: 'retry-B', userCount: 1 }
      ];
      const children: ScanSourceChild[] = [
        { parentId: '1', userId: 'U1', version: 5, commitId: 'retry-B', status: 'completed', recordedAt: '2026-03-30T09:10:00Z' },
        { parentId: '1', userId: 'U1', version: 5, commitId: 'failed-A', status: 'completed', recordedAt: '2026-03-30T09:00:00Z' },
      ];

      const accessories = [{ type: 'transport' as const, userId: 'U1' }];
      const results = scanDailyRecordIntegrity(parents, children, accessories, now);

      expect(results.map((item) => item.type)).toContain('version_mismatch');
      expect(results.find((item) => item.type === 'version_mismatch')?.details).toContain('CommitId ghost');
      expect(results.find((item) => item.type === 'version_mismatch')?.details).toContain('failed-A');
    });

    it('AC-14: duplicate identity inside current Version + CommitId', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 2, latestCommitId: 'commit-2', userCount: 2 }
      ];
      const children: ScanSourceChild[] = [
        { parentId: '1', userId: 'U1', version: 2, commitId: 'commit-2', status: 'completed', recordedAt: '2026-03-30T09:00:00Z' },
        { parentId: '1', userId: 'U1', version: 2, commitId: 'commit-2', status: 'completed', recordedAt: '2026-03-30T09:00:01Z' },
      ];

      const accessories = [{ type: 'transport' as const, userId: 'U1' }];
      const results = scanDailyRecordIntegrity(parents, children, accessories, now);

      expect(results.map((item) => item.type)).toContain('version_mismatch');
      expect(results.find((item) => item.type === 'version_mismatch')?.details).toContain('Duplicate current identity');
    });

    it('AC-14: LatestVersion > 0 but LatestCommitId missing', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 5, latestCommitId: null }
      ];
      const children: ScanSourceChild[] = [
        { parentId: '1', userId: 'U1', version: 5, commitId: 'any', status: 'completed', recordedAt: '2026-03-30T09:00:00Z' },
      ];

      const accessories = [{ type: 'transport' as const, userId: 'U1' }];
      const results = scanDailyRecordIntegrity(parents, children, accessories, now);

      expect(results.map((item) => item.type)).toContain('version_mismatch');
      expect(results.find((item) => item.type === 'version_mismatch')?.details).toContain('LatestCommitId is missing');
    });

    it('should detect stale_pending for records stuck in progress', () => {
      const parents: ScanSourceParent[] = [];
      const children: ScanSourceChild[] = [
        {
          parentId: '1',
          userId: 'U1',
          version: 1,
          commitId: 'c1',
          status: 'pending',
          recordedAt: '2026-03-30T09:40:00Z'
        }
      ];

      const accessories = [{ type: 'transport' as const, userId: 'U1' }];
      const results = scanDailyRecordIntegrity(parents, children, accessories, now);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('stale_pending');
      expect(results[0].severity).toBe('warning');
    });

    it('Test E / AC-14: current count uses LatestVersion+LatestCommitId only (ignores commit/version ghosts)', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 5, latestCommitId: 'A', userCount: 2 }
      ];
      const children: ScanSourceChild[] = [
        { parentId: '1', userId: 'U1', version: 5, commitId: 'A', status: 'completed', recordedAt: '2026-03-30T09:10:00Z' },
        { parentId: '1', userId: 'U2', version: 5, commitId: 'A', status: 'completed', recordedAt: '2026-03-30T09:10:00Z' },
        { parentId: '1', userId: 'U1', version: 5, commitId: 'B', status: 'completed', recordedAt: '2026-03-30T09:09:00Z' },
        { parentId: '1', userId: 'U2', version: 5, commitId: 'B', status: 'completed', recordedAt: '2026-03-30T09:09:00Z' },
        { parentId: '1', userId: 'U1', version: 4, commitId: 'X', status: 'completed', recordedAt: '2026-03-30T09:00:00Z' },
      ];

      const accessories = [
        { type: 'transport' as const, userId: 'U1' },
        { type: 'transport' as const, userId: 'U2' },
      ];
      const results = scanDailyRecordIntegrity(parents, children, accessories, now);

      // Current identity count = 2 → no count_mismatch. CommitId B rows are ghosts.
      expect(results.map((item) => item.type)).not.toContain('count_mismatch');
      expect(results.map((item) => item.type)).not.toContain('orphan_parent');
      expect(results.find((item) => item.type === 'version_mismatch')?.details).toContain('CommitId ghost');
      expect(results.find((item) => item.type === 'version_mismatch')?.details).toContain('B');
    });

    it('should detect count_mismatch against current Version+CommitId children only', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 2, latestCommitId: 'commit-2', userCount: 1 }
      ];
      const children: ScanSourceChild[] = [
        { parentId: '1', userId: 'U1', version: 1, commitId: 'commit-1', status: 'completed', recordedAt: '2026-03-30T09:00:00Z' },
        { parentId: '1', userId: 'U2', version: 1, commitId: 'commit-1', status: 'completed', recordedAt: '2026-03-30T09:00:00Z' },
        { parentId: '1', userId: 'U1', version: 2, commitId: 'commit-2', status: 'completed', recordedAt: '2026-03-30T09:10:00Z' },
        { parentId: '1', userId: 'U9', version: 2, commitId: 'failed-A', status: 'completed', recordedAt: '2026-03-30T09:09:00Z' },
      ];

      const accessories = [
        { type: 'transport' as const, userId: 'U1' },
        { type: 'transport' as const, userId: 'U2' },
        { type: 'transport' as const, userId: 'U9' },
      ];
      const results = scanDailyRecordIntegrity(parents, children, accessories, now);

      // CommitId ghost for failed-A, but count against current should be healthy (1).
      expect(results.map((item) => item.type)).toContain('version_mismatch');
      expect(results.map((item) => item.type)).not.toContain('count_mismatch');
    });

    it('should detect count_mismatch when current identity count differs from UserCount', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 2, latestCommitId: 'commit-2', userCount: 5 }
      ];
      const children: ScanSourceChild[] = [
        { parentId: '1', userId: 'U1', version: 2, commitId: 'commit-2', status: 'completed', recordedAt: '2026-03-30T09:10:00Z' },
        { parentId: '1', userId: 'U2', version: 2, commitId: 'commit-2', status: 'completed', recordedAt: '2026-03-30T09:10:00Z' },
      ];

      const accessories = [
        { type: 'transport' as const, userId: 'U1' },
        { type: 'transport' as const, userId: 'U2' },
      ];
      const results = scanDailyRecordIntegrity(parents, children, accessories, now);

      expect(results.map((item) => item.type)).toContain('count_mismatch');
      expect(results.find((item) => item.type === 'count_mismatch')?.details).toContain('current-version');
    });

    it('Test 5: LatestVersion 0 legacy does not require CommitId', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 0, userCount: 1 }
      ];
      const children: ScanSourceChild[] = [
        { parentId: '1', userId: 'U1', version: 0, status: 'completed', recordedAt: '2026-03-30T09:00:00Z' }
      ];

      const accessories = [{ type: 'transport' as const, userId: 'U1' }];
      const results = scanDailyRecordIntegrity(parents, children, accessories, now);

      expect(results).toHaveLength(0);
    });

    it('should return empty when integrity is healthy', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 1, latestCommitId: 'commit-1' }
      ];
      const children: ScanSourceChild[] = [
        { parentId: '1', userId: 'U1', version: 1, commitId: 'commit-1', status: 'committed', recordedAt: '2026-03-30T09:55:00Z' }
      ];

      const accessories = [{ type: 'transport' as const, userId: 'U1' }];
      const results = scanDailyRecordIntegrity(parents, children, accessories, now);

      expect(results).toHaveLength(0);
    });
  });

  describe('mapIntegrityToExceptionItem', () => {
    it('should map DailyIntegrityException to ExceptionItem correctly', () => {
      const exc = {
        type: 'orphan_parent' as const,
        date: '2026-03-30',
        parentId: '1',
        details: 'Test details',
        severity: 'error' as const,
        detectedAt: now.toISOString(),
      };

      const item = mapIntegrityToExceptionItem(exc);

      expect(item.category).toBe('data-os-alert');
      expect(item.severity).toBe('high');
      expect(item.title).toContain('整合性異常');
      expect(item.description).toContain('2026-03-30');
      expect(item.actionLabel).toBe('詳細データを修復');
    });
  });
});
