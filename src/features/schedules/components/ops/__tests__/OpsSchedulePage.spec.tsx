/**
 * OpsSchedulePage.spec.tsx — OpsSchedulePage の Smoke Test
 *
 * 責務:
 * - useScheduleOps をモックし、UI（Page Wiring）が壊れていないかを検証する
 * - 主導線である「初期描画」「Rowクリックによるドロワー開閉」「Empty State」を守る
 * - 細かな domain logic（filter計算など）は pure layer でテスト済みとして省略
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpsSchedulePage } from '../OpsSchedulePage';

// 1. Hook のモック
import { useScheduleOps } from '../../../hooks/useScheduleOps';
import type { UseScheduleOpsReturn } from '../../../hooks/useScheduleOps';

vi.mock('../../../hooks/useScheduleOps', () => ({
  useScheduleOps: vi.fn(),
}));

const mockUseScheduleOps = vi.mocked(useScheduleOps);

// 2. モックデータの準備
const createMockState = (overrides?: Partial<UseScheduleOpsReturn>): UseScheduleOpsReturn => {
  const defaultDate = new Date('2026-03-20T00:00:00Z');
  return {
    selectedDate: defaultDate,
    setSelectedDate: vi.fn(),
    goToday: vi.fn(),
    goPrev: vi.fn(),
    goNext: vi.fn(),
    viewMode: 'daily',
    setViewMode: vi.fn(),
    selectedItem: null,
    selectItem: vi.fn(),
    detailOpen: false,
    
    filter: {
      serviceType: 'all',
      staffId: null,
      hasAttention: false,
      hasPickup: false,
      hasBath: false,
      hasMedication: false,
      includeCancelled: false,
      searchQuery: '',
    },
    setFilter: vi.fn(),
    clearFilter: vi.fn(),
    activeFilterCount: 0,
    
    filteredItems: [],
    dailySummary: {
      totalCount: 0,
      normalCount: 0,
      respiteCount: 0,
      shortStayCount: 0,
      cancelledCount: 0,
      attentionCount: 0,
      availableSlots: 20,
      availableNormalSlots: 20,
      availableRespiteSlots: 3,
      availableShortStaySlots: 2,
      requiredStaff: 0,
      assignedStaff: 0,
    },
    weeklySummary: [],
    
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    staffOptions: [],
    ...overrides,
  };
};

// ============================================================================
// Tests
// ============================================================================

describe('OpsSchedulePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Case 1: 初期描画 — Header, Summary, Filter, Table がレンダリングされる', () => {
    // Arrange: items に1件配置
    mockUseScheduleOps.mockReturnValue(
      createMockState({
        filteredItems: [
          {
            id: 'item-1',
            title: '山田 太郎',
            userName: '山田 太郎',
            category: 'User',
            start: '2026-03-20T00:00:00Z',
            end: '2026-03-20T06:00:00Z',
            etag: '1',
            serviceType: 'normal',
            visibility: 'team',
            status: 'Planned',
            opsStatus: 'planned',
            hasPickup: true,
            hasBath: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        ],
        dailySummary: {
          ...createMockState().dailySummary,
          totalCount: 1,
        },
      })
    );

    // Act
    render(<OpsSchedulePage />);

    // Assert: Header
    expect(screen.getByRole('heading', { name: '利用スケジュール' })).toBeInTheDocument();
    
    // Assert: Summary Card (ここでは表示の有無のみ確認)
    expect(screen.getByText('合計')).toBeInTheDocument();
    
    // Assert: Filter Bar
    expect(screen.getByPlaceholderText('利用者名で検索…')).toBeInTheDocument();
    expect(screen.getByText('キャンセル含む')).toBeInTheDocument();
    
    // Assert: Daily Table (row が見えるか)
    expect(screen.getByText('山田 太郎')).toBeInTheDocument();
  });

  it('Case 2: 行クリックで行が selectItem される（Drawer のトリガー）', () => {
    // Arrange
    const selectItemMock = vi.fn();
    mockUseScheduleOps.mockReturnValue(
      createMockState({
        filteredItems: [
          {
            id: 'item-1',
            title: '山田 太郎',
            userName: '山田 太郎',
            category: 'User',
            start: '2026-03-20T00:00:00Z',
            end: '2026-03-20T06:00:00Z',
            etag: '1',
            serviceType: 'normal',
            visibility: 'team',
            status: 'Planned',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        ],
        selectItem: selectItemMock,
      })
    );

    render(<OpsSchedulePage />);

    // Act: Row をクリック
    // OpsDailyTable は行を click すると onItemClick を叩く仕様
    // getByText('山田 太郎') は td 要素の中なので、最も近い tr またはコンテナをクリックさせる
    const nameCell = screen.getByText('山田 太郎');
    fireEvent.click(nameCell);

    // Assert: Handler が発火したか
    expect(selectItemMock).toHaveBeenCalledTimes(1);
    expect(selectItemMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
  });

  it('Case 2b: Drawer 開放時 — selectedItem を渡すと Drawer の内容が表示される', () => {
    // Arrange
    const mockItem = {
      id: 'drawer-item-1',
      title: '山田 太郎',
      userName: '山田 太郎',
      category: 'User',
      start: '2026-03-20T00:00:00Z',
      end: '2026-03-20T06:00:00Z',
      etag: '1',
      serviceType: 'normal',
      visibility: 'team',
      status: 'Planned',
      handoffSummary: '昨夜発熱あり',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    
    mockUseScheduleOps.mockReturnValue(
      createMockState({
        selectedItem: mockItem,
        detailOpen: true,
      })
    );

    render(<OpsSchedulePage />);

    // Assert: DetailDrawer 内の特有要素が見えるか
    // （OpsDetailHandoffSection の内容が見えればドロワーが開いている証拠）
    expect(screen.getByText('昨夜発熱あり')).toBeInTheDocument();
  });

  it('Case 3: Filter UI — 検索テキスト変更で setFilter が呼ばれる', () => {
    // Arrange
    const setFilterMock = vi.fn();
    mockUseScheduleOps.mockReturnValue(
      createMockState({
        setFilter: setFilterMock,
      })
    );

    render(<OpsSchedulePage />);

    // Act
    const searchInput = screen.getByPlaceholderText('利用者名で検索…');
    fireEvent.change(searchInput, { target: { value: '山田' } });

    // Assert
    expect(setFilterMock).toHaveBeenCalledWith({ searchQuery: '山田' });
  });

  it('Case 4: Empty State — items=0 件のときにレイアウトが崩れず Empty 状態になる', () => {
    // Arrange
    mockUseScheduleOps.mockReturnValue(
      createMockState({
        filteredItems: [],
        isLoading: false,
        error: null,
      })
    );

    render(<OpsSchedulePage />);

    // Assert: Empty 表示のテキストがあるか
    expect(screen.getByText('予定はありません')).toBeInTheDocument();
  });
});
