import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useISPComparisonEditor } from '../useISPComparisonEditor';

describe('useISPComparisonEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /* ── updateGoalText ── */
  it('updates goal text', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    const id = result.current.currentPlan.goals[0].id;

    act(() => result.current.updateGoalText(id, 'テスト'));
    expect(result.current.currentPlan.goals.find((g) => g.id === id)?.text).toBe('テスト');
  });

  /* ── toggleDomain (on / off) ── */
  it('toggles domain tag on and off', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    const id = result.current.currentPlan.goals[0].id;

    act(() => result.current.toggleDomain(id, 'health'));
    expect(result.current.currentPlan.goals.find((g) => g.id === id)?.domains).toContain('health');

    act(() => result.current.toggleDomain(id, 'health'));
    expect(
      result.current.currentPlan.goals.find((g) => g.id === id)?.domains,
    ).not.toContain('health');
  });

  /* ── copyFromPrevious + timer cleanup ── */
  it('copyFromPrevious sets copiedId and clears after 1500ms', () => {
    const { result, unmount } = renderHook(() => useISPComparisonEditor());
    const id = result.current.currentPlan.goals[0].id;

    act(() => result.current.copyFromPrevious(id));
    expect(result.current.copiedId).toBe(id);
    // テキストも前回の内容にコピーされている
    expect(result.current.currentPlan.goals.find((g) => g.id === id)?.text).not.toBe('');

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.copiedId).toBe(null);

    // unmount中にtimerが残っても落ちないことを確認
    unmount();
  });

  /* ── progress.pct ── */
  it('progress.pct reflects number of filled goals', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    const ids = result.current.currentPlan.goals.map((g) => g.id);

    expect(result.current.progress.pct).toBe(0);

    act(() => result.current.updateGoalText(ids[0], 'x'));
    expect(result.current.progress.pct).toBe(Math.round((1 / ids.length) * 100));

    // 全部埋める
    act(() => {
      ids.forEach((id) => result.current.updateGoalText(id, 'filled'));
    });
    expect(result.current.progress.pct).toBe(100);
  });

  /* ── domainCoverage ── */
  it('domainCoverage reflects tagged domains', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    const id = result.current.currentPlan.goals[0].id;

    // 初期状態: 全て未カバー
    expect(result.current.domainCoverage.every((d) => !d.covered)).toBe(true);

    act(() => result.current.toggleDomain(id, 'health'));
    const healthCov = result.current.domainCoverage.find((d) => d.id === 'health');
    expect(healthCov?.covered).toBe(true);
  });

  /* ── diff (memo-optimized) ── */
  it('diff is null when showDiff is off', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    act(() => result.current.toggleDiff()); // OFF
    expect(result.current.diff).toBeNull();
  });

  it('diff is computed when showDiff is on and text is present', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    const id = result.current.currentPlan.goals[0].id;

    // activeGoalId defaults to 'g1', copy from previous to get text
    act(() => result.current.copyFromPrevious(id));
    // diff should exist (showDiff defaults to true)
    expect(result.current.diff).not.toBeNull();
    expect(result.current.diff!.length).toBeGreaterThan(0);
  });

  /* ── daysRemaining ── */
  it('daysRemaining is a positive number for future expiry', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    expect(result.current.daysRemaining).toBeGreaterThan(0);
  });

  /* ── sidebar / smart toggles ── */
  it('toggleSidebar flips sidebarOpen', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    const initial = result.current.sidebarOpen;
    act(() => result.current.toggleSidebar());
    expect(result.current.sidebarOpen).toBe(!initial);
  });

  it('toggleSmart flips showSmart', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    expect(result.current.showSmart).toBe(false);
    act(() => result.current.toggleSmart());
    expect(result.current.showSmart).toBe(true);
  });
});
