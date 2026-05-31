import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBillingSummary } from '../useBillingSummary';

// ─── モック定義 ───────────────────────────────────────────

vi.mock('@/features/users/store', () => ({
  useUsersStore: () => ({
    data: [{ UserID: 'U-001', FullName: 'テスト利用者' }],
    isLoading: false,
  }),
}));

vi.mock('@/features/staff/store', () => ({
  useStaffStore: () => ({
    data: [{ staffId: 'STF001', name: 'テスト職員' }],
    isLoading: false,
  }),
}));

const mockOrders = [
  {
    id: 1,
    orderDate: '2026-05-10T10:00:00Z',
    ordererCode: 'U-001',
    ordererName: 'テスト利用者',
    orderCount: 2,
    served: 'true',
    item: 'コーヒー',
    sugar: 'なし',
    milk: 'なし',
    drinkPrice: 150,
    paymentStatus: '',
    paidAt: '',
    paidBy: '',
  },
  {
    id: 2,
    orderDate: '2026-05-11T12:00:00Z',
    ordererCode: 'U-001',
    ordererName: 'テスト利用者',
    orderCount: 1,
    served: 'true',
    item: 'コーヒー',
    sugar: 'なし',
    milk: 'なし',
    drinkPrice: 150,
    paymentStatus: '',
    paidAt: '',
    paidBy: '',
  },
  {
    id: 3,
    orderDate: '2026-05-12T15:00:00Z',
    ordererCode: 'STF001',
    ordererName: 'テスト職員',
    orderCount: 1,
    served: 'true',
    item: 'カフェラテ',
    sugar: 'なし',
    milk: 'なし',
    drinkPrice: 200,
    paymentStatus: '',
    paidAt: '',
    paidBy: '',
  },
  {
    id: 4,
    orderDate: '2026-05-13T09:00:00Z',
    ordererCode: 'G-999',
    ordererName: 'ゲスト氏',
    orderCount: 1,
    served: 'false', // 提供されていないため除外されるべき
    item: 'コーヒー',
    sugar: 'なし',
    milk: 'なし',
    drinkPrice: 150,
    paymentStatus: '',
    paidAt: '',
    paidBy: '',
  },
  {
    id: 5,
    orderDate: '2026-04-20T10:00:00Z', // 月が異なるため除外されるべき
    ordererCode: 'U-001',
    ordererName: 'テスト利用者',
    orderCount: 2,
    served: 'true',
    item: 'コーヒー',
    sugar: 'なし',
    milk: 'なし',
    drinkPrice: 150,
    paymentStatus: '',
    paidAt: '',
    paidBy: '',
  },
  {
    id: 6,
    orderDate: '2026-05-14T11:00:00Z',
    ordererCode: 'G-111',
    ordererName: '謎のゲスト',
    orderCount: 1,
    served: 'true',
    item: 'コーヒー',
    sugar: 'なし',
    milk: 'なし',
    drinkPrice: 150,
    paymentStatus: '',
    paidAt: '',
    paidBy: '',
  },
];

vi.mock('../../useBillingOrders', () => ({
  useBillingOrders: () => ({
    data: mockOrders,
    isLoading: false,
    isError: false,
  }),
  billingOrdersQueryKey: ['billingOrders', 'list'],
}));

const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...original,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

const mockBulkUpdatePaymentStatus = vi.fn(() => Promise.resolve());
const mockIsPersistenceColumnsResolved = vi.fn(() => Promise.resolve(true));

vi.mock('../useBillingOrderRepository', () => ({
  useBillingOrderRepository: () => ({
    list: vi.fn(),
    isPersistenceColumnsResolved: mockIsPersistenceColumnsResolved,
    updatePaymentStatus: vi.fn(() => Promise.resolve()),
    bulkUpdatePaymentStatus: mockBulkUpdatePaymentStatus,
  }),
}));

describe('useBillingSummary', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockBulkUpdatePaymentStatus.mockClear();
    mockInvalidateQueries.mockClear();
    mockIsPersistenceColumnsResolved.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('対象月と served===true でフィルタリングし、人ごとに正しく集計すること', async () => {
    mockIsPersistenceColumnsResolved.mockResolvedValue(true);
    const { result } = renderHook(() => useBillingSummary('2026-05'));

    // スキーマ判定の解決を待つ
    await vi.waitFor(() => {
      expect(result.current.isPersistenceMissing).toBe(false);
    });

    expect(result.current.records.length).toBe(3);

    const userRecord = result.current.records.find((r) => r.ordererCode === 'U-001');
    expect(userRecord).toBeDefined();
    expect(userRecord?.totalCount).toBe(3);
    expect(userRecord?.totalAmount).toBe(450);
    expect(userRecord?.category).toBe('利用者');

    const staffRecord = result.current.records.find((r) => r.ordererCode === 'STF001');
    expect(staffRecord).toBeDefined();
    expect(staffRecord?.totalCount).toBe(1);
    expect(staffRecord?.totalAmount).toBe(200);
    expect(staffRecord?.category).toBe('職員');

    // KPI 集計の検証
    expect(result.current.totalServedCount).toBe(5);
    expect(result.current.totalServedAmount).toBe(800);
  });

  it('個別の精算トグル状態が SharePoint の repository に送られ、query invalidation が走ること', async () => {
    mockIsPersistenceColumnsResolved.mockResolvedValue(true);
    const { result } = renderHook(() => useBillingSummary('2026-05'));

    await vi.waitFor(() => {
      expect(result.current.isPersistenceMissing).toBe(false);
    });

    // 精算トグルを実行 (非同期)
    await act(async () => {
      await result.current.togglePaymentStatus('U-001');
    });

    // bulkUpdatePaymentStatus が U-001 の全注文ID [1, 2] で呼ばれたこと
    expect(mockBulkUpdatePaymentStatus).toHaveBeenCalledWith(
      [1, 2],
      '精算済み',
      expect.any(String),
      '管理担当者'
    );

    // キャッシュクリアが呼ばれたこと
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('一括精算を実行すると、選択されたカテゴリがすべて精算済みになるよう SharePoint を一括更新すること', async () => {
    mockIsPersistenceColumnsResolved.mockResolvedValue(true);
    const { result } = renderHook(() => useBillingSummary('2026-05'));

    await vi.waitFor(() => {
      expect(result.current.isPersistenceMissing).toBe(false);
    });

    // 「職員」のみを一括精算
    await act(async () => {
      await result.current.bulkSettle('職員');
    });

    // 職員 STF001 の注文ID [3] が一括更新されたこと
    expect(mockBulkUpdatePaymentStatus).toHaveBeenCalledWith(
      [3],
      '精算済み',
      expect.any(String),
      '管理担当者'
    );
  });

  it('SharePoint に精算列が無い場合、isPersistenceMissing が true になり LocalStorage フォールバックが働くこと', async () => {
    mockIsPersistenceColumnsResolved.mockResolvedValue(false);
    const { result } = renderHook(() => useBillingSummary('2026-05'));

    await vi.waitFor(() => {
      expect(result.current.isPersistenceMissing).toBe(true);
    });

    // この状態でトグルを呼ぶ
    await act(async () => {
      await result.current.togglePaymentStatus('U-001');
    });

    // LocalStorage にフォールバック保存されたことの確認
    const stored = JSON.parse(localStorage.getItem('app:billing:payment_states') || '{}');
    expect(stored['2026-05:U-001']).toBe(true);

    // SharePoint への更新は呼ばれていないこと
    expect(mockBulkUpdatePaymentStatus).not.toHaveBeenCalled();
  });

  it('CSV出力が正常に動作し、BOM(\ufeff) が付与されていること', async () => {
    mockIsPersistenceColumnsResolved.mockResolvedValue(true);
    const { result } = renderHook(() => useBillingSummary('2026-05'));

    await vi.waitFor(() => {
      expect(result.current.isPersistenceMissing).toBe(false);
    });

    // DOM要素や Blob, URL のモック作成
    const mockClick = vi.fn();
    const mockAppend = vi.fn();
    const mockRemove = vi.fn();

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      if (tagName === 'a') {
        return {
          setAttribute: vi.fn(),
          style: {},
          click: mockClick,
        } as any;
      }
      return originalCreateElement(tagName, options);
    });

    vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppend as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemove as any);

    // global.URL.createObjectURL のモック
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/dummy');

    // Blob のモック取得用 spy
    let passedCsvContent = '';
    const originalBlob = global.Blob;
    global.Blob = class MockBlob {
      constructor(content: any[]) {
        passedCsvContent = content[0];
      }
    } as any;

    act(() => {
      result.current.exportCsv('すべて');
    });

    // 要素追加とクリックが発火されたこと
    expect(mockAppend).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();

    // CSV の内容に BOM が含まれ、データがあること
    expect(passedCsvContent.startsWith('\uFEFF')).toBe(true);
    expect(passedCsvContent).toContain('注文者コード,注文者氏名,区分,提供数,合計金額,精算状況');

    // Blob の復元
    global.Blob = originalBlob;
  });
});
