/**
 * handoffApi.spec.ts
 *
 * HandoffApi — SharePoint API ラッパーのユニットテスト
 *
 * テスト戦略:
 * - createHandoffApi(sp) ファクトリ経由で実インスタンスを取得
 * - UseSP の spFetch / getListFieldInternalNames をモックし、
 *   HTTP レベルでレスポンスを制御
 * - 各テストで HandoffApi を new するためキャッシュが自動的にリセットされる
 *
 * テスト対象:
 * 1. HandoffCache — TTL ベースのキャッシュ戦略
 * 2. getHandoffRecords — 日付/時間帯フィルタ構築 + キャッシュ
 * 3. createHandoffRecord — POST + 自動タイトル生成
 * 4. updateHandoffRecord — PATCH + 楽観的更新 + CarryOverDate
 * 5. deleteHandoffRecord — DELETE + キャッシュ無効化
 * 6. callWithRetry — エラーリトライ (非 404)
 * 7. CarryOverDateStore — ローカル補完ストア
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpHandoffItem } from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// Mocks — 依存モジュール
// ────────────────────────────────────────────────────────────

// handoffConfig — listTitle を固定値に
vi.mock('../handoffConfig', () => ({
  handoffConfig: {
    listTitle: 'Handoff_Timeline',
    listId: undefined,
    storage: 'sharepoint',
    debug: false,
  },
}));

// buildHandoffSelectFields — 常に固定フィールドを返す
vi.mock('@/sharepoint/fields', () => ({
  buildHandoffSelectFields: (_fields: string[]) => [
    'Id', 'Title', 'Message', 'UserCode', 'UserDisplayName',
    'Category', 'Severity', 'Status', 'TimeBand',
    'CreatedAt', 'CreatedByName', 'IsDraft',
  ],
}));

// useSP — テストでは使わないが import 解決用
vi.mock('../../lib/spClient', () => ({
  useSP: vi.fn(() => ({})),
}));

import { CarryOverDateStore, createHandoffApi } from '../handoffApi';

// ────────────────────────────────────────────────────────────
// ファクトリ
// ────────────────────────────────────────────────────────────

/** テスト用の SpHandoffItem を生成 */
function createSpItem(overrides: Partial<SpHandoffItem> = {}): SpHandoffItem {
  return {
    Id: 1,
    Title: 'テスト申し送り',
    Message: '体調に注意',
    UserCode: 'U001',
    UserDisplayName: 'テスト太郎',
    Category: '体調',
    Severity: '通常',
    Status: '未対応',
    TimeBand: '朝',
    CreatedAt: '2026-03-04T09:00:00Z',
    CreatedByName: '記録者A',
    IsDraft: false,
    ...overrides,
  };
}

/** sp.spFetch のモック応答を作成 */
function mockResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText: status === 200 ? 'OK' : `Error ${status}`,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/** テスト用の UseSP モックを生成 */
function createMockSP() {
  return {
    spFetch: vi.fn().mockResolvedValue(mockResponse({ value: [] })),
    getListFieldInternalNames: vi.fn().mockResolvedValue(
      new Set(['Id', 'Title', 'Message', 'UserCode', 'UserDisplayName',
               'Category', 'Severity', 'Status', 'TimeBand',
               'CreatedAt', 'CreatedByName', 'IsDraft'])
    ),
    // unused but needed for type compatibility
    getListItemsByTitle: vi.fn(),
    listItems: vi.fn(),
    addListItemByTitle: vi.fn(),
    addItemByTitle: vi.fn(),
    updateItemByTitle: vi.fn(),
    deleteItemByTitle: vi.fn(),
    getItemById: vi.fn(),
    getItemByIdWithEtag: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    batch: vi.fn(),
    postBatch: vi.fn(),
    ensureListExists: vi.fn(),
    tryGetListMetadata: vi.fn(),
  };
}

// ────────────────────────────────────────────────────────────
// テスト
// ────────────────────────────────────────────────────────────

describe('HandoffApi', () => {
  let mockSP: ReturnType<typeof createMockSP>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSP = createMockSP();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── getHandoffRecords ──────────────────────────────────
  describe('getHandoffRecords', () => {
    it('SharePoint API を呼んで HandoffRecord[] を返す', async () => {
      const items = [createSpItem(), createSpItem({ Id: 2, Title: '2件目' })];
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: items }));

      const api = createHandoffApi(mockSP as never);
      const records = await api.getHandoffRecords('today', 'all');

      expect(records).toHaveLength(2);
      expect(records[0].id).toBe(1);
      expect(records[0].title).toBe('テスト申し送り');
      expect(records[1].id).toBe(2);
    });

    it('spFetch の URL に正しいフィルタクエリが含まれる (today)', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));

      const api = createHandoffApi(mockSP as never);
      await api.getHandoffRecords('today', 'all');

      const call = mockSP.spFetch.mock.calls[0][0];
      expect(call).toContain("lists/getbytitle('Handoff_Timeline')/items");
      expect(call).toContain('$filter=');
      expect(call).toContain('CreatedAt ge');
      expect(call).toContain('CreatedAt le');
    });

    it('week スコープのフィルタが正しく構築される', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));

      const api = createHandoffApi(mockSP as never);
      await api.getHandoffRecords('week', 'all');

      const call = mockSP.spFetch.mock.calls[0][0];
      expect(call).toContain('CreatedAt ge');
      // week は le を含まないことを確認
      expect(call).not.toContain('CreatedAt le');
    });

    it('timeFilter が all 以外の場合 TimeBand フィルタが追加される', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));

      const api = createHandoffApi(mockSP as never);
      await api.getHandoffRecords('today', 'morning');

      const call = mockSP.spFetch.mock.calls[0][0];
      expect(call).toContain("TimeBand eq 'morning'");
    });

    it('空の応答が安全に処理される', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));

      const api = createHandoffApi(mockSP as never);
      const records = await api.getHandoffRecords();

      expect(records).toEqual([]);
    });

    it('value が undefined の場合でも安全', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({}));

      const api = createHandoffApi(mockSP as never);
      const records = await api.getHandoffRecords();

      expect(records).toEqual([]);
    });
  });

  // ─── キャッシュ ─────────────────────────────────────────
  describe('TTL キャッシュ', () => {
    it('同一パラメータの連続呼び出しはキャッシュから返す', async () => {
      const items = [createSpItem()];
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: items }));

      const api = createHandoffApi(mockSP as never);

      // 1回目: spFetch が呼ばれる
      const result1 = await api.getHandoffRecords('today', 'all');
      expect(result1).toHaveLength(1);
      expect(mockSP.spFetch).toHaveBeenCalledTimes(1);

      // 2回目: キャッシュヒット — spFetch は追加呼び出しなし
      const result2 = await api.getHandoffRecords('today', 'all');
      expect(result2).toHaveLength(1);
      expect(mockSP.spFetch).toHaveBeenCalledTimes(1); // まだ1回のまま
    });

    it('TTL (15秒) 経過後はキャッシュが無効化される', async () => {
      const items = [createSpItem()];
      mockSP.spFetch.mockImplementation(() =>
        Promise.resolve(mockResponse({ value: items }))
      );

      const api = createHandoffApi(mockSP as never);

      // 1回目
      await api.getHandoffRecords('today', 'all');
      expect(mockSP.spFetch).toHaveBeenCalledTimes(1);

      // 15秒 + 1ms 経過
      vi.advanceTimersByTime(15_001);

      // 2回目: TTL 切れなので再フェッチ
      await api.getHandoffRecords('today', 'all');
      expect(mockSP.spFetch).toHaveBeenCalledTimes(2);
    });

    it('異なるパラメータはキャッシュを共有しない', async () => {
      mockSP.spFetch.mockImplementation(() =>
        Promise.resolve(mockResponse({ value: [] }))
      );

      const api = createHandoffApi(mockSP as never);

      await api.getHandoffRecords('today', 'all');
      await api.getHandoffRecords('yesterday', 'all');

      // 前回キャッシュと別キーなので再フェッチ
      expect(mockSP.spFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ─── createHandoffRecord ────────────────────────────────
  describe('createHandoffRecord', () => {
    it('POST リクエストで作成し HandoffRecord を返す', async () => {
      const createdItem = createSpItem({ Id: 42, Title: '体調に注意' });
      mockSP.spFetch.mockResolvedValue(mockResponse(createdItem));

      const api = createHandoffApi(mockSP as never);
      const record = await api.createHandoffRecord({
        userCode: 'U001',
        userDisplayName: 'テスト太郎',
        category: '体調',
        severity: '通常',
        timeBand: '朝',
        message: '体調に注意してください',
      });

      expect(record.id).toBe(42);

      // POST で呼ばれたことを確認
      const postCall = mockSP.spFetch.mock.calls.find(
        call => (call[1] as RequestInit | undefined)?.method === 'POST'
      );
      expect(postCall).toBeTruthy();
    });

    it('API エラー時に日本語エラーメッセージを throw する', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({}, 500));

      const api = createHandoffApi(mockSP as never);

      await expect(
        api.createHandoffRecord({
          userCode: 'U001',
          userDisplayName: 'テスト太郎',
          category: '体調',
          severity: '通常',
          timeBand: '朝',
          message: 'テスト',
        })
      ).rejects.toThrow('申し送り記録の作成に失敗しました');
    });
  });

  // ─── updateHandoffRecord ────────────────────────────────
  describe('updateHandoffRecord', () => {
    it('PATCH リクエストで更新し再取得した HandoffRecord を返す', async () => {
      // PATCH → OK, その後 GET(getListFieldInternalNames) → GET(item refetch)
      const patchResponse = mockResponse({}, 200);
      const updatedItem = createSpItem({ Id: 1, Status: '対応中' });
      const refetchResponse = mockResponse(updatedItem);

      mockSP.spFetch
        .mockResolvedValueOnce(patchResponse)  // PATCH
        .mockResolvedValueOnce(refetchResponse); // refetch item

      const api = createHandoffApi(mockSP as never);
      const record = await api.updateHandoffRecord('1', { status: '対応中' });

      expect(record.status).toBe('対応中');
    });

    it('明日へ持越の場合 CarryOverDateStore に日付が保存される', async () => {
      const patchResponse = mockResponse({}, 200);
      const updatedItem = createSpItem({ Id: 5, Status: '明日へ持越' });
      const refetchResponse = mockResponse(updatedItem);

      mockSP.spFetch
        .mockResolvedValueOnce(patchResponse)
        .mockResolvedValueOnce(refetchResponse);

      const api = createHandoffApi(mockSP as never);
      await api.updateHandoffRecord('5', {
        status: '明日へ持越',
        carryOverDate: '2026-03-05',
      });

      expect(CarryOverDateStore.get(5)).toBe('2026-03-05');
    });

    it('terminal status (対応済) の場合 CarryOverDateStore がクリアされる', async () => {
      // 事前にローカルストアにデータをセット
      CarryOverDateStore.set(10, '2026-03-05');
      expect(CarryOverDateStore.get(10)).toBe('2026-03-05');

      const patchResponse = mockResponse({}, 200);
      const updatedItem = createSpItem({ Id: 10, Status: '対応済' });
      const refetchResponse = mockResponse(updatedItem);

      mockSP.spFetch
        .mockResolvedValueOnce(patchResponse)
        .mockResolvedValueOnce(refetchResponse);

      const api = createHandoffApi(mockSP as never);
      await api.updateHandoffRecord('10', { status: '対応済' });

      // クリーンアップされたことを確認
      expect(CarryOverDateStore.get(10)).toBeUndefined();
    });

    it('API エラー時に楽観的更新がクリアされる', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({}, 500));

      const api = createHandoffApi(mockSP as never);

      await expect(
        api.updateHandoffRecord('1', { status: '対応中' })
      ).rejects.toThrow('申し送り記録の更新に失敗しました');
    });
  });

  // ─── deleteHandoffRecord ────────────────────────────────
  describe('deleteHandoffRecord', () => {
    it('DELETE リクエストを送信する', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({}, 200));

      const api = createHandoffApi(mockSP as never);
      await api.deleteHandoffRecord('99');

      const deleteCall = mockSP.spFetch.mock.calls.find(
        call => (call[1] as RequestInit | undefined)?.method === 'DELETE'
      );
      expect(deleteCall).toBeTruthy();
      expect(deleteCall![0]).toContain('items(99)');
    });

    it('削除後にキャッシュが無効化される', async () => {
      // まず getHandoffRecords でキャッシュを作る
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [createSpItem()] }));
      const api = createHandoffApi(mockSP as never);
      await api.getHandoffRecords('today', 'all');
      expect(mockSP.spFetch).toHaveBeenCalledTimes(1);

      // DELETE
      mockSP.spFetch.mockResolvedValue(mockResponse({}, 200));
      await api.deleteHandoffRecord('1');

      // キャッシュが無効化されたため、再度 getHandoffRecords は再フェッチする
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));
      await api.getHandoffRecords('today', 'all');

      // spFetch: 1(初回GET) + 1(DELETE) + 1(再GET) = 3回
      expect(mockSP.spFetch).toHaveBeenCalledTimes(3);
    });

    it('API エラー時に日本語エラーをスローする', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({}, 404));

      const api = createHandoffApi(mockSP as never);

      await expect(api.deleteHandoffRecord('999')).rejects.toThrow(
        '申し送り記録の削除に失敗しました'
      );
    });
  });

  // ─── callWithRetry ──────────────────────────────────────
  describe('callWithRetry (リトライ)', () => {
    it('一時的な500エラー後にリトライで成功する', async () => {
      const errorResponse = mockResponse({}, 500);
      const okResponse = mockResponse({ value: [] });

      mockSP.spFetch
        .mockResolvedValueOnce(errorResponse)   // 1st attempt: fail
        .mockResolvedValueOnce(okResponse);      // 2nd attempt: ok

      const api = createHandoffApi(mockSP as never);
      const records = await api.getHandoffRecords('today', 'all');

      expect(records).toEqual([]);
      // getListFieldInternalNames(1) + spFetch(2) = total spFetch calls 2
      expect(mockSP.spFetch).toHaveBeenCalledTimes(2);
    });

    it('404 エラーはリトライせず即時 throw', async () => {
      const error404 = new Error('Not found: 404');
      mockSP.spFetch.mockRejectedValue(error404);

      const api = createHandoffApi(mockSP as never);

      await expect(api.getHandoffRecords('today', 'all')).rejects.toThrow('404');
    });
  });

  // ─── CarryOverDateStore ─────────────────────────────────
  describe('CarryOverDateStore', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('set/get で値を保存・取得できる', () => {
      CarryOverDateStore.set(1, '2026-03-05');
      expect(CarryOverDateStore.get(1)).toBe('2026-03-05');
    });

    it('clear で値を削除できる', () => {
      CarryOverDateStore.set(2, '2026-03-06');
      CarryOverDateStore.clear(2);
      expect(CarryOverDateStore.get(2)).toBeUndefined();
    });

    it('存在しないキーは undefined を返す', () => {
      expect(CarryOverDateStore.get(999)).toBeUndefined();
    });

    it('複数レコードを独立に管理できる', () => {
      CarryOverDateStore.set(1, '2026-03-05');
      CarryOverDateStore.set(2, '2026-03-06');

      expect(CarryOverDateStore.get(1)).toBe('2026-03-05');
      expect(CarryOverDateStore.get(2)).toBe('2026-03-06');

      CarryOverDateStore.clear(1);
      expect(CarryOverDateStore.get(1)).toBeUndefined();
      expect(CarryOverDateStore.get(2)).toBe('2026-03-06'); // 影響なし
    });

    it('文字列 ID でも動作する', () => {
      CarryOverDateStore.set('42', '2026-04-01');
      expect(CarryOverDateStore.get('42')).toBe('2026-04-01');
      expect(CarryOverDateStore.get(42)).toBe('2026-04-01');
    });
  });

  // ─── getHandoffSummaryStats ─────────────────────────────
  describe('getHandoffSummaryStats', () => {
    it('レコードからカテゴリ・重要度・ステータス・時間帯の統計を算出する', async () => {
      const items = [
        createSpItem({ Id: 1, Category: '体調', Severity: '通常', Status: '未対応', TimeBand: '朝' }),
        createSpItem({ Id: 2, Category: '体調', Severity: '重要', Status: '対応中', TimeBand: '午前' }),
        createSpItem({ Id: 3, Category: '行動面', Severity: '通常', Status: '未対応', TimeBand: '朝' }),
      ];
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: items }));

      const api = createHandoffApi(mockSP as never);
      const stats = await api.getHandoffSummaryStats('today');

      expect(stats.totalCount).toBe(3);
      expect(stats.categoryStats['体調']).toBe(2);
      expect(stats.categoryStats['行動面']).toBe(1);
      expect(stats.severityStats['通常']).toBe(2);
      expect(stats.severityStats['重要']).toBe(1);
      expect(stats.statusStats['未対応']).toBe(2);
      expect(stats.statusStats['対応中']).toBe(1);
      expect(stats.timeBandStats['朝']).toBe(2);
      expect(stats.timeBandStats['午前']).toBe(1);
    });

    it('レコードがない場合は全カウント 0', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));

      const api = createHandoffApi(mockSP as never);
      const stats = await api.getHandoffSummaryStats('today');

      expect(stats.totalCount).toBe(0);
      expect(stats.categoryStats).toEqual({});
    });
  });

  // ─── getUserHandoffRecords ──────────────────────────────
  describe('getUserHandoffRecords', () => {
    it('UserCode フィルタを含むクエリで SP を呼ぶ', async () => {
      const items = [createSpItem({ Id: 10, UserCode: 'U001' })];
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: items }));

      const api = createHandoffApi(mockSP as never);
      const records = await api.getUserHandoffRecords('U001');

      expect(records).toHaveLength(1);
      expect(records[0].userCode).toBe('U001');

      const call = mockSP.spFetch.mock.calls[0][0];
      expect(call).toContain("UserCode eq 'U001'");
    });

    it('today スコープで日付フィルタが追加される', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));

      const api = createHandoffApi(mockSP as never);
      await api.getUserHandoffRecords('U001', 'today');

      const call = mockSP.spFetch.mock.calls[0][0];
      expect(call).toContain("UserCode eq 'U001'");
      expect(call).toContain('CreatedAt ge');
      expect(call).toContain('CreatedAt le');
    });

    it('yesterday スコープで前日フィルタが構築される', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));

      const api = createHandoffApi(mockSP as never);
      await api.getUserHandoffRecords('U001', 'yesterday');

      const call = mockSP.spFetch.mock.calls[0][0];
      expect(call).toContain('CreatedAt ge');
      expect(call).toContain('CreatedAt le');
    });

    it('timeFilter が morning の場合 TimeBand フィルタが追加される', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));

      const api = createHandoffApi(mockSP as never);
      await api.getUserHandoffRecords('U001', 'today', 'morning');

      const call = mockSP.spFetch.mock.calls[0][0];
      expect(call).toContain("TimeBand eq 'morning'");
    });

    it('API エラー時に日本語エラーをスローする', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({}, 500));

      const api = createHandoffApi(mockSP as never);

      await expect(
        api.getUserHandoffRecords('U001')
      ).rejects.toThrow('ユーザー別申し送り記録の取得に失敗しました');
    });

    it('空の応答を安全に処理する', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));

      const api = createHandoffApi(mockSP as never);
      const records = await api.getUserHandoffRecords('U999');

      expect(records).toEqual([]);
    });
  });

  // ─── getMeetingHandoffRecords ───────────────────────────
  describe('getMeetingHandoffRecords', () => {
    it('MeetingSessionKey フィルタで SP を呼ぶ', async () => {
      const items = [
        createSpItem({ Id: 20, MeetingSessionKey: '2026-03-04_morning' }),
        createSpItem({ Id: 21, MeetingSessionKey: '2026-03-04_morning' }),
      ];
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: items }));

      const api = createHandoffApi(mockSP as never);
      const records = await api.getMeetingHandoffRecords('2026-03-04_morning');

      expect(records).toHaveLength(2);

      const call = mockSP.spFetch.mock.calls[0][0];
      expect(call).toContain("MeetingSessionKey eq '2026-03-04_morning'");
    });

    it('結果が CreatedAt desc で並べ替えられる', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));

      const api = createHandoffApi(mockSP as never);
      await api.getMeetingHandoffRecords('2026-03-04_evening');

      const call = mockSP.spFetch.mock.calls[0][0];
      expect(call).toContain('$orderby=CreatedAt desc');
    });

    it('API エラー時に日本語エラーをスローする', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({}, 500));

      const api = createHandoffApi(mockSP as never);

      await expect(
        api.getMeetingHandoffRecords('2026-03-04_morning')
      ).rejects.toThrow('会議用申し送り記録の取得に失敗しました');
    });

    it('空の応答を安全に処理する', async () => {
      mockSP.spFetch.mockResolvedValue(mockResponse({}));

      const api = createHandoffApi(mockSP as never);
      const records = await api.getMeetingHandoffRecords('nonexistent');

      expect(records).toEqual([]);
    });
  });

  // ─── キャッシュ無効化 (create/update 後) ─────────────────
  describe('キャッシュ無効化', () => {
    it('createHandoffRecord 後にキャッシュが無効化され再フェッチされる', async () => {
      // 1. GET でキャッシュ
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [createSpItem()] }));
      const api = createHandoffApi(mockSP as never);
      await api.getHandoffRecords('today', 'all');
      expect(mockSP.spFetch).toHaveBeenCalledTimes(1);

      // 2. POST (create)
      const createdItem = createSpItem({ Id: 50 });
      mockSP.spFetch.mockResolvedValue(mockResponse(createdItem));
      await api.createHandoffRecord({
        userCode: 'U001',
        userDisplayName: 'テスト太郎',
        category: '体調',
        severity: '通常',
        timeBand: '朝',
        message: 'テスト',
      });

      // 3. 再GET — キャッシュ無効化されたので再フェッチ
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));
      await api.getHandoffRecords('today', 'all');

      // spFetch: 1(初回GET) + 1(POST) + 1(再GET) = 3回以上
      expect(mockSP.spFetch.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('updateHandoffRecord 後にキャッシュが無効化される', async () => {
      // 1. GET でキャッシュ
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [createSpItem()] }));
      const api = createHandoffApi(mockSP as never);
      await api.getHandoffRecords('today', 'all');
      const callsAfterGet = mockSP.spFetch.mock.calls.length;

      // 2. PATCH (update)
      const patchResponse = mockResponse({}, 200);
      const refetchItem = createSpItem({ Id: 1, Status: '対応済' });
      mockSP.spFetch
        .mockResolvedValueOnce(patchResponse)
        .mockResolvedValueOnce(mockResponse(refetchItem));
      await api.updateHandoffRecord('1', { status: '対応済' });

      // 3. 再GET — キャッシュ無効化
      mockSP.spFetch.mockResolvedValue(mockResponse({ value: [] }));
      await api.getHandoffRecords('today', 'all');

      // 再GET が発生している（キャッシュから返さない）
      expect(mockSP.spFetch.mock.calls.length).toBeGreaterThan(callsAfterGet + 2);
    });
  });
});
