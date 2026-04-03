/**
 * createTimelineDataFetcher — フェッチャーユニットテスト
 *
 * Repository モックを使って、各ソースの取得・変換・エラー耐性を検証する。
 */

import { describe, it, expect, vi } from 'vitest';
import { createTimelineDataFetcher } from '../createTimelineDataFetcher';
import type { DailyRecordRepository, DailyRecordItem } from '@/features/daily/domain/legacy/DailyRecordRepository';
import type { IncidentRepository, IncidentRecord } from '@/domain/support/incidentRepository';
import type { IspRepository } from '@/domain/isp/port';
import type { IspListItem } from '@/domain/isp/schema';
import type { HandoffRepository } from '@/features/handoff/domain/HandoffRepository';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';

// ─────────────────────────────────────────────
// テストヘルパー
// ─────────────────────────────────────────────

function makeDailyItem(overrides: Partial<DailyRecordItem> = {}): DailyRecordItem {
  return {
    date: '2026-03-15',
    reporter: { name: 'テスト太郎', role: '支援員' },
    userRows: [
      {
        userId: 'user-1',
        userName: '利用者A',
        amActivity: '午前活動',
        pmActivity: '午後活動',
        lunchAmount: '完食',
        problemBehavior: {
          selfHarm: false,
          otherInjury: false,
          loudVoice: false,
          pica: false,
          other: false,
        },
        specialNotes: 'テストメモ',
        behaviorTags: [],
      },
      {
        userId: 'user-2',
        userName: '利用者B',
        amActivity: '別の活動',
        pmActivity: '',
        lunchAmount: '',
        problemBehavior: {
          selfHarm: false,
          otherInjury: false,
          loudVoice: false,
          pica: false,
          other: false,
        },
        specialNotes: '',
        behaviorTags: [],
      },
    ],
    userCount: overrides.userRows?.length ?? 2,
    ...overrides,
  };
}

function makeIncidentRecord(userId: string): IncidentRecord {
  return {
    id: 'inc-1',
    userId,
    description: '事故の詳細',
    occurredAt: '2026-03-15T10:00:00',
    severity: '中',
    reportedAt: '2026-03-15T10:30:00',
    reportedBy: '報告者',
    incidentType: 'behavior',
    immediateResponse: '即時対応',
    relatedStaff: ['スタッフA'],
    outcome: '結果',
    followUpRequired: false,
  };
}

function makeIspListItem(userId: string): IspListItem {
  return {
    id: 'isp-1',
    userId,
    title: 'ISP テスト',
    planStartDate: '2026-01-01',
    planEndDate: '2026-12-31',
    status: 'active',
    isCurrent: true,
    nextReviewAt: null,
  };
}

function makeHandoffRecord(): HandoffRecord {
  return {
    id: 1,
    title: 'テスト申し送り',
    userCode: 'UC001',
    userDisplayName: '利用者A',
    category: '体調',
    severity: '通常',
    timeBand: '午前',
    message: 'テスト申し送り',
    status: '未対応',
    createdAt: '2026-03-15T08:00:00',
    createdByName: '作成者',
    isDraft: false,
  };
}

// ─────────────────────────────────────────────
// テスト
// ─────────────────────────────────────────────

describe('createTimelineDataFetcher', () => {
  it('Repository 未指定なら全ソース空配列を返す', async () => {
    const fetcher = createTimelineDataFetcher({});
    const result = await fetcher('user-1');

    expect(result.dailyRecords).toEqual([]);
    expect(result.incidents).toEqual([]);
    expect(result.ispRecords).toEqual([]);
    expect(result.handoffRecords).toEqual([]);
    expect(result.rawHandoffCount).toBe(0);
  });

  describe('Daily', () => {
    it('指定 userId の行だけ抽出する', async () => {
      const dailyRepo: DailyRecordRepository = {
        list: vi.fn().mockResolvedValue([makeDailyItem({ id: '100' })]),
        load: vi.fn(),
        save: vi.fn(),
        approve: vi.fn(),
        scanIntegrity: vi.fn().mockResolvedValue([]),
      };

      const fetcher = createTimelineDataFetcher({ dailyRepo });
      const result = await fetcher('user-1');

      // user-1 の行だけ抽出される（user-2 は除外）
      expect(result.dailyRecords).toHaveLength(1);
      expect(result.dailyRecords![0].userId).toBe('user-1');
      expect(result.dailyRecords![0].kind).toBe('A');
      expect(result.dailyRecords![0].date).toBe('2026-03-15');
    });

    it('DailyRecordUserRow → PersonDaily の変換が正しい', async () => {
      const dailyRepo: DailyRecordRepository = {
        list: vi.fn().mockResolvedValue([makeDailyItem({ id: '200' })]),
        load: vi.fn(),
        save: vi.fn(),
        approve: vi.fn(),
        scanIntegrity: vi.fn().mockResolvedValue([]),
      };

      const fetcher = createTimelineDataFetcher({ dailyRepo });
      const result = await fetcher('user-1');
      const daily = result.dailyRecords![0];

      expect(daily.kind).toBe('A');
      if (daily.kind === 'A') {
        expect(daily.data.amActivities).toEqual(['午前活動']);
        expect(daily.data.pmActivities).toEqual(['午後活動']);
        expect(daily.data.specialNotes).toBe('テストメモ');
      }
    });

    it('Daily 取得エラー時は空配列を返しログ出力する', async () => {
      const dailyRepo: DailyRecordRepository = {
        list: vi.fn().mockRejectedValue(new Error('API Error')),
        load: vi.fn(),
        save: vi.fn(),
        approve: vi.fn(),
        scanIntegrity: vi.fn().mockResolvedValue([]),
      };

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetcher = createTimelineDataFetcher({ dailyRepo });
      const result = await fetcher('user-1');

      expect(result.dailyRecords).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        '[Timeline] Daily fetch failed:',
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  describe('Incident', () => {
    it('userId で取得されたインシデントを返す', async () => {
      const incidentRepo: IncidentRepository = {
        getByUserId: vi.fn().mockResolvedValue([makeIncidentRecord('user-1')]),
        getAll: vi.fn(),
        getById: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      };

      const fetcher = createTimelineDataFetcher({ incidentRepo });
      const result = await fetcher('user-1');

      expect(result.incidents).toHaveLength(1);
      expect(result.incidents![0].userId).toBe('user-1');
    });

    it('Incident 取得エラー時は空配列を返す', async () => {
      const incidentRepo: IncidentRepository = {
        getByUserId: vi.fn().mockRejectedValue(new Error('DB Error')),
        getAll: vi.fn(),
        getById: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      };

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetcher = createTimelineDataFetcher({ incidentRepo });
      const result = await fetcher('user-1');

      expect(result.incidents).toEqual([]);
      warnSpy.mockRestore();
    });
  });

  describe('ISP', () => {
    it('userId で取得された ISP を返す', async () => {
      const ispRepo = {
        listByUser: vi.fn().mockResolvedValue([makeIspListItem('user-1')]),
        getById: vi.fn(),
        getCurrentByUser: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      } as unknown as IspRepository;

      const fetcher = createTimelineDataFetcher({ ispRepo });
      const result = await fetcher('user-1');

      expect(result.ispRecords).toHaveLength(1);
    });

    it('ISP 取得エラー時は空配列を返す', async () => {
      const ispRepo = {
        listByUser: vi.fn().mockRejectedValue(new Error('SP Error')),
        getById: vi.fn(),
        getCurrentByUser: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      } as unknown as IspRepository;

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetcher = createTimelineDataFetcher({ ispRepo });
      const result = await fetcher('user-1');

      expect(result.ispRecords).toEqual([]);
      warnSpy.mockRestore();
    });
  });

  describe('Handoff', () => {
    it('全 Handoff レコードと rawHandoffCount を返す', async () => {
      const handoffRepo: HandoffRepository = {
        getRecords: vi.fn().mockResolvedValue([makeHandoffRecord(), makeHandoffRecord()]),
        createRecord: vi.fn(),
        updateStatus: vi.fn(),
      };

      const fetcher = createTimelineDataFetcher({ handoffRepo });
      const result = await fetcher('user-1');

      expect(result.handoffRecords).toHaveLength(2);
      expect(result.rawHandoffCount).toBe(2);
    });

    it('Handoff 取得エラー時は空配列と rawHandoffCount=0 を返す', async () => {
      const handoffRepo: HandoffRepository = {
        getRecords: vi.fn().mockRejectedValue(new Error('Network Error')),
        createRecord: vi.fn(),
        updateStatus: vi.fn(),
      };

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetcher = createTimelineDataFetcher({ handoffRepo });
      const result = await fetcher('user-1');

      expect(result.handoffRecords).toEqual([]);
      expect(result.rawHandoffCount).toBe(0);
      warnSpy.mockRestore();
    });
  });

  describe('複合', () => {
    it('全ソース接続時に各データが正しく返る', async () => {
      const dailyRepo: DailyRecordRepository = {
        list: vi.fn().mockResolvedValue([makeDailyItem({ id: '300' })]),
        load: vi.fn(),
        save: vi.fn(),
        approve: vi.fn(),
        scanIntegrity: vi.fn().mockResolvedValue([]),
      };

      const incidentRepo: IncidentRepository = {
        getByUserId: vi.fn().mockResolvedValue([makeIncidentRecord('user-1')]),
        getAll: vi.fn(),
        getById: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      };

      const ispRepo = {
        listByUser: vi.fn().mockResolvedValue([makeIspListItem('user-1')]),
        getById: vi.fn(),
        getCurrentByUser: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      } as unknown as IspRepository;

      const handoffRepo: HandoffRepository = {
        getRecords: vi.fn().mockResolvedValue([makeHandoffRecord()]),
        createRecord: vi.fn(),
        updateStatus: vi.fn(),
      };

      const fetcher = createTimelineDataFetcher({
        dailyRepo,
        incidentRepo,
        ispRepo,
        handoffRepo,
      });
      const result = await fetcher('user-1');

      expect(result.dailyRecords!.length).toBeGreaterThan(0);
      expect(result.incidents!.length).toBeGreaterThan(0);
      expect(result.ispRecords!.length).toBeGreaterThan(0);
      expect(result.handoffRecords!.length).toBeGreaterThan(0);
    });

    it('一部ソースがエラーでも他ソースは正常に返る', async () => {
      const dailyRepo: DailyRecordRepository = {
        list: vi.fn().mockRejectedValue(new Error('Daily Error')),
        load: vi.fn(),
        save: vi.fn(),
        approve: vi.fn(),
        scanIntegrity: vi.fn(),
      };

      const incidentRepo: IncidentRepository = {
        getByUserId: vi.fn().mockResolvedValue([makeIncidentRecord('user-1')]),
        getAll: vi.fn(),
        getById: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      };

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetcher = createTimelineDataFetcher({ dailyRepo, incidentRepo });
      const result = await fetcher('user-1');

      // Daily はエラーで空、Incident は正常
      expect(result.dailyRecords).toEqual([]);
      expect(result.incidents).toHaveLength(1);
      warnSpy.mockRestore();
    });
  });
});
