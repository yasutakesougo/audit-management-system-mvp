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
    it('should detect orphan_parent when parent has version but no children', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 1 }
      ];
      const children: ScanSourceChild[] = []; // v1の子がいない

      const results = scanDailyRecordIntegrity(parents, children, now);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('orphan_parent');
      expect(results[0].severity).toBe('error');
    });

    it('should detect version_mismatch when ghost records exist beyond latestVersion', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 1 }
      ];
      const children: ScanSourceChild[] = [
        { parentId: '1', userId: 'U1', version: 1, status: 'committed', recordedAt: '2026-03-30T09:00:00Z' },
        { parentId: '1', userId: 'U1', version: 2, status: 'committed', recordedAt: '2026-03-30T09:05:00Z' } // ゴースト！
      ];

      const results = scanDailyRecordIntegrity(parents, children, now);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('version_mismatch');
      expect(results[0].details).toContain('Ghost records found');
    });

    it('should detect stale_pending for records stuck in progress', () => {
      const parents: ScanSourceParent[] = [];
      const children: ScanSourceChild[] = [
        { 
          parentId: '1', 
          userId: 'U1', 
          version: 1, 
          status: 'pending', 
          recordedAt: '2026-03-30T09:40:00Z' // 20分前 (閾値10分)
        }
      ];

      const results = scanDailyRecordIntegrity(parents, children, now);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('stale_pending');
      expect(results[0].severity).toBe('warning');
    });

    it('should return empty when integrity is healthy', () => {
      const parents: ScanSourceParent[] = [
        { id: '1', date: '2026-03-30', latestVersion: 1 }
      ];
      const children: ScanSourceChild[] = [
        { parentId: '1', userId: 'U1', version: 1, status: 'committed', recordedAt: '2026-03-30T09:55:00Z' }
      ];

      const results = scanDailyRecordIntegrity(parents, children, now);
      
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
