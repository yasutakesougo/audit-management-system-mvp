import { computeMonitoringCycle } from '../components/sections/MonitoringCountdown';

describe('computeMonitoringCycle（利用者別アセスメント起点）', () => {
  it('アセスメント日 2026-01-15 → 次回 2026-04-15', () => {
    const assessment = new Date(2026, 0, 15); // 2026-01-15
    const now = new Date(2026, 2, 10);        // 2026-03-10
    const result = computeMonitoringCycle(assessment, now);

    expect(result.prevDate).toEqual(new Date(2026, 0, 15));
    expect(result.nextDate).toEqual(new Date(2026, 3, 15)); // 2026-04-15
    // 1/15 → 3/10 = 54日
    expect(result.elapsed).toBe(54);
    // 3/10 → 4/15 = 36日
    expect(result.remaining).toBe(36);
  });

  it('アセスメント日 2026-02-10 → 次回 2026-05-10', () => {
    const assessment = new Date(2026, 1, 10); // 2026-02-10
    const now = new Date(2026, 2, 10);        // 2026-03-10
    const result = computeMonitoringCycle(assessment, now);

    expect(result.prevDate).toEqual(new Date(2026, 1, 10));
    expect(result.nextDate).toEqual(new Date(2026, 4, 10)); // 2026-05-10
    expect(result.elapsed).toBe(28); // 2/10 → 3/10
    expect(result.remaining).toBe(61); // 3/10 → 5/10
  });

  it('次回を過ぎていたら自動的に次のサイクルへ進む', () => {
    const assessment = new Date(2025, 5, 1);  // 2025-06-01
    const now = new Date(2026, 2, 10);        // 2026-03-10

    // サイクル: 6/1 → 9/1 → 12/1 → 3/1 → 6/1
    // now=3/10 は 3/1~6/1 のサイクル内
    const result = computeMonitoringCycle(assessment, now);
    expect(result.prevDate).toEqual(new Date(2026, 2, 1));  // 2026-03-01
    expect(result.nextDate).toEqual(new Date(2026, 5, 1));  // 2026-06-01
    expect(result.elapsed).toBe(9); // 3/1 → 3/10
  });

  it('現在日がアセスメント日より前の場合', () => {
    const assessment = new Date(2026, 5, 1);  // 2026-06-01
    const now = new Date(2026, 2, 10);        // 2026-03-10

    const result = computeMonitoringCycle(assessment, now);
    expect(result.elapsed).toBe(0);
    expect(result.prevDate).toEqual(new Date(2026, 5, 1));
    expect(result.nextDate).toEqual(new Date(2026, 8, 1)); // 2026-09-01
  });

  it('ちょうどサイクル境界日の場合', () => {
    const assessment = new Date(2026, 0, 15); // 2026-01-15
    const now = new Date(2026, 3, 15);        // 2026-04-15 = 次回会議日と同日

    const result = computeMonitoringCycle(assessment, now);
    // 4/15 は次のサイクルの開始 → prevDate = 4/15, nextDate = 7/15
    expect(result.prevDate).toEqual(new Date(2026, 3, 15));
    expect(result.nextDate).toEqual(new Date(2026, 6, 15));
    expect(result.elapsed).toBe(0);
  });

  it('progress は 0-100 の範囲内', () => {
    const assessment = new Date(2026, 0, 1);
    const start = computeMonitoringCycle(assessment, new Date(2026, 0, 1));
    expect(start.progress).toBeGreaterThanOrEqual(0);
    expect(start.progress).toBeLessThanOrEqual(100);

    const mid = computeMonitoringCycle(assessment, new Date(2026, 1, 14));
    expect(mid.progress).toBeGreaterThan(30);
    expect(mid.progress).toBeLessThan(70);
  });

  it('月末日のアセスメント日も正しく処理される（1/31 → 4/30）', () => {
    const assessment = new Date(2026, 0, 31); // 2026-01-31
    const now = new Date(2026, 2, 15);        // 2026-03-15
    const result = computeMonitoringCycle(assessment, now);

    expect(result.prevDate).toEqual(new Date(2026, 0, 31));
    // 1/31 + 3ヶ月 = 4/30（4月は30日まで）
    expect(result.nextDate.getMonth()).toBe(3); // April
    expect(result.nextDate.getDate()).toBe(30);
  });
});
