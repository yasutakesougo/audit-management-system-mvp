/**
 * buildNextActionViewModel — pure builder unit tests
 */
import { describe, expect, it, vi } from 'vitest';
import type { NextActionWithProgress } from './useNextAction';
import { buildNextActionViewModel } from './useNextAction';

const noop = () => {};

type BaseInput = Omit<NextActionWithProgress, 'viewModel'>;

function makeBase(overrides: Partial<BaseInput> = {}): BaseInput {
  return {
    item: {
      id: 'staff-1',
      time: '09:00',
      title: '職員朝会',
      owner: '生活支援課',
      minutesUntil: 30,
    },
    progress: null,
    progressKey: 'test-key',
    status: 'idle',
    urgency: 'medium',
    elapsedMinutes: null,
    actions: { start: noop, done: noop, reset: noop },
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
    expect(vm.elapsedLabel).toBeNull();
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

  it('formats elapsedLabel for started state', () => {
    const vm = buildNextActionViewModel(
      makeBase({
        status: 'started',
        elapsedMinutes: 15,
        progress: { startedAt: new Date().toISOString(), doneAt: null },
      }),
    );
    if (vm.kind !== 'active') throw new Error('unreachable');
    expect(vm.elapsedLabel).toBe('15分経過');
  });

  it('formats elapsedLabel with hours', () => {
    const vm = buildNextActionViewModel(
      makeBase({
        status: 'started',
        elapsedMinutes: 90,
        progress: { startedAt: new Date().toISOString(), doneAt: null },
      }),
    );
    if (vm.kind !== 'active') throw new Error('unreachable');
    expect(vm.elapsedLabel).toBe('1時間30分経過');
  });

  it('returns null elapsedLabel for done state (elapsed not displayed)', () => {
    const vm = buildNextActionViewModel(
      makeBase({
        status: 'done',
        elapsedMinutes: null,
        progress: {
          startedAt: new Date().toISOString(),
          doneAt: new Date().toISOString(),
        },
      }),
    );
    if (vm.kind !== 'active') throw new Error('unreachable');
    expect(vm.status).toBe('done');
    expect(vm.elapsedLabel).toBeNull();
  });

  it('delegates onStart/onDone to actions.start/actions.done', () => {
    const start = vi.fn();
    const done = vi.fn();
    const vm = buildNextActionViewModel(
      makeBase({ actions: { start, done, reset: noop } }),
    );
    if (vm.kind !== 'active') throw new Error('unreachable');

    vm.onStart();
    expect(start).toHaveBeenCalledTimes(1);

    vm.onDone();
    expect(done).toHaveBeenCalledTimes(1);
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
});
