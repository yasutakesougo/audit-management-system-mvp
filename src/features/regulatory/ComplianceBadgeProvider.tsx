import React, { createContext, useContext, useMemo } from 'react';
import { useUsers } from '@/features/users/useUsers';
import { useStaff } from '@/stores/useStaff';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { useProcedureRecordRepository } from '@/features/regulatory/hooks/useProcedureRecordRepository';
import { useMonitoringMeetingRepository } from '@/features/monitoring/data/useMonitoringMeetingRepository';
import { useRegulatoryFindingsRealData } from './hooks/useRegulatoryFindingsRealData';
import { useSevereAddonRealData } from './hooks/useSevereAddonRealData';
import { _resetAddonFindingCounter, buildSevereAddonFindings } from '@/domain/regulatory/severeAddonFindings';

interface ComplianceBadgeContextValue {
  totalCount: number;
  isLoading: boolean;
}

const ComplianceBadgeContext = createContext<ComplianceBadgeContextValue | null>(null);

export const ComplianceBadgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: users, status: usersStatus, error: usersError } = useUsers({ selectMode: 'full' });
  const { staff, isLoading: staffLoading, error: staffError } = useStaff();
  
  const planningSheetRepo = usePlanningSheetRepositories();
  const procedureRecordRepo = useProcedureRecordRepository();
  const monitoringMeetingRepo = useMonitoringMeetingRepository();
  
  const dataLoading = usersStatus === 'loading' || staffLoading;
  const dataError = usersError ? (usersError instanceof Error ? usersError : new Error(String(usersError))) : staffError;

  const { findings: regularFindings, isLoading: findingsLoading } = useRegulatoryFindingsRealData(
    users || [],
    staff || [],
    dataLoading,
    dataError,
    planningSheetRepo,
    procedureRecordRepo,
    monitoringMeetingRepo
  );

  const { input: addonInput, isLoading: addonLoading } = useSevereAddonRealData(
    users || [],
    staff || [],
    dataLoading,
    dataError,
    planningSheetRepo,
    null, // observation repo not used for count for now
    null  // qualification repo not used for count for now
  );

  const addonFindingCount = useMemo(() => {
    if (!addonInput) return 0;
    _resetAddonFindingCounter();
    return buildSevereAddonFindings(addonInput).length;
  }, [addonInput]);

  const totalCount = useMemo(() => {
    return regularFindings.length + addonFindingCount;
  }, [regularFindings.length, addonFindingCount]);

  const value = useMemo(() => ({
    totalCount,
    isLoading: findingsLoading || addonLoading || dataLoading,
  }), [totalCount, findingsLoading, addonLoading, dataLoading]);

  return (
    <ComplianceBadgeContext.Provider value={value}>
      {children}
    </ComplianceBadgeContext.Provider>
  );
};

export const useComplianceBadge = () => {
  const context = useContext(ComplianceBadgeContext);
  if (!context) return { totalCount: 0, isLoading: false };
  return context;
};
