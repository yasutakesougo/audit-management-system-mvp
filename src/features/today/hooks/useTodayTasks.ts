/**
 * useTodayTasks — Hook that connects existing data hooks to TodayEngine
 *
 * Phase 3 #2 (#825)
 *
 * Data flow:
 *   useTodaySummary → pendingUserIds, briefingAlerts, scheduleLanesToday
 *   useHandoffTimeline → unhandled items
 *       ↓
 *   buildTodayTasks() → TodayTask[]
 *       ↓
 *   dedupeTasks() → deduped
 *   summarizeTasks() → summary
 *   pickFocusTask() → focus
 *       ↓
 *   return { tasks, summary, focus, isLoading }
 *
 * ✅ No changes to existing hooks.
 * ✅ TodayEngine is pure — all side effects stay in this hook.
 */
import { useMemo } from 'react';
import { useHandoffTimeline } from '@/features/handoff/useHandoffTimeline';
import { useTodaySummary } from '../domain/useTodaySummary';
import {
  buildTodayTasks,
  dedupeTasks,
  summarizeTasks,
  pickFocusTask,
  type TodayTask,
  type TodayTaskSummary,
  type FocusTask,
  type TodayEngineInput,
} from '@/domain/todayEngine';

// ─── Result Type ─────────────────────────────────────────────────────────

export interface TodayTasksResult {
  /** Priority-sorted, deduped task list */
  tasks: TodayTask[];
  /** Aggregate counts */
  summary: TodayTaskSummary;
  /** Single most urgent task + reason (null when all done) */
  focus: FocusTask | null;
  /** True while upstream data is still loading */
  isLoading: boolean;
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useTodayTasks(): TodayTasksResult {
  // 1. Existing hooks — no modifications
  const todaySummary = useTodaySummary();
  const { todayHandoffs, loading: handoffLoading } = useHandoffTimeline('all', 'today');

  // 2. Map users for name resolution
  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of todaySummary.users) {
      const uid = (u.UserID ?? '').trim() || `U${String(u.Id ?? 0).padStart(3, '0')}`;
      const name = u.FullName ?? u.Title ?? uid;
      map.set(uid, name);
    }
    return map;
  }, [todaySummary.users]);

  // 3. Build engine input from existing sources
  const engineInput: TodayEngineInput = useMemo(() => {
    // Unhandled handoff items (status !== '完了' and not '明日へ持越')
    const handoffItems = todayHandoffs
      .filter((h) => h.status !== '完了' && h.status !== '明日へ持越')
      .map((h) => ({
        id: String(h.id),
        userId: h.userCode ?? '',
        label: h.title || h.message?.slice(0, 30) || '申し送り',
      }));

    // Flatten schedule lanes
    const allLanes = [
      ...todaySummary.scheduleLanesToday.staffLane,
      ...todaySummary.scheduleLanesToday.userLane,
      ...todaySummary.scheduleLanesToday.organizationLane,
    ];

    return {
      pendingUserIds: todaySummary.dailyRecordStatus.pendingUserIds,
      briefingAlerts: todaySummary.briefingAlerts.map((a) => ({
        id: a.id ?? `alert-${a.label}`,
        userId: a.items?.[0]?.userId ?? '',
        label: a.label,
      })),
      scheduleLanes: allLanes,
      handoffItems,
      resolveUserName: (uid: string) => userNameMap.get(uid) ?? uid,
    };
  }, [
    todayHandoffs,
    todaySummary.dailyRecordStatus.pendingUserIds,
    todaySummary.briefingAlerts,
    todaySummary.scheduleLanesToday,
    userNameMap,
  ]);

  // 4. Run pure engine pipeline
  const result = useMemo(() => {
    const raw = buildTodayTasks(engineInput);
    const deduped = dedupeTasks(raw);
    const summary = summarizeTasks(deduped);
    const focus = pickFocusTask(deduped);
    return { tasks: deduped, summary, focus };
  }, [engineInput]);

  return {
    ...result,
    isLoading: handoffLoading,
  };
}
