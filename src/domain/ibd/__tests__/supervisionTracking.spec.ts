import { describe, expect, it } from 'vitest';

import {
  createInitialSupervisionCounter,
  getSupervisionAlertLevel,
  getSupervisionAlertMessage,
  incrementSupervisionCounter,
  resetSupervisionCounter,
} from '../supervisionTracking';

describe('supervisionTracking', () => {
  it('初期カウンターは 0 回・最終観察日なし', () => {
    const counter = createInitialSupervisionCounter(101);
    expect(counter).toEqual({
      userId: 101,
      supportCount: 0,
      lastObservedAt: null,
    });
  });

  it('支援回数をインクリメントできる', () => {
    const counter = createInitialSupervisionCounter(101);
    const next = incrementSupervisionCounter(counter);
    expect(next.supportCount).toBe(1);
    expect(next.lastObservedAt).toBeNull();
  });

  it('観察実施でカウンターをリセットできる', () => {
    const counter = incrementSupervisionCounter(createInitialSupervisionCounter(101));
    const observedAt = '2026-04-13T09:00:00.000Z';
    const next = resetSupervisionCounter(counter, observedAt);
    expect(next.supportCount).toBe(0);
    expect(next.lastObservedAt).toBe(observedAt);
  });

  it('アラート判定は 0=ok / 1=warning / 2以上=overdue', () => {
    expect(getSupervisionAlertLevel(0)).toBe('ok');
    expect(getSupervisionAlertLevel(1)).toBe('warning');
    expect(getSupervisionAlertLevel(2)).toBe('overdue');
    expect(getSupervisionAlertLevel(5)).toBe('overdue');
  });

  it('アラートメッセージは閾値に応じて出し分ける', () => {
    expect(getSupervisionAlertMessage(0)).toBe('');
    expect(getSupervisionAlertMessage(1)).toContain('次回の支援前');
    expect(getSupervisionAlertMessage(2)).toContain('観察義務超過');
  });
});
