import React from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AuditHistoryFilter } from '@/features/planning-sheet/domain/filterAuditHistory';
import type { ProvenanceEntry } from '@/features/planning-sheet/assessmentBridge';
import { type SheetTabKey, VALID_TABS } from '../types';

export interface SupportPlanningSheetUiState {
  activeTab: SheetTabKey;
  isEditing: boolean;
  toast: { open: boolean; message: string; severity: 'success' | 'error' };
  importDialogOpen: boolean;
  monitoringDialogOpen: boolean;
  sessionProvenance: ProvenanceEntry[];
  contextOpen: boolean;
  historyFilter: AuditHistoryFilter;
}

export type SupportPlanningSheetUiActions = {
  setActiveTab: React.Dispatch<React.SetStateAction<SheetTabKey>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setToast: React.Dispatch<React.SetStateAction<SupportPlanningSheetUiState['toast']>>;
  setImportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMonitoringDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSessionProvenance: React.Dispatch<React.SetStateAction<ProvenanceEntry[]>>;
  setContextOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setHistoryFilter: React.Dispatch<React.SetStateAction<AuditHistoryFilter>>;
};

export function useSupportPlanningSheetUiState(): {
  state: SupportPlanningSheetUiState;
  actions: SupportPlanningSheetUiActions;
} {
  const [searchParams] = useSearchParams();
  const tabFromQuery = searchParams.get('tab') as SheetTabKey | null;
  const initialTab = tabFromQuery && VALID_TABS.includes(tabFromQuery) ? tabFromQuery : 'overview';

  const [activeTab, setActiveTab] = React.useState<SheetTabKey>(initialTab);
  const [isEditing, setIsEditing] = React.useState(false);
  const [toast, setToast] = React.useState<SupportPlanningSheetUiState['toast']>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [monitoringDialogOpen, setMonitoringDialogOpen] = React.useState(false);
  const [sessionProvenance, setSessionProvenance] = React.useState<ProvenanceEntry[]>([]);
  const [contextOpen, setContextOpen] = React.useState(false);
  const [historyFilter, setHistoryFilter] = React.useState<AuditHistoryFilter>('all');

  const state = React.useMemo(
    () => ({
      activeTab,
      isEditing,
      toast,
      importDialogOpen,
      monitoringDialogOpen,
      sessionProvenance,
      contextOpen,
      historyFilter,
    }),
    [activeTab, isEditing, toast, importDialogOpen, monitoringDialogOpen, sessionProvenance, contextOpen, historyFilter],
  );

  const actions = React.useMemo(
    () => ({
      setActiveTab,
      setIsEditing,
      setToast,
      setImportDialogOpen,
      setMonitoringDialogOpen,
      setSessionProvenance,
      setContextOpen,
      setHistoryFilter,
    }),
    [],
  );

  return { state, actions };
}
