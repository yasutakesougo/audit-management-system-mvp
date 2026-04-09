import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { PlanningSheetListView } from '../PlanningSheetListView';
import { PlanningSheetListViewModel, PlanningSheetListActionHandlers } from '../types';
import '@testing-library/jest-dom';

const mockHandlers: PlanningSheetListActionHandlers = {
  onUserSelect: vi.fn(),
  onNavigateToSheet: vi.fn(),
  onNewSheet: vi.fn(),
  onOpenIceberg: vi.fn(),
  onCreateFromIceberg: vi.fn(),
  onReviseFromIceberg: vi.fn(),
  onBackToIsp: vi.fn(),
};

const baseViewModel: PlanningSheetListViewModel = {
  userId: 'I009',
  sheets: [],
  isLoading: false,
  error: null,
  allUsers: [],
  isIcebergTarget: true,
  isIcebergEnabled: true,
  icebergSummary: undefined,
  currentCount: 0,
  totalCount: 0,
};

describe('PlanningSheetListPage Regression Tests', () => {
  test('Iceberg 対象者の場合、ヘッダーに「氷山分析を開く」ボタンが表示されること', () => {
    const vm = { ...baseViewModel, isIcebergTarget: true };
    render(
      <MemoryRouter>
        <PlanningSheetListView viewModel={vm} handlers={mockHandlers} />
      </MemoryRouter>
    );

    expect(screen.getByText('氷山分析を開く')).toBeInTheDocument();
  });

  test('Iceberg 非対象者の場合、ヘッダーに「氷山分析を開く」ボタンが表示されないこと', () => {
    const vm = { ...baseViewModel, isIcebergTarget: false };
    render(
      <MemoryRouter>
        <PlanningSheetListView viewModel={vm} handlers={mockHandlers} />
      </MemoryRouter>
    );

    expect(screen.queryByText('氷山分析を開く')).not.toBeInTheDocument();
  });

  test('Iceberg 対象者かつシート未作成の場合、「氷山分析から新規作成」がプライマリCTAとして表示されること', () => {
    const vm = { ...baseViewModel, sheets: [], isIcebergTarget: true };
    render(
      <MemoryRouter>
        <PlanningSheetListView viewModel={vm} handlers={mockHandlers} />
      </MemoryRouter>
    );

    expect(screen.getByText('氷山分析から新規作成')).toBeInTheDocument();
    expect(screen.getByText('新規作成')).toBeInTheDocument();
  });

  test('Iceberg 要約がある場合、要約バーが表示されること', () => {
    const vm = { 
      ...baseViewModel, 
      icebergSummary: {
        sessionId: 'test-session-123',
        updatedAt: '2026-04-08T00:00:00Z',
        primaryBehavior: '他害(叩く)',
        primaryFactor: '環境要因'
      }
    };
    render(
      <MemoryRouter>
        <PlanningSheetListView viewModel={vm} handlers={mockHandlers} />
      </MemoryRouter>
    );

    expect(screen.getByText('最新の氷山分析要約')).toBeInTheDocument();
    expect(screen.getByText('他害(叩く)')).toBeInTheDocument();
    expect(screen.getByText('環境要因')).toBeInTheDocument();
  });

  test('現行シートがある場合、「現行運用中」バッジが表示されること', () => {
    const vm = { 
      ...baseViewModel, 
      sheets: [
        {
          id: 's1',
          userId: 'I009',
          ispId: 'isp1',
          title: 'テスト計画',
          targetScene: '食事',
          status: 'active' as const,
          isCurrent: true,
          statusColor: 'success' as const,
          nextReviewAt: null,
          applicableServiceType: 'other',
          applicableAddOnTypes: ['none'],
          authoredByQualification: 'unknown',
          reviewedAt: null,
        } as any
      ]
    };
    render(
      <MemoryRouter>
        <PlanningSheetListView viewModel={vm} handlers={mockHandlers} />
      </MemoryRouter>
    );

    expect(screen.getByText('現行運用中')).toBeInTheDocument();
  });

  test('差分（Difference Insight）がある場合、警告バーが表示されること', () => {
    const vm = { 
      ...baseViewModel, 
      differenceInsight: {
        changes: [
          { label: '行動', value: '追加: 自傷行為', level: 'high' as const },
          { label: '要因', value: '検討: 騒音', level: 'medium' as const }
        ],
        sourceSessionId: 'session-456'
      }
    };
    render(
      <MemoryRouter>
        <PlanningSheetListView viewModel={vm} handlers={mockHandlers} />
      </MemoryRouter>
    );

    expect(screen.getByText('前回計画からの重要な変化 (DIFFERENCE INSIGHT)')).toBeInTheDocument();
    expect(screen.getByText('追加: 自傷行為')).toBeInTheDocument();
    expect(screen.getByText('検討: 騒音')).toBeInTheDocument();
  });
});
