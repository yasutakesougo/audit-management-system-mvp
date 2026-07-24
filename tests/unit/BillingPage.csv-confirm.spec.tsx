import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingPage, type BillingOrderRepository } from '@/features/billing';

const billingSummaryState = vi.hoisted(() => ({
  isPersistenceMissing: false,
  hasLocalPaymentState: false,
  localPaymentStateCount: 0,
  canEditPayment: true,
  records: [] as Array<{
    ordererCode: string;
    ordererName: string;
    category: '利用者' | '職員' | 'ゲスト';
    totalCount: number;
    totalAmount: number;
    isPaid: boolean;
    orderIds: number[];
  }>,
}));

const exportCsvMock = vi.hoisted(() => vi.fn());
const togglePaymentStatusMock = vi.hoisted(() => vi.fn());
const bulkSettleMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/billing/hooks/useBillingSummary', () => ({
  useBillingSummary: () => ({
    records: billingSummaryState.records,
    availableMonths: ['2026-05'],
    totalServedCount: 0,
    totalServedAmount: 0,
    totalPaidCount: 0,
    totalUnpaidAmount: 0,
    isLoading: false,
    isError: false,
    isMutating: false,
    isPersistenceMissing: billingSummaryState.isPersistenceMissing,
    isPaymentAuditMissing: false,
    canEditPayment: billingSummaryState.canEditPayment,
    hasLocalPaymentState: billingSummaryState.hasLocalPaymentState,
    localPaymentStateCount: billingSummaryState.localPaymentStateCount,
    persistenceWarningReason: undefined,
    togglePaymentStatus: togglePaymentStatusMock,
    bulkSettle: bulkSettleMock,
    exportCsv: exportCsvMock,
  }),
}));

const repository = {} as BillingOrderRepository;

describe('BillingPage CSV export confirmation', () => {
  beforeEach(() => {
    billingSummaryState.isPersistenceMissing = false;
    billingSummaryState.hasLocalPaymentState = false;
    billingSummaryState.localPaymentStateCount = 0;
    billingSummaryState.canEditPayment = true;
    billingSummaryState.records = [];
    exportCsvMock.mockReset();
    togglePaymentStatusMock.mockReset();
    bulkSettleMock.mockReset();
    vi.restoreAllMocks();
  });

  it('exports CSV without confirmation when payment persistence is available', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<BillingPage repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: /CSV出力/ }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(exportCsvMock).toHaveBeenCalledWith('利用者');
  });

  it('does not export CSV when payment persistence is missing and confirmation is cancelled', () => {
    billingSummaryState.isPersistenceMissing = true;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<BillingPage repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: /CSV出力/ }));

    expect(confirmSpy).toHaveBeenCalledWith(
      '精算状態の永続化列を確認できないため、このCSVには端末内の一時的な精算状態が含まれる可能性があります。正式な精算CSVとして扱わないでください。それでもCSVを出力しますか？'
    );
    expect(exportCsvMock).not.toHaveBeenCalled();
  });

  it('exports CSV when payment persistence is missing and confirmation is accepted', () => {
    billingSummaryState.isPersistenceMissing = true;
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<BillingPage repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: /CSV出力/ }));

    expect(exportCsvMock).toHaveBeenCalledWith('利用者');
  });

  it('shows a stronger warning when payment persistence is missing', () => {
    billingSummaryState.isPersistenceMissing = true;

    render(<BillingPage repository={repository} />);

    expect(screen.getByText(/PaymentStatus \/ PaidAt \/ PaidBy/)).toBeInTheDocument();
    expect(screen.getByText(/CSVの精算状況を正式な精算結果として扱わないでください/)).toBeInTheDocument();
    expect(screen.getByText('精算状態未検証のため、CSV出力時に確認が必要です')).toBeInTheDocument();
  });

  it('shows a local temporary state notice when existing LocalStorage payment state remains in resolved mode', () => {
    billingSummaryState.hasLocalPaymentState = true;
    billingSummaryState.localPaymentStateCount = 2;

    render(<BillingPage repository={repository} />);

    expect(screen.getByText(/端末内の過去一時状態が残っています/)).toBeInTheDocument();
    expect(screen.getByText(/SharePoint の精算状態を正本として表示しています/)).toBeInTheDocument();
    expect(screen.getByText(/端末内一時状態:\s*2件/)).toBeInTheDocument();
  });

  it('does not show a local temporary state notice when no LocalStorage payment state remains', () => {
    render(<BillingPage repository={repository} />);

    expect(
      screen.queryByText(/端末内の過去一時状態が残っています/)
    ).not.toBeInTheDocument();
  });

  it('shows a stronger local temporary state warning when payment persistence is missing', () => {
    billingSummaryState.isPersistenceMissing = true;
    billingSummaryState.hasLocalPaymentState = true;
    billingSummaryState.localPaymentStateCount = 1;

    render(<BillingPage repository={repository} />);

    expect(screen.getByText(/端末内の一時状態が表示やCSVへ影響する可能性があります/)).toBeInTheDocument();
    expect(screen.getByText(/端末内一時状態:\s*1件/)).toBeInTheDocument();
    expect(screen.getByText(/CSVの精算状況を正式な精算結果として扱わないでください/)).toBeInTheDocument();
  });

  it('hides payment mutation controls for viewers while keeping payment status readable', () => {
    billingSummaryState.canEditPayment = false;
    billingSummaryState.records = [{
      ordererCode: 'U-001',
      ordererName: 'テスト利用者',
      category: '利用者',
      totalCount: 1,
      totalAmount: 150,
      isPaid: false,
      orderIds: [1],
    }];

    render(<BillingPage repository={repository} />);

    expect(screen.queryByRole('button', { name: '選択中のタブを一括精算' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '未精算' })).not.toBeInTheDocument();
    expect(screen.getByText('テスト利用者')).toBeInTheDocument();
    expect(screen.getByText('未精算')).toBeInTheDocument();
  });

  it('shows payment mutation controls for reception', () => {
    billingSummaryState.records = [{
      ordererCode: 'U-001',
      ordererName: 'テスト利用者',
      category: '利用者',
      totalCount: 1,
      totalAmount: 150,
      isPaid: false,
      orderIds: [1],
    }];

    render(<BillingPage repository={repository} />);

    expect(screen.getByRole('button', { name: '選択中のタブを一括精算' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未精算' })).toBeInTheDocument();
  });
});
