import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { HandoffStats } from './TodayHandoffTimelineList';
import type { HandoffDayScope, HandoffTimeFilter } from './handoffTypes';

type HandoffTimelineNavState =
  | {
      dayScope?: HandoffDayScope;
      timeFilter?: HandoffTimeFilter;
    }
  | undefined;

type UseHandoffTimelineViewModelArgs = {
  navState?: HandoffTimelineNavState;
};

export type HandoffTimelineViewModel = {
  dayScope: HandoffDayScope;
  timeFilter: HandoffTimeFilter;
  isQuickNoteOpen: boolean;
  handoffStats: HandoffStats | null;
  setHandoffStats: (stats: HandoffStats | null) => void;
  quickNoteRef: MutableRefObject<HTMLDivElement | null>;
  handleDayScopeChange: (_event: React.MouseEvent<HTMLElement>, newDayScope: HandoffDayScope) => void;
  handleTimeFilterChange: (_event: React.MouseEvent<HTMLElement>, newFilter: HandoffTimeFilter) => void;
  openQuickNote: () => void;
  closeQuickNote: () => void;
};

export function useHandoffTimelineViewModel({
  navState,
}: UseHandoffTimelineViewModelArgs): HandoffTimelineViewModel {
  const [dayScope, setDayScope] = useState<HandoffDayScope>(
    navState?.dayScope ?? 'today'
  );
  const [timeFilter, setTimeFilter] = useState<HandoffTimeFilter>(
    navState?.timeFilter ?? 'all'
  );
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);
  const [handoffStats, setHandoffStats] = useState<HandoffStats | null>(null);
  const quickNoteRef = useRef<HTMLDivElement | null>(null);

  const navDayScope = navState?.dayScope;
  const navTimeFilter = navState?.timeFilter;

  useEffect(() => {
    if (navDayScope) {
      setDayScope(navDayScope);
    }
    if (navTimeFilter) {
      setTimeFilter(navTimeFilter);
    }
  }, [navDayScope, navTimeFilter]);

  useEffect(() => {
    setHandoffStats(null);
  }, [dayScope, timeFilter]);

  useEffect(() => {
    const handler = () => {
      setIsQuickNoteOpen(true);
      window.setTimeout(() => {
        if (quickNoteRef.current) {
          quickNoteRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    };

    window.addEventListener('handoff-open-quicknote', handler);
    return () => window.removeEventListener('handoff-open-quicknote', handler);
  }, []);

  const handleDayScopeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newDayScope: HandoffDayScope) => {
      if (newDayScope !== null) {
        setDayScope(newDayScope);
      }
    },
    []
  );

  const handleTimeFilterChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newFilter: HandoffTimeFilter) => {
      if (newFilter !== null) {
        setTimeFilter(newFilter);
      }
    },
    []
  );

  const openQuickNote = useCallback(() => {
    setIsQuickNoteOpen(true);
  }, []);

  const closeQuickNote = useCallback(() => {
    setIsQuickNoteOpen(false);
  }, []);

  return {
    dayScope,
    timeFilter,
    isQuickNoteOpen,
    handoffStats,
    setHandoffStats,
    quickNoteRef,
    handleDayScopeChange,
    handleTimeFilterChange,
    openQuickNote,
    closeQuickNote,
  };
}