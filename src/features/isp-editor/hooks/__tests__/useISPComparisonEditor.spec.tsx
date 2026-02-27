import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock useToast
const mockShow = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: mockShow }),
}));

// Mock useUsersStore with sample users
vi.mock('@/features/users/store', () => ({
  useUsersStore: () => ({
    data: [
      { Id: 1, FullName: '山田 太郎', UserID: 'U001', RecipientCertExpiry: '2026-05-31' },
      { Id: 2, FullName: '田中 花子', UserID: 'U002', RecipientCertExpiry: '2027-03-31' },
    ],
  }),
}));

import { useISPComparisonEditor } from '../useISPComparisonEditor';

describe('useISPComparisonEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    mockShow.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  /* ── users list ── */
  it('provides mapped users from store', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    expect(result.current.users).toHaveLength(2);
    expect(result.current.users[0]).toEqual({ id: '1', label: '山田 太郎' });
    expect(result.current.users[1]).toEqual({ id: '2', label: '田中 花子' });
  });

  /* ── selectUser ── */
  it('selectUser switches plan userName', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    act(() => result.current.selectUser('2'));
    expect(result.current.selectedUserId).toBe('2');
    expect(result.current.currentPlan.userName).toBe('田中 花子');
  });

  /* ── dirty detection ── */
  it('dirty is false on initial state', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    expect(result.current.dirty).toBe(false);
  });

  it('dirty becomes true after text change', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    const id = result.current.currentPlan.goals[0].id;
    act(() => result.current.updateGoalText(id, 'テスト'));
    expect(result.current.dirty).toBe(true);
  });

  /* ── save ── */
  it('save calls toast and resets dirty', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    // Select user first
    act(() => result.current.selectUser('1'));
    // Make a change
    const id = result.current.currentPlan.goals[0].id;
    act(() => result.current.updateGoalText(id, 'テスト'));
    expect(result.current.dirty).toBe(true);

    // Save
    act(() => result.current.save());
    expect(result.current.dirty).toBe(false);
    expect(result.current.lastSavedAt).toBeGreaterThan(0);
    expect(mockShow).toHaveBeenCalledWith('success', '保存しました');
  });

  it('save without user shows warning toast', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    act(() => result.current.save());
    expect(mockShow).toHaveBeenCalledWith('warning', '利用者を選択してください');
  });

  /* ── draft persistence on user switch ── */
  it('selectUser loads existing draft', () => {
    const { result } = renderHook(() => useISPComparisonEditor());

    // Select user 1 and make a change
    act(() => result.current.selectUser('1'));
    const id = result.current.currentPlan.goals[0].id;
    act(() => result.current.updateGoalText(id, '保存される目標'));
    act(() => result.current.save());

    // Switch to user 2
    act(() => result.current.selectUser('2'));
    expect(result.current.currentPlan.userName).toBe('田中 花子');

    // Switch back to user 1 — should restore draft
    act(() => result.current.selectUser('1'));
    expect(result.current.currentPlan.goals[0].text).toBe('保存される目標');
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
    expect(result.current.currentPlan.goals.find((g) => g.id === id)?.text).not.toBe('');

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.copiedId).toBe(null);
    unmount();
  });

  /* ── progress.pct ── */
  it('progress.pct reflects number of filled goals', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    const ids = result.current.currentPlan.goals.map((g) => g.id);

    expect(result.current.progress.pct).toBe(0);

    act(() => result.current.updateGoalText(ids[0], 'x'));
    expect(result.current.progress.pct).toBe(Math.round((1 / ids.length) * 100));

    act(() => {
      ids.forEach((id) => result.current.updateGoalText(id, 'filled'));
    });
    expect(result.current.progress.pct).toBe(100);
  });

  /* ── domainCoverage ── */
  it('domainCoverage reflects tagged domains', () => {
    const { result } = renderHook(() => useISPComparisonEditor());
    const id = result.current.currentPlan.goals[0].id;

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
    act(() => result.current.copyFromPrevious(id));
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
