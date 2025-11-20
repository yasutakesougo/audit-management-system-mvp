import { describe, expect, it } from 'vitest';
import type { PersonDaily } from '../../../domain/daily/types';
import { buildActivitySummary } from '../activitySummary';

// Helper function to create mock PersonDaily records
const createMockPersonDaily = (overrides: Partial<PersonDaily> = {}): PersonDaily => ({
  id: 1,
  personId: '001',
  personName: '田中太郎',
  date: new Date().toISOString().split('T')[0],
  status: '完了',
  reporter: { name: '職員A' },
  draft: { isDraft: false },
  kind: 'A',
  data: {
    amActivities: ['散歩'],
    pmActivities: ['読書'],
    amNotes: '順調',
    pmNotes: '問題なし',
    mealAmount: '完食',
    problemBehavior: { selfHarm: false, violence: false, loudVoice: false, pica: false, other: false, otherDetail: '' },
    seizureRecord: { occurred: false, time: '', duration: '', severity: undefined, notes: '' },
    specialNotes: ''
  },
  ...overrides
});

describe('buildActivitySummary', () => {
  const today = new Date().toISOString().split('T')[0];

  describe('基本的な集計機能', () => {
    it('完了/作成中/未作成を正しく集計する', () => {
      const records: PersonDaily[] = [
        createMockPersonDaily({ id: 1, personId: '001', personName: '田中太郎', status: '完了' }),
        createMockPersonDaily({ id: 2, personId: '002', personName: '佐藤花子', status: '作成中' }),
        createMockPersonDaily({ id: 3, personId: '003', personName: '鈴木次郎', status: '未作成' }),
        createMockPersonDaily({ id: 4, personId: '004', personName: '高橋美咲', status: '完了' }),
      ];

      const result = buildActivitySummary(records, 4);

      expect(result.module.name).toBe('activity');
      expect(result.module.label).toBe('支援記録（ケース記録）');
      expect(result.module.total).toBe(4);
      expect(result.module.done).toBe(2); // 完了が2件
      expect(result.module.rate).toBe(50); // 2/4 = 50%
    });

    it('今日の記録のみをフィルタリングする', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const records: PersonDaily[] = [
        createMockPersonDaily({ id: 1, date: today, status: '完了' }),
        createMockPersonDaily({ id: 2, date: yesterdayStr, status: '完了' }), // 昨日の記録
        createMockPersonDaily({ id: 3, date: today, status: '未作成' }),
      ];

      const result = buildActivitySummary(records, 2);

      // 今日の記録のみカウント
      expect(result.module.total).toBe(2);
      expect(result.module.done).toBe(1);
      expect(result.module.rate).toBe(50);
    });

    it('記録が0件の場合を処理する', () => {
      const result = buildActivitySummary([], 0);

      expect(result.module.total).toBe(0);
      expect(result.module.done).toBe(0);
      expect(result.module.rate).toBe(0);
      expect(result.alerts).toHaveLength(0);
    });

    it('expectedCountが記録数より大きい場合はexpectedCountを使用する', () => {
      const records: PersonDaily[] = [
        createMockPersonDaily({ id: 1, status: '完了' }),
        createMockPersonDaily({ id: 2, status: '未作成' }),
      ];

      const result = buildActivitySummary(records, 5);

      expect(result.module.total).toBe(5); // expectedCountを使用
      expect(result.module.done).toBe(1);
      expect(result.module.rate).toBe(20); // 1/5 = 20%
    });
  });

  describe('アラート生成機能', () => {
    it('未作成が1件の場合はwarning alertを生成する', () => {
      const records: PersonDaily[] = [
        createMockPersonDaily({ id: 1, status: '完了' }),
        createMockPersonDaily({ id: 2, status: '未作成' }),
        createMockPersonDaily({ id: 3, status: '作成中' }),
      ];

      const result = buildActivitySummary(records, 3);

      // 未作成が1件でもアラートあり
      const missingAlerts = result.alerts.filter(a => a.id === 'activity-missing');
      expect(missingAlerts).toHaveLength(1);
      expect(missingAlerts[0].severity).toBe('warning');
    });

    it('未作成が3-5件の場合はwarning alertを生成する', () => {
      const records: PersonDaily[] = [
        createMockPersonDaily({ id: 1, personId: '001', personName: '田中太郎', status: '未作成' }),
        createMockPersonDaily({ id: 2, personId: '002', personName: '佐藤花子', status: '未作成' }),
        createMockPersonDaily({ id: 3, personId: '003', personName: '鈴木次郎', status: '未作成' }),
        createMockPersonDaily({ id: 4, personId: '004', personName: '高橋美咲', status: '完了' }),
      ];

      const result = buildActivitySummary(records, 4);

      const missingAlert = result.alerts.find(a => a.id === 'activity-missing');
      expect(missingAlert).toBeDefined();
      expect(missingAlert!.severity).toBe('warning');
      expect(missingAlert!.module).toBe('activity');
      expect(missingAlert!.title).toBe('支援記録（ケース記録） 未作成 3件');
      expect(missingAlert!.message).toContain('田中太郎（001）、佐藤花子（002）、鈴木次郎（003）');
      expect(missingAlert!.href).toBe('/daily/activity');
    });

    it('未作成が6件以上の場合はerror alertを生成する', () => {
      const records: PersonDaily[] = Array.from({ length: 8 }, (_, i) =>
        createMockPersonDaily({
          id: i + 1,
          personId: String(i + 1).padStart(3, '0'),
          personName: `利用者${i + 1}`,
          status: i < 6 ? '未作成' : '完了'
        })
      );

      const result = buildActivitySummary(records, 8);

      const missingAlert = result.alerts.find(a => a.id === 'activity-missing');
      expect(missingAlert).toBeDefined();
      expect(missingAlert!.severity).toBe('error');
      expect(missingAlert!.title).toBe('支援記録（ケース記録） 未作成 6件');
    });

    it('作成中の記録がある場合はinfo alertを生成する', () => {
      const records: PersonDaily[] = [
        createMockPersonDaily({ id: 1, personId: '001', personName: '田中太郎', status: '作成中' }),
        createMockPersonDaily({ id: 2, personId: '002', personName: '佐藤花子', status: '作成中' }),
        createMockPersonDaily({ id: 3, personId: '003', personName: '鈴木次郎', status: '完了' }),
      ];

      const result = buildActivitySummary(records, 3);

      const inProgressAlert = result.alerts.find(a => a.id === 'activity-in-progress');
      expect(inProgressAlert).toBeDefined();
      expect(inProgressAlert!.severity).toBe('info');
      expect(inProgressAlert!.title).toBe('作成中 2件');
      expect(inProgressAlert!.message).toBe('作成中の支援記録（ケース記録）があります');
      expect(inProgressAlert!.href).toBe('/daily/activity');
    });

    it('未作成者のリストが5名を超える場合は上位5名のみ表示する', () => {
      const records: PersonDaily[] = Array.from({ length: 10 }, (_, i) =>
        createMockPersonDaily({
          id: i + 1,
          personId: String(i + 1).padStart(3, '0'),
          personName: `利用者${i + 1}`,
          status: i < 8 ? '未作成' : '完了'
        })
      );

      const result = buildActivitySummary(records, 10);

      const missingAlert = result.alerts.find(a => a.id === 'activity-missing');
      expect(missingAlert).toBeDefined();

      // メッセージに含まれる名前の数をカウント
      const nameCount = (missingAlert!.message.match(/利用者\d+/g) || []).length;
      expect(nameCount).toBeLessThanOrEqual(5);
    });

    it('複数のアラートが同時に生成される', () => {
      const records: PersonDaily[] = [
        createMockPersonDaily({ id: 1, status: '未作成' }),
        createMockPersonDaily({ id: 2, status: '未作成' }),
        createMockPersonDaily({ id: 3, status: '未作成' }),
        createMockPersonDaily({ id: 4, status: '作成中' }),
        createMockPersonDaily({ id: 5, status: '完了' }),
      ];

      const result = buildActivitySummary(records, 5);

      expect(result.alerts).toHaveLength(2);
      expect(result.alerts.some(a => a.id === 'activity-missing')).toBe(true);
      expect(result.alerts.some(a => a.id === 'activity-in-progress')).toBe(true);
    });
  });

  describe('エッジケース', () => {
    it('期待数が0の場合はtotalに記録数を使用する', () => {
      const records: PersonDaily[] = [
        createMockPersonDaily({ id: 1, status: '完了' }),
      ];

      const result = buildActivitySummary(records, 0);

      expect(result.module.total).toBe(1); // records.lengthを使用
    });

    it('すべて完了の場合はアラートが生成されない', () => {
      const records: PersonDaily[] = [
        createMockPersonDaily({ id: 1, status: '完了' }),
        createMockPersonDaily({ id: 2, status: '完了' }),
        createMockPersonDaily({ id: 3, status: '完了' }),
      ];

      const result = buildActivitySummary(records, 3);

      expect(result.alerts).toHaveLength(0);
      expect(result.module.rate).toBe(100);
    });
  });
});