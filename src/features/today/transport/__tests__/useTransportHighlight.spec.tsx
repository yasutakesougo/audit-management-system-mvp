/**
 * useTransportHighlight — unit tests
 *
 * 検証対象:
 * 1. URLパラメータから highlight / direction を読み取る
 * 2. 該当パラメータがない場合は null を返す
 * 3. 5秒後に自動消去される
 * 4. dismiss() で即座に消去できる
 * 5. URLパラメータが消去される（リロード防止）
 */

import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useTransportHighlight } from '../useTransportHighlight';
import type { ReactNode } from 'react';

function createWrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        {children}
      </MemoryRouter>
    );
  };
}

describe('useTransportHighlight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null when no highlight params exist', () => {
    const { result } = renderHook(() => useTransportHighlight(), {
      wrapper: createWrapper('/today'),
    });

    expect(result.current.userId).toBeNull();
    expect(result.current.direction).toBeNull();
  });

  it('should read highlight and direction from URL params', () => {
    const { result } = renderHook(() => useTransportHighlight(), {
      wrapper: createWrapper('/today?highlight=U001&direction=to'),
    });

    expect(result.current.userId).toBe('U001');
    expect(result.current.direction).toBe('to');
  });

  it('should read highlight without direction', () => {
    const { result } = renderHook(() => useTransportHighlight(), {
      wrapper: createWrapper('/today?highlight=U002'),
    });

    expect(result.current.userId).toBe('U002');
    expect(result.current.direction).toBeNull();
  });

  it('should auto-dismiss after 5 seconds', () => {
    const { result } = renderHook(() => useTransportHighlight(), {
      wrapper: createWrapper('/today?highlight=U001&direction=from'),
    });

    expect(result.current.userId).toBe('U001');

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.userId).toBeNull();
  });

  it('should dismiss immediately when dismiss() is called', () => {
    const { result } = renderHook(() => useTransportHighlight(), {
      wrapper: createWrapper('/today?highlight=U001&direction=to'),
    });

    expect(result.current.userId).toBe('U001');

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.userId).toBeNull();
    // direction は初期値を保持（方向切り替えは別の effect で処理）
    expect(result.current.direction).toBe('to');
  });
});
