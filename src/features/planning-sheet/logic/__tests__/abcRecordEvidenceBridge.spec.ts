import { describe, it, expect } from 'vitest';
import {
  buildAbcEvidenceEvaluationDraft,
  getAbcOriginLabel
} from '../abcRecordEvidenceBridge';
import type { AbcRecord } from '@/domain/abc/abcRecord';

// テスト用モックレコード作成ヘルパー
function createMockRecord(overrides: Partial<AbcRecord> = {}): AbcRecord {
  return {
    id: 'rec_1',
    userId: 'user_abc',
    userName: '山田 太郎',
    occurredAt: '2026-05-15T10:00:00Z',
    setting: 'デイルーム',
    antecedent: '他利用者が大声を出した',
    behavior: '耳を塞いで大声を出す',
    consequence: '静かな個室へ移動して落ち着く',
    intensity: 'medium',
    durationMinutes: 5,
    riskFlag: false,
    recorderName: '支援員A',
    tags: ['大声'],
    notes: 'テスト用のメモです',
    createdAt: '2026-05-15T10:05:00Z',
    ...overrides
  };
}

describe('abcRecordEvidenceBridge', () => {
  describe('getAbcOriginLabel', () => {
    it('should resolve daily-support correctly', () => {
      const rec = createMockRecord({
        sourceContext: { source: 'daily-support', slotId: '09:30|朝の準備' }
      });
      expect(getAbcOriginLabel(rec)).toBe('支援手順起点');
    });

    it('should resolve kiosk support standalone correctly', () => {
      const rec = createMockRecord({
        sourceContext: { source: 'standalone', returnUrl: '/kiosk?user=1' }
      });
      expect(getAbcOriginLabel(rec)).toBe('キオスク・支援手順起点');
    });

    it('should resolve standard standalone correctly', () => {
      const rec = createMockRecord({
        sourceContext: { source: 'standalone', returnUrl: '/abc-list' }
      });
      expect(getAbcOriginLabel(rec)).toBe('専用ABC画面起点');
    });

    it('should resolve missing sourceContext as unidentified correctly', () => {
      const rec = createMockRecord();
      expect(getAbcOriginLabel(rec)).toBe('由来不明/旧データ');
    });
  });

  describe('buildAbcEvidenceEvaluationDraft', () => {
    const period = { from: '2026-05-01', to: '2026-07-30' };

    it('should safely return draft when records is empty', () => {
      const draft = buildAbcEvidenceEvaluationDraft({ records: [], period });
      expect(draft.metadata.totalRecords).toBe(0);
      expect(draft.evaluationMethod).toContain('対象期間内に評価ドラフト生成に利用できるDedicated ABC記録は確認されていない。');
      expect(draft.improvementResult).toContain('対象期間内にDedicated ABC記録は確認されていないため');
      expect(draft.nextSupport).toContain('必要に応じて、今後の支援場面でABC記録を継続的に蓄積');
    });

    it('should exclude records where isDeleted is true', () => {
      const records = [
        createMockRecord({ id: '1', isDeleted: true }),
        createMockRecord({ id: '2', isDeleted: false })
      ];
      const draft = buildAbcEvidenceEvaluationDraft({ records, period });
      expect(draft.metadata.totalRecords).toBe(1);
    });

    it('should include from and to dates and total counts in evaluationMethod', () => {
      const records = [
        createMockRecord({
          id: '1',
          sourceContext: { source: 'daily-support' }
        })
      ];
      const draft = buildAbcEvidenceEvaluationDraft({ records, period });
      expect(draft.evaluationMethod).toContain('2026-05-01');
      expect(draft.evaluationMethod).toContain('2026-07-30');
      expect(draft.evaluationMethod).toContain('総数1件');
      expect(draft.evaluationMethod).toContain('支援手順起点 1件');
    });

    it('should add provisional warning to evaluationMethod when isProvisional is true', () => {
      const draft = buildAbcEvidenceEvaluationDraft({
        records: [],
        period: { ...period, isProvisional: true }
      });
      expect(draft.evaluationMethod).toContain('なお、本評価期間は支援開始日が未確定のため、適用開始日をもとに暫定算出している。');
    });

    it('should extract correct metadata and draft summaries with a mix of records', () => {
      const records = [
        createMockRecord({
          id: '1',
          intensity: 'high',
          riskFlag: true,
          antecedent: '他利用者が大声を出した',
          behavior: '耳を塞いで大声を出す',
          consequence: '個室移動',
          sourceContext: { source: 'daily-support', slotLabel: '朝の会' }
        }),
        createMockRecord({
          id: '2',
          intensity: 'medium',
          antecedent: '他利用者が大声を出した',
          behavior: '耳を塞いで大声を出す',
          consequence: '個室移動',
          sourceContext: { source: 'daily-support', slotLabel: '朝の会' }
        }),
        createMockRecord({
          id: '3',
          intensity: 'low',
          antecedent: '活動の切り替え',
          behavior: '自傷行動',
          consequence: '声かけで落ち着く',
          sourceContext: { source: 'standalone', returnUrl: '/kiosk' }
        })
      ];

      const draft = buildAbcEvidenceEvaluationDraft({ records, period });

      // メタデータ確認
      expect(draft.metadata.totalRecords).toBe(3);
      expect(draft.metadata.riskRecordsCount).toBe(1);
      expect(draft.metadata.byIntensity).toEqual([
        { label: '重度', count: 1 },
        { label: '中度', count: 1 },
        { label: '軽度', count: 1 }
      ]);
      expect(draft.metadata.topBehaviors[0].text).toBe('耳を塞いで大声を出す');
      expect(draft.metadata.topBehaviors[0].count).toBe(2);
      expect(draft.metadata.topSlots[0].slotLabel).toBe('朝の会');
      expect(draft.metadata.topSlots[0].count).toBe(2);

      // ドラフト文面確認 (断定禁止 & 客観表現)
      expect(draft.improvementResult).toContain('耳を塞いで大声を出す');
      expect(draft.improvementResult).toContain('朝の会');
      expect(draft.improvementResult).toContain('可能性が示唆されるため');
      expect(draft.improvementResult).not.toContain('著しく有効');
      expect(draft.improvementResult).not.toContain('証明された');

      // 優先支援文面の確認
      expect(draft.nextSupport).toContain('重度の行動や危険を伴う行動が確認されているため');
      expect(draft.nextSupport).toContain('朝の会');
    });

    it('should aggregate slotId without slotLabel as slotId split value or fallback correctly', () => {
      const records = [
        createMockRecord({
          id: '1',
          sourceContext: { source: 'daily-support', slotId: '13:00|午後の活動' }
        })
      ];
      const draft = buildAbcEvidenceEvaluationDraft({ records, period });
      expect(draft.metadata.topSlots[0].slotLabel).toBe('午後の活動');
    });

    it('should group records without slotId under "その他のABC記録（時間枠なし）"', () => {
      const records = [
        createMockRecord({
          id: '1' // sourceContextなし
        })
      ];
      const draft = buildAbcEvidenceEvaluationDraft({ records, period });
      expect(draft.metadata.topSlots[0].slotLabel).toBe('その他のABC記録（時間枠なし）');
    });

    it('should strictly avoid assertive/banned words in draft texts', () => {
      const records = [
        createMockRecord({ intensity: 'medium', antecedent: 'A', behavior: 'B', consequence: 'C' })
      ];
      const draft = buildAbcEvidenceEvaluationDraft({ records, period });

      const bannedWords = [
        '著しく有効',
        '証明された',
        '改善した',
        '原因は',
        '必ず'
      ];

      for (const word of bannedWords) {
        expect(draft.improvementResult).not.toContain(word);
        expect(draft.nextSupport).not.toContain(word);
      }

      // 許容・推奨されている表現が含まれることを確認
      expect(draft.improvementResult).toContain('可能性が示唆される');
      expect(draft.improvementResult).toContain('確認する');
    });
  });
});
