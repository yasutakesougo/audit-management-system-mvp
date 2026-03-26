import { describe, expect, it } from 'vitest';

import {
  isSchedulesConflictError,
  resolveOperationFailureFeedback,
} from '../operationFeedback';

describe('operationFeedback', () => {
  it('returns conflict feedback with warning toast contract', () => {
    const feedback = resolveOperationFailureFeedback('schedules:conflict-412');

    expect(feedback.title).toBe('更新が競合しました');
    expect(feedback.toastSeverity).toBe('warning');
    expect(feedback.toastMessage).toBe('更新が競合しました');
    expect(feedback.userMessage).toContain('最新を読み込んで');
    expect(feedback.followUpActionText).toBe('最新を読み込む');
  });

  it('detects schedules conflict errors from status and message', () => {
    expect(isSchedulesConflictError({ status: 412 })).toBe(true);
    expect(isSchedulesConflictError(new Error('The version of the item has changed (conflict)'))).toBe(true);
    expect(isSchedulesConflictError(new Error('network timeout'))).toBe(false);
  });

  it('returns rollback feedback with target user name', () => {
    const feedback = resolveOperationFailureFeedback('transport:rollback', {
      userName: '山田 太郎',
    });

    expect(feedback.toastSeverity).toBe('warning');
    expect(feedback.toastMessage).toContain('山田 太郎');
    expect(feedback.toastMessage).toContain('元に戻しました');
    expect(feedback.followUpActionText).toBe('通信状態を確認して再試行');
  });

  it('returns non-blocking sync feedback that keeps main action successful', () => {
    const feedback = resolveOperationFailureFeedback('transport:sync-non-blocking', {
      userName: '鈴木 次郎',
    });

    expect(feedback.toastSeverity).toBe('warning');
    expect(feedback.toastMessage).toContain('送迎更新は完了');
    expect(feedback.toastMessage).toContain('出欠同期');
    expect(feedback.followUpActionText).toBe('出欠画面で状態を確認');
  });
});
