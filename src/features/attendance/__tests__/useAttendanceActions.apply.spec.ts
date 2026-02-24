import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { isAttendanceError, useAttendanceActions } from '../hooks/useAttendanceActions';

type VisitMap = {
  a: { count: number };
};

const buildNextVisits = vi.fn(({ prev }: { prev: VisitMap }) => prev);

const setup = (persistImpl?: (next: VisitMap) => Promise<void>) => {
  const persist = vi.fn(persistImpl ?? (() => Promise.resolve()));
  const initial: VisitMap = { a: { count: 0 } };

  const { result } = renderHook(() => {
    const [visits, setVisits] = React.useState<VisitMap>(initial);
    const actions = useAttendanceActions<VisitMap>({
      setVisits,
      persist,
      buildNextVisits,
    });

    return {
      visits,
      ...actions,
    };
  });

  return { result, persist, initial };
};

describe('useAttendanceActions applyAndPersist', () => {
  it('persists optimistic updates on success', async () => {
    const { result, persist } = setup();

    await act(async () => {
      await result.current.applyAndPersist(
        (prev) => ({ ...prev, a: { count: prev.a.count + 1 } }),
        'absence:success',
      );
    });

    expect(result.current.visits.a.count).toBe(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith({ a: { count: 1 } });
  });

  it('rolls back and throws when persist fails', async () => {
    const { result, initial } = setup(() => Promise.reject({ status: 409 }));
    let caught: unknown;

    await act(async () => {
      try {
        await result.current.applyAndPersist(
          (prev) => ({ ...prev, a: { count: prev.a.count + 1 } }),
          'absence:fail',
        );
      } catch (error) {
        caught = error;
      }
    });

    expect(result.current.visits).toEqual(initial);
    expect(isAttendanceError(caught)).toBe(true);
    if (isAttendanceError(caught)) {
      expect(caught.code).toBe('CONFLICT');
    }
  });
});
