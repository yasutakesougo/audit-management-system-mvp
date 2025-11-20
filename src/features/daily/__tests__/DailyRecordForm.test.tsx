import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PersonDaily } from '../../../domain/daily/types';
import { DailyRecordForm } from '../DailyRecordForm';

const mockRecord: PersonDaily = {
  id: 1,
  personId: '001',
  personName: '田中太郎',
  date: '2024-01-15',
  status: '作成中',
  reporter: { name: '山田花子' },
  draft: { isDraft: true },
  kind: 'A',
  data: {
    amActivities: ['運動'],
    pmActivities: ['手工芸'],
    amNotes: '午前のメモ',
    pmNotes: '午後のメモ',
    mealAmount: '完食',
    problemBehavior: {
      selfHarm: true,
      violence: false,
      loudVoice: false,
      pica: false,
      other: false,
      otherDetail: ''
    },
    seizureRecord: {
      occurred: false,
      time: '',
      duration: '',
      severity: undefined,
      notes: ''
    },
    specialNotes: '特記事項'
  }
};

describe('DailyRecordForm', () => {
  describe('フォーム初期化', () => {
    it('新規作成時に空のフォームを表示する', () => {
      const mockOnSave = vi.fn();
      const mockOnClose = vi.fn();

      render(
        <DailyRecordForm
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const today = new Date().toISOString().split('T')[0];
      expect(screen.getByLabelText('日付')).toHaveValue(today);
      expect(screen.getByRole('textbox', { name: /記録者名/ })).toHaveValue('');
    });

    it('編集時に既存データを表示する', () => {
      const mockOnSave = vi.fn();
      const mockOnClose = vi.fn();

      render(
        <DailyRecordForm
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          record={mockRecord}
        />
      );

      expect(screen.getByRole('textbox', { name: /記録者名/ })).toHaveValue('山田花子');
      expect(screen.getByRole('textbox', { name: /午前の記録/ })).toHaveValue('午前のメモ');
      expect(screen.getByRole('textbox', { name: /午後の記録/ })).toHaveValue('午後のメモ');
    });
  });

  describe('バリデーション', () => {
    it('必須項目が未入力の場合、保存ボタンが無効になる', () => {
      const mockOnSave = vi.fn();
      const mockOnClose = vi.fn();

      render(
        <DailyRecordForm
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByRole('button', { name: /保存/ });
      expect(saveButton).toBeDisabled();
    });

    it('必須項目を入力すると保存ボタンが有効になる', async () => {
      const mockOnSave = vi.fn();
      const mockOnClose = vi.fn();

      render(
        <DailyRecordForm
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // 利用者を選択
      const userSelect = screen.getByRole('combobox', { name: /利用者/ });
      fireEvent.mouseDown(userSelect);
      fireEvent.click(screen.getByRole('option', { name: /田中太郎/ }));

      // 記録者名を入力
      const reporterInput = screen.getByRole('textbox', { name: /記録者名/ });
      fireEvent.change(reporterInput, { target: { value: '記録者' } });

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /保存/ });
        expect(saveButton).toBeEnabled();
      });
    });
  });

  describe('型安全性の確認', () => {
    it('handleDataChangeが正しい型で動作する', async () => {
      const mockOnSave = vi.fn();
      const mockOnClose = vi.fn();

      render(
        <DailyRecordForm
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          record={mockRecord}
        />
      );

      // 文字列フィールドの更新
      const amNotesInput = screen.getByRole('textbox', { name: /午前の記録/ });
      fireEvent.change(amNotesInput, { target: { value: '新しい午前のメモ' } });

      expect(amNotesInput).toHaveValue('新しい午前のメモ');

      // MealAmountフィールドの更新
      const mealSelect = screen.getByRole('combobox', { name: /食事摂取量/ });
      fireEvent.mouseDown(mealSelect);
      fireEvent.click(screen.getByRole('option', { name: /半分/ }));

      expect(mealSelect).toHaveTextContent('半分');
    });
  });

  describe('フォーム送信', () => {
    it('保存時に正しいデータ構造でonSaveが呼ばれる', async () => {
      const mockOnSave = vi.fn();
      const mockOnClose = vi.fn();

      render(
        <DailyRecordForm
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          record={mockRecord}
        />
      );

      const saveButton = screen.getByRole('button', { name: /更新/ });
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith({
        personId: '001',
        personName: '田中太郎',
        date: '2024-01-15',
        status: '作成中',
        reporter: { name: '山田花子' },
        draft: { isDraft: true },
        kind: 'A', // record.kindが正しく使われている
        data: expect.objectContaining({
          amActivities: ['運動'],
          pmActivities: ['手工芸'],
          mealAmount: '完食',
          problemBehavior: expect.objectContaining({
            selfHarm: true,
            violence: false
          })
        })
      });
    });
  });
});