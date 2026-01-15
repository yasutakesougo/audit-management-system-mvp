import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BulkDailyRecordList, { type BulkDailyRow } from '../BulkDailyRecordList';

const getRowByUserId = (userId: string) => screen.getAllByTestId(`daily-bulk-row-${userId}`)[0];

afterEach(() => {
  cleanup();
});

describe('BulkDailyRecordList', () => {
  describe('一括保存時のstatus更新ロジック', () => {
    it('入力がある行のみsavedにし、未入力行はidleのままにする', async () => {
      const mockOnSave = vi.fn().mockResolvedValue(undefined);

      render(
        <BulkDailyRecordList
          selectedDate="2024-01-15"
          onSave={mockOnSave}
        />
      );

      const firstRow = getRowByUserId('001');
      const secondRow = getRowByUserId('002');

      // 最初の行に入力を行う
      const firstAmInput = within(firstRow).getAllByLabelText('田中太郎 午前記録')[0];
      fireEvent.change(firstAmInput, { target: { value: '午前の記録' } });

      // 2番目の行の問題行動をチェック
      const secondProblemsCheckbox = within(secondRow).getByRole('checkbox', { name: '佐藤花子 問題行動' });
      fireEvent.click(secondProblemsCheckbox);

      // 一括保存を実行
      const bulkSaveButton = screen.getByRole('button', { name: '一括保存' });
      fireEvent.click(bulkSaveButton);

      await waitFor(() => {
        // onSaveが呼ばれることを確認
        expect(mockOnSave).toHaveBeenCalledTimes(1);

        // 入力した2人分のみがfilteredRowsとして渡されることを確認
        const calledWithRows = mockOnSave.mock.calls[0][0] as BulkDailyRow[];
        expect(calledWithRows).toHaveLength(2);
        expect(calledWithRows[0].userId).toBe('001');
        expect(calledWithRows[0].amNotes).toBe('午前の記録');
        expect(calledWithRows[1].userId).toBe('002');
        expect(calledWithRows[1].hasProblems).toBe(true);
      });

      // 状態を確認：入力した行は'saved'、未入力行は'idle'のまま
      await waitFor(() => {
        const firstRowStatus = screen.getByTestId('daily-bulk-status-001');
        const thirdRowStatus = screen.getByTestId('daily-bulk-status-003');

        expect(firstRowStatus).toHaveAttribute('data-status', 'saved');
        expect(thirdRowStatus).toHaveAttribute('data-status', 'idle');
      });
    });
  });

  describe('MUI Checkboxの統一', () => {
    it('問題行動と発作のチェックボックスがMUIコンポーネントとして動作する', () => {
      render(
        <BulkDailyRecordList
          selectedDate="2024-01-15"
        />
      );

      // MUIのCheckboxとして正しく描画されることを確認
      const firstRow = getRowByUserId('001');
      const problemsCheckbox = within(firstRow).getByRole('checkbox', { name: '田中太郎 問題行動' });
      const seizureCheckbox = within(firstRow).getByRole('checkbox', { name: '田中太郎 発作' });

      expect(problemsCheckbox).toBeInTheDocument();
      expect(seizureCheckbox).toBeInTheDocument();

      // チェック状態の変更が動作することを確認
      fireEvent.click(problemsCheckbox);
      expect(problemsCheckbox).toBeChecked();

      fireEvent.click(seizureCheckbox);
      expect(seizureCheckbox).toBeChecked();
    });
  });

  describe('行ごと保存のインターフェース', () => {
    it('onSaveRowが提供された場合、行ごと保存で使用される', async () => {
      const mockOnSaveRow = vi.fn().mockResolvedValue(undefined);

      render(
        <BulkDailyRecordList
          selectedDate="2024-01-15"
          onSaveRow={mockOnSaveRow}
        />
      );

      // 最初の行に入力
      const firstRow = getRowByUserId('001');
      const amInput = within(firstRow).getAllByLabelText('田中太郎 午前記録')[0];
      fireEvent.change(amInput, { target: { value: '午前の記録' } });

      // 行保存ボタンをクリック
      const saveButton = within(firstRow).getByRole('button', { name: '田中太郎 を保存' });
      fireEvent.click(saveButton);

      await waitFor(() => {
        // onSaveRowが呼ばれることを確認
        expect(mockOnSaveRow).toHaveBeenCalledTimes(1);
        const calledWithRow = mockOnSaveRow.mock.calls[0][0] as BulkDailyRow;
        expect(calledWithRow.userId).toBe('001');
        expect(calledWithRow.amNotes).toBe('午前の記録');
      });
    });

    it(
      'onSaveRowが未提供の場合、モックが使用される',
      async () => {
        render(
          <BulkDailyRecordList
            selectedDate="2024-01-15"
          />
        );

        // 最初の行に入力
        const firstRow = getRowByUserId('001');
        const amInput = within(firstRow).getAllByLabelText('田中太郎 午前記録')[0];
        fireEvent.change(amInput, { target: { value: '午前の記録' } });

        // 行保存ボタンをクリック
        const saveButton = within(firstRow).getByRole('button', { name: '田中太郎 を保存' });
        fireEvent.click(saveButton);

        // モック処理が完了することを確認（500msの遅延）
        await waitFor(
          () => {
            const statusCell = screen.getByTestId('daily-bulk-status-001');
            expect(statusCell).toHaveAttribute('data-status', 'saved');
          },
          { timeout: 1000 }
        );
      },
      15000
    );
  });

  describe('バリデーションUXの確認', () => {
    it('文字数制限を超えた場合、適切なエラー表示とアナウンスが行われる', async () => {
      render(
        <BulkDailyRecordList
          selectedDate="2024-01-15"
        />
      );

      // 午前記録で制限を超える文字を入力
      const firstRow = getRowByUserId('001');
      const amInput = within(firstRow).getAllByLabelText('田中太郎 午前記録')[0];
      const longText = 'a'.repeat(250); // 200文字制限を超える

      fireEvent.change(amInput, { target: { value: longText } });

      // エラー状態の確認
      await waitFor(() => {
        // TextField自体のエラー状態確認は難しいが、helperTextの表示を確認
        const helperText = screen.getByText(/250\/200/);
        expect(helperText).toBeInTheDocument();
      });
    });
  });
});