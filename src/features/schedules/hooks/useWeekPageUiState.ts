import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';

type SnackState = {
  open: boolean;
  severity: 'success' | 'error' | 'info' | 'warning';
  message: string;
};

type WeekPageUiState = {
  snack: SnackState;
  setSnack: Dispatch<SetStateAction<SnackState>>;
  showSnack: (severity: SnackState['severity'], message: string) => void;
  isInlineSaving: boolean;
  setIsInlineSaving: Dispatch<SetStateAction<boolean>>;
  isInlineDeleting: boolean;
  setIsInlineDeleting: Dispatch<SetStateAction<boolean>>;
  conflictDetailOpen: boolean;
  setConflictDetailOpen: Dispatch<SetStateAction<boolean>>;
  lastErrorAt: number | null;
  setLastErrorAt: Dispatch<SetStateAction<number | null>>;
  conflictBusy: boolean;
  setConflictBusy: Dispatch<SetStateAction<boolean>>;
  focusScheduleId: string | null;
  setFocusScheduleId: Dispatch<SetStateAction<string | null>>;
  highlightId: string | null;
  setHighlightId: Dispatch<SetStateAction<string | null>>;
};

export const useWeekPageUiState = (): WeekPageUiState => {
  const [snack, setSnack] = useState<SnackState>({ open: false, severity: 'info', message: '' });
  const [isInlineSaving, setIsInlineSaving] = useState(false);
  const [isInlineDeleting, setIsInlineDeleting] = useState(false);
  const [conflictDetailOpen, setConflictDetailOpen] = useState(false);
  const [lastErrorAt, setLastErrorAt] = useState<number | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [focusScheduleId, setFocusScheduleId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const showSnack = useCallback(
    (severity: SnackState['severity'], message: string) => {
      setSnack({ open: true, severity, message });
    },
    [],
  );

  return {
    snack,
    setSnack,
    showSnack,
    isInlineSaving,
    setIsInlineSaving,
    isInlineDeleting,
    setIsInlineDeleting,
    conflictDetailOpen,
    setConflictDetailOpen,
    lastErrorAt,
    setLastErrorAt,
    conflictBusy,
    setConflictBusy,
    focusScheduleId,
    setFocusScheduleId,
    highlightId,
    setHighlightId,
  };
};
