import { renderHook } from '@testing-library/react';
import type { HandoffDayScope, HandoffTimeFilter } from '../handoffTypes';
import { useHandoffTimelineViewModel } from '../useHandoffTimelineViewModel';

describe('useHandoffTimelineViewModel', () => {
  it('initializes state from navigation values', () => {
    const navState = {
      dayScope: 'yesterday' as HandoffDayScope,
      timeFilter: 'morning' as HandoffTimeFilter,
    };

    const { result } = renderHook(() => useHandoffTimelineViewModel({ navState }));

    expect(result.current.dayScope).toBe('yesterday');
    expect(result.current.timeFilter).toBe('morning');
  });
});