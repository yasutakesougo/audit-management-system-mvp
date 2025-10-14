import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleDialog from '@/features/schedule/ScheduleDialog';
import type { ScheduleForm } from '@/features/schedule/types';

describe('ScheduleDialog branches', () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn(async (_values: ScheduleForm) => {});

  beforeEach(() => {
    onClose.mockReset();
    onSubmit.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('initialises default form, handles submission, and restores focus', async () => {
    const priorFocus = document.createElement('button');
    priorFocus.textContent = '元のフォーカス';
    document.body.appendChild(priorFocus);
    priorFocus.focus();

    const { rerender } = render(<ScheduleDialog open initial={undefined} onClose={onClose} onSubmit={onSubmit} />);

    const userIdInput = screen.getByLabelText('利用者 ID');
    expect(document.body.style.overflow).toBe('hidden');
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement as Node)).toBe(true);

    fireEvent.change(userIdInput, { target: { value: 'U-123' } });
    fireEvent.change(screen.getByLabelText('ステータス'), { target: { value: 'confirmed' } });
    fireEvent.change(screen.getByLabelText('開始'), { target: { value: '2025-03-06T09:00' } });
    fireEvent.change(screen.getByLabelText('終了'), { target: { value: '2025-03-06T11:30' } });
    fireEvent.change(screen.getByLabelText('タイトル'), { target: { value: '訪問対応' } });
    fireEvent.change(screen.getByLabelText('メモ'), { target: { value: '同行予定あり' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '保存' }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0] as ScheduleForm;
    expect(submitted.userId).toBe('U-123');
    expect(submitted.status).toBe('confirmed');
    expect(submitted.start).toBe(new Date('2025-03-06T09:00').toISOString());
    expect(submitted.end).toBe(new Date('2025-03-06T11:30').toISOString());
    expect(submitted.title).toBe('訪問対応');
    expect(submitted.note).toBe('同行予定あり');
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<ScheduleDialog open={false} initial={undefined} onClose={onClose} onSubmit={onSubmit} />);
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(priorFocus);

    priorFocus.remove();
  });

  it('guards invalid ranges and surfaces submit errors', async () => {
    const initial: ScheduleForm = {
      id: 42,
      userId: 'U-99',
      status: 'planned',
      start: '2025-03-07T03:00:00.000Z',
      end: '2025-03-07T02:00:00.000Z',
      title: '夜勤調整',
      note: '初期値',
    };
    onSubmit.mockRejectedValueOnce({ userMessage: '保存エラー' });

    render(<ScheduleDialog open initial={initial} onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.getByText('終了時刻は開始時刻より後に設定してください。')).toBeInTheDocument();
    const submitButton = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('終了'), { target: { value: '2025-03-07T12:15' } });
    expect(screen.queryByText('終了時刻は開始時刻より後に設定してください。')).not.toBeInTheDocument();
    expect(submitButton.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('保存エラー');
    expect(screen.getByRole('button', { name: '保存' })).toBeVisible();
  });
});
