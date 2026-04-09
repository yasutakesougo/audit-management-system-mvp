/**
 * ApprovalSection — ユニットテスト
 *
 * F-1: ISP サビ管承認 UI のコンポーネントテスト。
 * 承認状態の表示切替、ボタンの有効/無効、確認ダイアログの動作を検証する。
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ApprovalState } from '../../hooks/useComplianceForm';
import ApprovalSection from '../tabs/ApprovalSection';

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

const defaultApprovalState: ApprovalState = {
  isApproved: false,
  approvedBy: null,
  approvedAt: null,
  approvalStatus: 'draft',
};

const approvedState: ApprovalState = {
  isApproved: true,
  approvedBy: 'admin@example.com',
  approvedAt: '2025-04-01T09:30:00.000Z',
  approvalStatus: 'approved',
};

const noRippleTheme = createTheme({
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
        disableTouchRipple: true,
      },
    },
  },
});

function renderWithNoRipple(ui: ReactElement) {
  return render(<ThemeProvider theme={noRippleTheme}>{ui}</ThemeProvider>);
}

// ────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────

describe('ApprovalSection', () => {
  describe('未承認状態', () => {
    it('管理者には承認ボタンが有効で表示される', () => {
      const onApprove = vi.fn();
      renderWithNoRipple(
        <ApprovalSection
          approvalState={defaultApprovalState}
          isAdmin={true}
          onApprove={onApprove}
          hasMissingFields={false}
        />,
      );

      const chip = screen.getByTestId('approval-status-chip');
      expect(chip).toHaveTextContent('未承認');

      const button = screen.getByTestId('approval-button');
      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent('サビ管承認を行う');
    });

    it('非管理者にはボタンが無効になる', () => {
      renderWithNoRipple(
        <ApprovalSection
          approvalState={defaultApprovalState}
          isAdmin={false}
          onApprove={vi.fn()}
          hasMissingFields={false}
        />,
      );

      const button = screen.getByTestId('approval-button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('承認権限がありません');
    });

    it('未入力項目がある場合は警告が表示される', () => {
      renderWithNoRipple(
        <ApprovalSection
          approvalState={defaultApprovalState}
          isAdmin={true}
          onApprove={vi.fn()}
          hasMissingFields={true}
        />,
      );

      const warning = screen.getByTestId('approval-missing-warning');
      expect(warning).toBeInTheDocument();
    });

    it('承認ボタンをクリックすると確認ダイアログが開く', () => {
      renderWithNoRipple(
        <ApprovalSection
          approvalState={defaultApprovalState}
          isAdmin={true}
          onApprove={vi.fn()}
          hasMissingFields={false}
        />,
      );

      fireEvent.click(screen.getByTestId('approval-button'));
      expect(screen.getByTestId('approval-confirm-dialog')).toBeInTheDocument();
      expect(screen.getByText('承認の確認')).toBeInTheDocument();
    });

    it('確認ダイアログで「承認する」をクリックするとonApproveが呼ばれる', () => {
      const onApprove = vi.fn();
      renderWithNoRipple(
        <ApprovalSection
          approvalState={defaultApprovalState}
          isAdmin={true}
          onApprove={onApprove}
          hasMissingFields={false}
        />,
      );

      fireEvent.click(screen.getByTestId('approval-button'));
      fireEvent.click(screen.getByTestId('approval-confirm-button'));
      expect(onApprove).toHaveBeenCalledTimes(1);
    });

    it('確認ダイアログで「キャンセル」をクリックするとonApproveは呼ばれない', () => {
      const onApprove = vi.fn();
      renderWithNoRipple(
        <ApprovalSection
          approvalState={defaultApprovalState}
          isAdmin={true}
          onApprove={onApprove}
          hasMissingFields={false}
        />,
      );

      fireEvent.click(screen.getByTestId('approval-button'));
      fireEvent.click(screen.getByTestId('approval-cancel-button'));
      expect(onApprove).not.toHaveBeenCalled();
    });
  });

  describe('承認済み状態', () => {
    it('承認済みチップとアラートを表示する', () => {
      renderWithNoRipple(
        <ApprovalSection
          approvalState={approvedState}
          isAdmin={true}
          onApprove={vi.fn()}
          hasMissingFields={false}
        />,
      );

      const chip = screen.getByTestId('approval-status-chip');
      expect(chip).toHaveTextContent('承認済み');

      const alert = screen.getByTestId('approval-success-alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('admin@example.com');
    });

    it('承認済みの場合は承認ボタンが表示されない', () => {
      renderWithNoRipple(
        <ApprovalSection
          approvalState={approvedState}
          isAdmin={true}
          onApprove={vi.fn()}
          hasMissingFields={false}
        />,
      );

      expect(screen.queryByTestId('approval-button')).not.toBeInTheDocument();
    });
  });
});
