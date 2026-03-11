/**
 * deriveCurrentScene — 場面判定 pure function テスト
 * @see #852
 */
import { describe, expect, it } from 'vitest';
import {
  deriveSceneState,
  parseTimeToMinutes,
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
  it('returns null when all entries are done', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({ sceneState: 'done', scheduledMinutes: 540 }),
      makeEntry({ sceneState: 'done', scheduledMinutes: 600 }),
    ];
    expect(selectNextScene(entries)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(selectNextScene([])).toBeNull();
  });

  it('prioritizes active over overdue', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'overdue',
        scheduledMinutes: 540,
        item: makeItem({ id: 'overdue-1', title: '遅延タスク' }),
      }),
      makeEntry({
        sceneState: 'active',
        scheduledMinutes: 570,
        progress: { startedAt: '2026-01-01T09:30:00Z', doneAt: null },
        item: makeItem({ id: 'active-1', title: '実行中タスク' }),
      }),
    ];
    const result = selectNextScene(entries);
    expect(result?.item.id).toBe('active-1');
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
    const result = selectNextScene(entries);
    expect(result?.item.id).toBe('overdue-1');
  });

  it('selects earliest overdue when multiple overdue exist', () => {
    const entries: SceneEntryWithState[] = [
      makeEntry({
        sceneState: 'overdue',
        scheduledMinutes: 600,
        item: makeItem({ id: 'overdue-2', title: '遅延B' }),
      }),
      makeEntry({
        sceneState: 'overdue',
        scheduledMinutes: 540,
        item: makeItem({ id: 'overdue-1', title: '遅延A' }),
      }),
    ];
    const result = selectNextScene(entries);
    expect(result?.item.id).toBe('overdue-1');
  });

  it('selects earliest pending when no active/overdue', () => {
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
    const result = selectNextScene(entries);
    expect(result?.item.id).toBe('pending-1');
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
    const result = selectNextScene(entries);
    expect(result?.item.id).toBe('ops-2');
    expect(result?.item.title).toBe('検温・バイタル確認');
  });
});
