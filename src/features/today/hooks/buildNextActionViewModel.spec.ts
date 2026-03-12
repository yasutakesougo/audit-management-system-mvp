/**
 * buildNextActionViewModel — pure builder unit tests
 *
 * ナビゲーション型 UI 移行後のテスト。
 * Start/Done/Reset アクション、status、elapsedMinutes は撤去されたため
 * テスト対象は item, urgency, sceneState, minutesUntilLabel のみ。
 */
import { describe, expect, it } from 'vitest';
import type { NextActionWithProgress } from './useNextAction';
import { buildNextActionViewModel } from './useNextAction';

type BaseInput = NextActionWithProgress;

function makeBase(overrides: Partial<BaseInput> = {}): BaseInput {
  return {
    item: {
      id: 'staff-1',
      time: '09:00',
      title: '職員朝会',
      owner: '生活支援課',
      minutesUntil: 30,
    },
    urgency: 'medium',
    sceneState: 'pending',
    sourceLane: null,
    ...overrides,
  };
}

describe('buildNextActionViewModel', () => {
  it('returns kind=empty when item is null', () => {
    const vm = buildNextActionViewModel(makeBase({ item: null }));
    expect(vm).toEqual({ kind: 'empty' });
  });

  it('returns kind=active with formatted minutesUntilLabel', () => {
    const vm = buildNextActionViewModel(makeBase());
    expect(vm.kind).toBe('active');
    if (vm.kind !== 'active') throw new Error('unreachable');
    expect(vm.time).toBe('09:00');
    expect(vm.title).toBe('職員朝会');
    expect(vm.owner).toBe('生活支援課');
    expect(vm.minutesUntilLabel).toBe('あと 30分');
  });

  it('formats minutesUntil with hours', () => {
    const vm = buildNextActionViewModel(
      makeBase({
        item: { id: '1', time: '15:00', title: '会議', minutesUntil: 150 },
      }),
    );
    if (vm.kind !== 'active') throw new Error('unreachable');
    expect(vm.minutesUntilLabel).toBe('あと 2時間30分');
  });

  it('formats exact hours without minutes suffix', () => {
    const vm = buildNextActionViewModel(
      makeBase({
        item: { id: '1', time: '12:00', title: '昼休み', minutesUntil: 120 },
      }),
    );
    if (vm.kind !== 'active') throw new Error('unreachable');
    expect(vm.minutesUntilLabel).toBe('あと 2時間');
  });

  it('sets owner to null when item has no owner', () => {
    const vm = buildNextActionViewModel(
      makeBase({
        item: { id: '1', time: '10:00', title: 'テスト', minutesUntil: 60 },
      }),
    );
    if (vm.kind !== 'active') throw new Error('unreachable');
    expect(vm.owner).toBeNull();
  });

  // ─── Scene-Based: overdue label (#852) ──────────────

  it('returns overdue minutesUntilLabel for overdue items', () => {
    const vm = buildNextActionViewModel(
      makeBase({
        sceneState: 'overdue',
        urgency: 'high',
        item: { id: 'ops-1', time: '09:15', title: '通所受け入れ', minutesUntil: -15 },
      }),
    );
    if (vm.kind !== 'active') throw new Error('unreachable');
    expect(vm.minutesUntilLabel).toBe('予定時刻を15分過ぎています');
    expect(vm.sceneState).toBe('overdue');
  });

  it('returns active sceneState for active items', () => {
    const vm = buildNextActionViewModel(
      makeBase({
        sceneState: 'active',
      }),
    );
    if (vm.kind !== 'active') throw new Error('unreachable');
    expect(vm.sceneState).toBe('active');
  });
});
