import { useState, useCallback, useMemo } from 'react';
import type { 
  TabValue, 
  SlotFormState, 
  TimelineEntry, 
  buildInitialFormState as _buildInitialFormState
} from '@/features/ibd/procedures/daily-records/types';
import type { SupportPlanSheet, SPSHistoryEntry } from '@/features/ibd/core/ibdTypes';

export type IndividualSupportUiState = {
  tab: TabValue;
  formState: Record<string, SlotFormState>;
  timeline: TimelineEntry[];
  recordedSlotIds: Set<string>;
  showOnlyUnrecorded: boolean;
  snackbar: {
    active: boolean;
    message: string;
    severity: 'success' | 'error';
  };
  monitoringDialogOpen: boolean;
  activeSPS: SupportPlanSheet | null;
  activeSPSHistory: SPSHistoryEntry[];
};

export type IndividualSupportUiActions = {
  setTab: (tab: TabValue) => void;
  setFormState: React.Dispatch<React.SetStateAction<Record<string, SlotFormState>>>;
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEntry[]>>;
  setRecordedSlotIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setShowOnlyUnrecorded: (show: boolean) => void;
  showSnackbar: (message: string, severity?: 'success' | 'error') => void;
  hideSnackbar: () => void;
  setMonitoringDialogOpen: (open: boolean) => void;
  setActiveSPS: (sps: SupportPlanSheet | null) => void;
  setActiveSPSHistory: (history: SPSHistoryEntry[]) => void;
  
  //複合アクション
  resetRecordingState: (initialFormState: Record<string, SlotFormState>) => void;
};

export function useIndividualSupportUiState() {
  const [tab, setTab] = useState<TabValue>('plan');
  const [formState, setFormState] = useState<Record<string, SlotFormState>>({});
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [recordedSlotIds, setRecordedSlotIds] = useState<Set<string>>(new Set());
  const [showOnlyUnrecorded, setShowOnlyUnrecorded] = useState(false);
  const [snackbar, setSnackbar] = useState<IndividualSupportUiState['snackbar']>({
    active: false,
    message: '',
    severity: 'success',
  });
  const [monitoringDialogOpen, setMonitoringDialogOpen] = useState(false);
  const [activeSPS, setActiveSPS] = useState<SupportPlanSheet | null>(null);
  const [activeSPSHistory, setActiveSPSHistory] = useState<SPSHistoryEntry[]>([]);

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ active: true, message, severity });
  }, []);

  const hideSnackbar = useCallback(() => {
    setSnackbar(prev => ({ ...prev, active: false }));
  }, []);

  const resetRecordingState = useCallback((initialFormState: Record<string, SlotFormState>) => {
    setFormState(initialFormState);
    setTimeline([]);
    setShowOnlyUnrecorded(false);
    setRecordedSlotIds(new Set());
  }, []);

  const state: IndividualSupportUiState = useMemo(() => ({
    tab,
    formState,
    timeline,
    recordedSlotIds,
    showOnlyUnrecorded,
    snackbar,
    monitoringDialogOpen,
    activeSPS,
    activeSPSHistory,
  }), [
    tab, formState, timeline, recordedSlotIds, showOnlyUnrecorded, 
    snackbar, monitoringDialogOpen, activeSPS, activeSPSHistory
  ]);

  const actions: IndividualSupportUiActions = {
    setTab,
    setFormState,
    setTimeline,
    setRecordedSlotIds,
    setShowOnlyUnrecorded,
    showSnackbar,
    hideSnackbar,
    setMonitoringDialogOpen,
    setActiveSPS,
    setActiveSPSHistory,
    resetRecordingState,
  };

  return { state, actions };
}
