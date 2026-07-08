import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BillingPage from '@/pages/BillingPage';

const billingSummaryState = vi.hoisted(() => ({
  isPersistenceMissing: false,
}));

const exportCsvMock = vi.hoisted(() => vi.fn());
const togglePaymentStatusMock = vi.hoisted(() => vi.fn());
const bulkSettleMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/billing/hooks/useBillingSummary', () => ({
  useBillingSummary: () => ({
    records: [],
    availableMonths: ['2026-05'],
    totalServedCount: 0,
    totalServedAmount: 0,
    totalPaidCount: 0,
    totalUnpaidAmount: 0,
    isLoading: false,
    isError: false,
    isMutating: false,
    isPersistenceMissing: billingSummaryState.isPersistenceMissing,
    togglePaymentStatus: togglePaymentStatusMock,
    bulkSettle: bulkSettleMock,
    exportCsv: exportCsvMock,
  }),
}));

describe('BillingPage CSV export confirmation', () => {
  beforeEach(() => {
    billingSummaryState.isPersistenceMissing = false;
    exportCsvMock.mockReset();
    togglePaymentStatusMock.mockReset();
    bulkSettleMock.mockReset();
    vi.restoreAllMocks();
  });

  it('exports CSV without confirmation when payment persistence is available', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<BillingPage />);
    fireEvent.click(screen.getByRole('button', { name: /CSV出力/ }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(exportCsvMock).toHaveBeenCalledWith('利用者');
  });

  it('does not export CSV when payment persistence is missing and confirmation is cancelled', () => {
    billingSummaryState.isPersistenceMissing = true;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<BillingPage />);
    fireEvent.click(screen.getByRole('button', { name: /CSV出力/ }));

    expect(confirmSpy).toHaveBeenCalledWith(
      '精算状態の永続化列を確認できないため、このCSVには端末内の一時的な精算状態が含まれる可能性があります。正式な精算CSVとして扱わないでください。それでもCSVを出力しますか？'
    );
    expect(exportCsvMock).not.toHaveBeenCalled();
  });

  it('exports CSV when payment persistence is missing and confirmation is accepted', () => {
    billingSummaryState.isPersistenceMissing = true;
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<BillingPage />);
    fireEvent.click(screen.getByRole('button', { name: /CSV出力/ }));

    expect(exportCsvMock).toHaveBeenCalledWith('利用者');
  });

  it('shows a stronger warning when payment persistence is missing', () => {
    billingSummaryState.isPersistenceMissing = true;

    render(<BillingPage />);

    expect(screen.getByText(/PaymentStatus \/ PaidAt \/ PaidBy/)).toBeInTheDocument();
    expect(screen.getByText(/CSVの精算状況を正式な精算結果として扱わないでください/)).toBeInTheDocument();
    expect(screen.getByText('精算状態未検証のため、CSV出力時に確認が必要です')).toBeInTheDocument();
  });
});
