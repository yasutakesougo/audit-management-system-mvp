/**
 * deriveCurrentScene — 場面判定 pure function テスト
 * @see #852
 */
import { describe, expect, it } from 'vitest';
import {
  deriveSceneState,
  parseTimeToMinutes,
  scoreSceneEntry,
  selectNextScene,
  type SceneEntryWithState,
} from './deriveCurrentScene';
import type { TodayScheduleLane } from './todayScheduleLane';

// ─── Helpers ──────────────────────────────────────────────────

function makeItem(overrides: Partial<TodayScheduleLane> = {}): TodayScheduleLane {
  return {
    id: 'test-item',
    time: '09:00',
    title: 'テスト予定',
    ...overrides,
  };
}

function makeEntry(
  overrides: Partial<SceneEntryWithState> & { sceneState: SceneEntryWithState['sceneState'] },
): SceneEntryWithState {
  return {
    item: makeItem(),
    progressKey: 'key-1',
    progress: null,
    scheduledMinutes: 540, // 09:00
    ...overrides,
  };
}

// ─── deriveSceneState ─────────────────────────────────────────

describe('deriveSceneState', () => {
  it('returns "done" when doneAt is set', () => {
    const progress = { startedAt: '2026-01-01T09:00:00Z', doneAt: '2026-01-01T09:15:00Z' };
    expect(deriveSceneState(progress, 540, 600)).toBe('done');
  });

  it('returns "active" when startedAt is set (no doneAt)', () => {
    const progress = { startedAt: '2026-01-01T09:00:00Z', doneAt: null };
    expect(deriveSceneState(progress, 540, 600)).toBe('active');
  });

  it('returns "overdue" when current time >= scheduled and no progress', () => {
    expect(deriveSceneState(null, 540, 540)).toBe('overdue'); // exactly at time
    expect(deriveSceneState(null, 540, 600)).toBe('overdue'); // past time
  });

  it('returns "pending" when current time < scheduled and no progress', () => {
    expect(deriveSceneState(null, 540, 500)).toBe('pending');
  });

  it('returns "done" even if current time is before scheduled', () => {
    const progress = { startedAt: '2026-01-01T08:50:00Z', doneAt: '2026-01-01T08:55:00Z' };
    expect(deriveSceneState(progress, 540, 500)).toBe('done');
  });

  it('returns "pending" when progress is null and time is future', () => {
    expect(deriveSceneState(null, 960, 540)).toBe('pending'); // 16:00, now 09:00
  });
});

// ─── parseTimeToMinutes ───────────────────────────────────────

describe('parseTimeToMinutes', () => {
  it('parses "09:00" to 540', () => {
    expect(parseTimeToMinutes('09:00')).toBe(540);
  });

  it('parses "16:30" to 990', () => {
    expect(parseTimeToMinutes('16:30')).toBe(990);
  });

  it('handles "00:00"', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
  });

  it('handles malformed input gracefully', () => {
    expect(parseTimeToMinutes('abc')).toBe(0); // NaN → 0
  });
});

// ─── selectNextScene ──────────────────────────────────────────

describe('selectNextScene', () => {
  const now = new Date('2026-03-28T10:00:00+09:00');
  const currentMinutes = 10 * 60; // 10:00

  it('returns null when all entries are done', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({ sceneState: 'done', scheduledMinutes: 540 }),
      makeEntry({ sceneState: 'done', scheduledMinutes: 600 }),
    ];
    expect(selectNextScene(entries, currentMinutes, now)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(selectNextScene([], currentMinutes, now)).toBeNull();
  });

  it('keeps fresh active over overdue', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'overdue',
        scheduledMinutes: 540,
        item: makeItem({ id: 'overdue-1', title: '遅延タスク' }),
      }),
      makeEntry({
        sceneState: 'active',
        scheduledMinutes: 570,
        progress: { startedAt: '2026-03-28T09:45:00+09:00', doneAt: null },
        item: makeItem({ id: 'active-1', title: '実行中タスク' }),
      }),
    ];
    const result = selectNextScene(entries, currentMinutes, now);
    expect(result?.item.id).toBe('active-1');
  });

  it('demotes stale active when overdue exists', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'active',
        scheduledMinutes: 540,
        progress: { startedAt: '2026-03-28T06:30:00+09:00', doneAt: null },
        item: makeItem({ id: 'active-stale', title: '長時間実行中' }),
      }),
      makeEntry({
        sceneState: 'overdue',
        scheduledMinutes: 570,
        item: makeItem({ id: 'overdue-1', title: '遅延タスク' }),
      }),
    ];
    const result = selectNextScene(entries, currentMinutes, now);
    expect(result?.item.id).toBe('overdue-1');
  });

  it('prioritizes overdue over pending', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 960,
        item: makeItem({ id: 'pending-1', title: '待機タスク' }),
      }),
      makeEntry({
        sceneState: 'overdue',
        scheduledMinutes: 540,
        item: makeItem({ id: 'overdue-1', title: '遅延タスク' }),
      }),
    ];
    const result = selectNextScene(entries, currentMinutes, now);
    expect(result?.item.id).toBe('overdue-1');
  });

  it('prioritizes more delayed overdue entry', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'overdue',
        scheduledMinutes: 595,
        item: makeItem({ id: 'overdue-2', title: '遅延B' }),
      }),
      makeEntry({
        sceneState: 'overdue',
        scheduledMinutes: 540,
        item: makeItem({ id: 'overdue-1', title: '遅延A' }),
      }),
    ];
    const result = selectNextScene(entries, currentMinutes, now);
    expect(result?.item.id).toBe('overdue-1');
  });

  it('selects nearest pending when no active/overdue', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 720,
        item: makeItem({ id: 'pending-2', title: '昼の予定' }),
      }),
      makeEntry({
        sceneState: 'done',
        scheduledMinutes: 540,
        item: makeItem({ id: 'done-1', title: '朝の予定完了' }),
      }),
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 600,
        item: makeItem({ id: 'pending-1', title: '午前の予定' }),
      }),
    ];
    const result = selectNextScene(entries, currentMinutes, now);
    expect(result?.item.id).toBe('pending-1');
  });

  it('uses opsStep order as tie-breaker for same time pending', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 620,
        item: makeItem({ id: 'ops-am', title: '午前記録', opsStep: 'amRecord' }),
      }),
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 620,
        item: makeItem({ id: 'ops-temp', title: '検温', opsStep: 'temperature' }),
      }),
    ];
    const result = selectNextScene(entries, currentMinutes, now);
    expect(result?.item.id).toBe('ops-temp');
  });

  it('falls back to id for deterministic ordering on complete tie', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 620,
        item: makeItem({ id: 'b-id', title: '同点B' }),
      }),
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 620,
        item: makeItem({ id: 'a-id', title: '同点A' }),
      }),
    ];
    const result = selectNextScene(entries, currentMinutes, now);
    expect(result?.item.id).toBe('a-id');
  });

  it('full workflow: intake → done → selects next pending', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'done',
        scheduledMinutes: 555, // 09:15 intake
        progress: { startedAt: '2026-01-01T09:15:00Z', doneAt: '2026-01-01T09:25:00Z' },
        item: makeItem({ id: 'ops-1', title: '通所受け入れ', opsStep: 'intake' }),
      }),
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 570, // 09:30 temperature
        item: makeItem({ id: 'ops-2', title: '検温・バイタル確認', opsStep: 'temperature' }),
      }),
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 600, // 10:00 amRecord
        item: makeItem({ id: 'ops-3', title: '午前の過ごし記録', opsStep: 'amRecord' }),
      }),
    ];
    const result = selectNextScene(entries, currentMinutes, now);
    expect(result?.item.id).toBe('ops-2');
    expect(result?.item.title).toBe('検温・バイタル確認');
  });
});

describe('scoreSceneEntry', () => {
  const now = new Date('2026-03-28T10:00:00+09:00');
  const currentMinutes = 10 * 60;

  it('adds overdue bonus for larger delay', () => {
    const recentOverdue = makeEntry({ sceneState: 'overdue', scheduledMinutes: 595 });
    const oldOverdue = makeEntry({ sceneState: 'overdue', scheduledMinutes: 540 });

    const recentScore = scoreSceneEntry(recentOverdue, {
      currentMinutes,
      hasOverdueEntries: true,
      now,
    });
    const oldScore = scoreSceneEntry(oldOverdue, {
      currentMinutes,
      hasOverdueEntries: true,
      now,
    });

    expect(oldScore).toBeGreaterThan(recentScore);
  });

  it('penalizes stale active when overdue exists', () => {
    const staleActive = makeEntry({
      sceneState: 'active',
      scheduledMinutes: 540,
      progress: { startedAt: '2026-03-28T06:30:00+09:00', doneAt: null },
    });
    const freshActive = makeEntry({
      sceneState: 'active',
      scheduledMinutes: 570,
      progress: { startedAt: '2026-03-28T09:50:00+09:00', doneAt: null },
    });

    const staleScore = scoreSceneEntry(staleActive, {
      currentMinutes,
      hasOverdueEntries: true,
      now,
    });
    const freshScore = scoreSceneEntry(freshActive, {
      currentMinutes,
      hasOverdueEntries: true,
      now,
    });

    expect(freshScore).toBeGreaterThan(staleScore);
  });
});

// ─── scenario checks (実データ想定) ───────────────────────────

describe('selectNextScene scenario checks', () => {
  const now = new Date('2026-03-28T10:05:00+09:00');
  const currentMinutes = 10 * 60 + 5;

  it('morning ops: stale intake(active) is bypassed and overdue temperature is selected', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'active',
        scheduledMinutes: 9 * 60 + 15, // 09:15 intake
        progress: { startedAt: '2026-03-28T07:30:00+09:00', doneAt: null },
        item: makeItem({ id: 'ops-1', title: '通所受け入れ', opsStep: 'intake' }),
      }),
      makeEntry({
        sceneState: 'overdue',
        scheduledMinutes: 9 * 60 + 30, // 09:30 temperature
        item: makeItem({ id: 'ops-2', title: '検温・バイタル確認', opsStep: 'temperature' }),
      }),
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 10 * 60 + 30, // 10:30 amRecord
        item: makeItem({ id: 'ops-3', title: '午前の過ごし記録', opsStep: 'amRecord' }),
      }),
    ];

    const result = selectNextScene(entries, currentMinutes, now);
    expect(result?.item.id).toBe('ops-2');
  });

  it('before opening: nearest pending task is selected across lanes', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 10 * 60 + 20,
        item: makeItem({ id: 'staff-1', title: '検温・バイタル確認', opsStep: 'temperature' }),
      }),
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 10 * 60 + 35,
        item: makeItem({ id: 'org-1', title: '連絡会資料確認' }),
      }),
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 10 * 60 + 40,
        item: makeItem({ id: 'user-1', title: '個別支援', owner: '利用者A' }),
      }),
    ];

    const result = selectNextScene(entries, currentMinutes, now);
    expect(result?.item.id).toBe('staff-1');
  });

  it('same-time pending ops picks earlier opsStep (temperature before amRecord)', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 10 * 60 + 30,
        item: makeItem({ id: 'ops-am', title: '午前記録', opsStep: 'amRecord' }),
      }),
      makeEntry({
        sceneState: 'pending',
        scheduledMinutes: 10 * 60 + 30,
        item: makeItem({ id: 'ops-temp', title: '検温', opsStep: 'temperature' }),
      }),
    ];

    const result = selectNextScene(entries, currentMinutes, now);
    expect(result?.item.id).toBe('ops-temp');
  });
});
