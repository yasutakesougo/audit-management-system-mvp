import { describe, it, expect } from 'vitest';
import { 
  isSystemField, 
  computeDeletionReason, 
  calculateIndexDiff 
} from '../spIndexLogic';
import { type IndexFieldSpec } from '../spIndexKnownConfig';

describe('spIndexLogic: Pure Logic Engine', () => {
  
  describe('isSystemField', () => {
    it('should identify system managed fields correctly', () => {
      expect(isSystemField('ID')).toBe(true);
      expect(isSystemField('Author')).toBe(true);
      expect(isSystemField('Created')).toBe(true);
      expect(isSystemField('_ModerationStatus')).toBe(true); // Starts with _
    });

    it('should identify custom fields as non-system fields', () => {
      expect(isSystemField('RecordDate')).toBe(false);
      expect(isSystemField('StaffName')).toBe(false);
      expect(isSystemField('CustomField_x0020_Name')).toBe(false);
    });
  });

  describe('computeDeletionReason', () => {
    it('should provide specific reason for Note types', () => {
      const reason = computeDeletionReason('Memos', 'Note');
      expect(reason).toContain('Note型はインデックス不可');
    });

    it('should flag JSON/Blob payloads by name', () => {
      const reason = computeDeletionReason('PayloadJSON', 'Text');
      expect(reason).toContain('大容量フィールド');
    });

    it('should suggest slot saving for memo/remark fields', () => {
      const reason = computeDeletionReason('InternalRemarks', 'Text');
      expect(reason).toContain('備考系フィールド');
    });

    it('should flag old/legacy fields', () => {
      const reason = computeDeletionReason('OldStatus', 'Text');
      expect(reason).toContain('旧フィールド');
    });
  });

  describe('calculateIndexDiff', () => {
    const mockRequiredSet: IndexFieldSpec[] = [
      { internalName: 'RecordDate', displayName: '記録日', reason: 'Filter' },
      { internalName: 'StaffName', displayName: 'スタッフ名', reason: 'Order' },
    ];

    it('should calculate additions and deletions correctly based on required set', () => {
      // Current indexed in raw are: ID (filtered), RecordDate, ObsoleteNote
      // Required are: RecordDate, StaffName
      
      const rawCurrent = [
        { InternalName: 'ID', Title: 'ID', TypeAsString: 'Counter' },
        { InternalName: 'RecordDate', Title: 'Record Date', TypeAsString: 'DateTime' },
        { InternalName: 'ObsoleteNote', Title: 'Obsolete Note', TypeAsString: 'Note' },
      ];

      const result = calculateIndexDiff(rawCurrent, mockRequiredSet);

      // 1. currentIndexed should exclude ID
      expect(result.currentIndexed.length).toBe(2);
      expect(result.currentIndexed.map(f => f.internalName)).toContain('RecordDate');
      expect(result.currentIndexed.map(f => f.internalName)).toContain('ObsoleteNote');

      // 2. deletionCandidates should be ObsoleteNote (indexed but not in required set)
      expect(result.deletionCandidates.length).toBe(1);
      expect(result.deletionCandidates[0].internalName).toBe('ObsoleteNote');
      expect(result.deletionCandidates[0].deletionReason).toContain('Note型');

      // 3. additionCandidates should be StaffName (required but not in current raw)
      expect(result.additionCandidates.length).toBe(1);
      expect(result.additionCandidates[0].internalName).toBe('StaffName');
    });

    it('should report no deletions if all current fields are required', () => {
      const rawCurrent = [
        { InternalName: 'RecordDate', Title: 'Record Date', TypeAsString: 'DateTime' },
      ];
      const result = calculateIndexDiff(rawCurrent, mockRequiredSet);
      expect(result.deletionCandidates.length).toBe(0);
    });

    it('should report no issues if raw and required match exactly', () => {
      const rawCurrent = [
        { InternalName: 'RecordDate', Title: 'Record Date', TypeAsString: 'DateTime' },
        { InternalName: 'StaffName', Title: 'Staff Name', TypeAsString: 'Text' },
      ];
      const result = calculateIndexDiff(rawCurrent, mockRequiredSet);
      expect(result.deletionCandidates.length).toBe(0);
      expect(result.additionCandidates.length).toBe(0);
    });

    it('should return empty candidates if requiredSet is missing (fail-open)', () => {
      const result = calculateIndexDiff([], undefined);
      expect(result.deletionCandidates).toEqual([]);
      expect(result.additionCandidates).toEqual([]);
    });
  });

  describe('Architectural Contracts', () => {
    it('should be pure and side-effect free (Static Analysis)', async () => {
      // 外部依存を文字列レベルで検知し、Contract（憲章）を守らせる
      const fs = await import('fs');
      const path = await import('path');
      const logicSource = fs.readFileSync(path.resolve(__dirname, '../spIndexLogic.ts'), 'utf8');
      
      const prohibitedKeywords = ['fetch', 'spClient', 'window', 'document', 'localStorage'];
      prohibitedKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`);
        expect(logicSource).not.toMatch(regex);
      });
    });
  });
});
