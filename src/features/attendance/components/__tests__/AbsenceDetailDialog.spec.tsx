import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_ABSENT_LOG, type AbsentSupportLog } from '@/features/service-provision/domain/absentSupportLog';

import {
    AbsenceDetailDialog,
    CONTACTOR_OPTIONS,
    FOLLOW_UP_RESULTS,
    REASON_PRESETS,
    nowLocalDatetime,
    type AbsenceDetailDialogProps,
} from '../AbsenceDetailDialog';

const baseProps: AbsenceDetailDialogProps = {
  open: true,
  userName: '田中太郎',
  onSubmit: vi.fn(),
  onSkip: vi.fn(),
  onCancel: vi.fn(),
};

describe('AbsenceDetailDialog', () => {
  it('renders dialog with user name when open', () => {
    render(<AbsenceDetailDialog {...baseProps} />);
    expect(screen.getByText('欠席情報の登録')).toBeInTheDocument();
    expect(screen.getByText('田中太郎')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(<AbsenceDetailDialog {...baseProps} open={false} />);
    expect(screen.queryByText('欠席情報の登録')).not.toBeInTheDocument();
  });

  it('shows both section headers', () => {
    render(<AbsenceDetailDialog {...baseProps} />);
    expect(screen.getByText('朝連絡（受け入れ）')).toBeInTheDocument();
    expect(screen.getByText('夕方連絡（様子伺い）')).toBeInTheDocument();
  });

  it('shows all 3 action buttons', () => {
    render(<AbsenceDetailDialog {...baseProps} />);
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '後で入力' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(<AbsenceDetailDialog {...baseProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when "後で入力" button is clicked', async () => {
    const onSkip = vi.fn();
    render(<AbsenceDetailDialog {...baseProps} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: '後で入力' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmit with form data when "保存" is clicked', async () => {
    const onSubmit = vi.fn();
    render(<AbsenceDetailDialog {...baseProps} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    const submitted: AbsentSupportLog = onSubmit.mock.calls[0][0];
    // contactDateTime should be auto-populated
    expect(submitted.contactDateTime).toBeTruthy();
    expect(submitted.contactDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // followUp fields should be present (empty by default)
    expect(submitted).toHaveProperty('followUpDateTime');
    expect(submitted).toHaveProperty('followUpTarget');
    expect(submitted).toHaveProperty('followUpContent');
    expect(submitted).toHaveProperty('followUpResult');
  });

  it('populates initial data when editing', () => {
    const editData: AbsentSupportLog = {
      ...EMPTY_ABSENT_LOG,
      contactDateTime: '2026-03-02T10:30',
      contactPerson: '家族',
      absenceReason: '体調不良',
      supportContent: 'お母様から電話あり',
      followUpDateTime: '2026-03-02T17:00',
      followUpTarget: 'ご自宅',
      followUpContent: '体調回復傾向、明日は利用予定',
      followUpResult: '実施',
      nextPlannedDate: '2026-03-04',
    };
    render(<AbsenceDetailDialog {...baseProps} initialData={editData} />);

    // Contact datetime should be pre-filled
    const datetimeInput = screen.getByTestId('absence-contact-datetime')
      .querySelector('input') as HTMLInputElement;
    expect(datetimeInput.value).toBe('2026-03-02T10:30');

    // Follow-up datetime should be pre-filled
    const followUpInput = screen.getByTestId('absence-followup-datetime')
      .querySelector('input') as HTMLInputElement;
    expect(followUpInput.value).toBe('2026-03-02T17:00');
  });

  describe('nowLocalDatetime', () => {
    it('returns a string in YYYY-MM-DDThh:mm format', () => {
      const result = nowLocalDatetime();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('matches the current local time approximately', () => {
      const before = new Date();
      const result = nowLocalDatetime();
      const after = new Date();
      const resultDate = new Date(result);
      expect(resultDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - 60000);
      expect(resultDate.getTime()).toBeLessThanOrEqual(after.getTime() + 60000);
    });
  });

  describe('exports', () => {
    it('CONTACTOR_OPTIONS contains expected values', () => {
      expect(CONTACTOR_OPTIONS).toContain('本人');
      expect(CONTACTOR_OPTIONS).toContain('家族');
      expect(CONTACTOR_OPTIONS).toContain('その他');
    });

    it('REASON_PRESETS contains expected values', () => {
      expect(REASON_PRESETS).toContain('体調不良');
      expect(REASON_PRESETS).toContain('私用');
      expect(REASON_PRESETS).toContain('通院');
    });

    it('FOLLOW_UP_RESULTS contains expected values', () => {
      expect(FOLLOW_UP_RESULTS).toContain('実施');
      expect(FOLLOW_UP_RESULTS).toContain('不通');
      expect(FOLLOW_UP_RESULTS).toContain('不要');
    });
  });

  it('shows info caption about eveningChecked auto-set in section ②', () => {
    render(<AbsenceDetailDialog {...baseProps} />);
    expect(
      screen.getByText(/このセクションを入力すると、夕方の様子確認が自動的に「済」になります/),
    ).toBeInTheDocument();
  });
});
