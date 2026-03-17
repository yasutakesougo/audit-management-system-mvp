/**
 * useChangeDetection.spec — P5-C3: 変化検出 hook テスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNumberChange, useRateChange } from '../useChangeDetection';

describe('useNumberChange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('初回レンダリングでは justChanged=false, delta=undefined', () => {
    const { result } = renderHook(() => useNumberChange(5));
    expect(result.current.justChanged).toBe(false);
    expect(result.current.delta).toBeUndefined();
    expect(result.current.previous).toBeUndefined();
  });

  it('値が変化すると justChanged=true, delta を算出する', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useNumberChange(value),
      { initialProps: { value: 5 } },
    );

    // 値を 8 に変更
    rerender({ value: 8 });

    expect(result.current.justChanged).toBe(true);
    expect(result.current.delta).toBe(3);
    expect(result.current.previous).toBe(5);
  });

  it('HIGHLIGHT_DURATION 後に justChanged が false に戻る', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useNumberChange(value),
      { initialProps: { value: 5 } },
    );

    rerender({ value: 8 });
    expect(result.current.justChanged).toBe(true);

    // 1500ms 経過
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.justChanged).toBe(false);
  });

  it('値が減少した場合は delta が負になる', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useNumberChange(value),
      { initialProps: { value: 10 } },
    );

    rerender({ value: 7 });

    expect(result.current.delta).toBe(-3);
  });

  it('同じ値での再レンダリングでは justChanged=false のまま', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useNumberChange(value),
      { initialProps: { value: 5 } },
    );

    rerender({ value: 5 });
    expect(result.current.justChanged).toBe(false);
    expect(result.current.delta).toBeUndefined();
  });
});

describe('useRateChange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('初回は directionIcon が空文字', () => {
    const { result } = renderHook(() => useRateChange(0.5));
    expect(result.current.directionIcon).toBe('');
    expect(result.current.justChanged).toBe(false);
  });

  it('率が上昇したら directionIcon=↑', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useRateChange(value),
      { initialProps: { value: 0.5 as number | undefined } },
    );

    rerender({ value: 0.8 });

    expect(result.current.directionIcon).toBe('↑');
    expect(result.current.justChanged).toBe(true);
  });

  it('率が低下したら directionIcon=↓', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useRateChange(value),
      { initialProps: { value: 0.8 as number | undefined } },
    );

    rerender({ value: 0.5 });

    expect(result.current.directionIcon).toBe('↓');
  });

  it('undefined → 数値への変化は検出しない', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useRateChange(value),
      { initialProps: { value: undefined as number | undefined } },
    );

    rerender({ value: 0.5 });
    expect(result.current.justChanged).toBe(false);
  });

  it('HIGHLIGHT_DURATION 後にリセットする', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useRateChange(value),
      { initialProps: { value: 0.5 as number | undefined } },
    );

    rerender({ value: 0.8 });
    expect(result.current.justChanged).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.justChanged).toBe(false);
  });
});
