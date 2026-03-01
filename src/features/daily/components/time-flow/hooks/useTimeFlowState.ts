// ---------------------------------------------------------------------------
// B層: TimeFlow の全 State / Derived / Effects / Handlers を集約
// ---------------------------------------------------------------------------
import { useProcedureStore } from '@/features/daily/stores/procedureStore';
import { getDashboardPath } from '@/features/dashboard/dashboardRouting';
import { resolveSupportFlowForUser } from '@/features/planDeployment/supportFlow';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    mockSupportUsers,
    SUPPORT_ACTIVITY_STORAGE_KEY,
} from '../timeFlowConstants';
import type {
    DailySupportRecord,
    SupportRecord,
    SupportUser,
} from '../timeFlowTypes';
import type {
    FlowSupportActivityTemplate,
    SupportPlanDeployment,
} from '../timeFlowUtils';
import {
    countRecordedSlots,
    DEFAULT_FLOW_MASTER_ACTIVITIES,
    fallbackSupportActivities,
    generateMockTimeFlowDailyRecord,
    loadMasterSupportActivities,
} from '../timeFlowUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ReturnMode = 'morning' | 'evening' | 'detail' | null;

export interface UseTimeFlowStateResult {
  // URL params
  returnMode: ReturnMode;

  // state
  selectedUser: string;
  selectedDate: string;
  searchTerm: string;
  selectedPlanType: string;
  activeTab: 'input' | 'review';
  selectionClearedNotice: boolean;
  recordSectionRef: React.RefObject<HTMLDivElement | null>;

  // derived
  supportDeployment: SupportPlanDeployment | null;
  supportActivities: FlowSupportActivityTemplate[];
  searchMatchedUsers: SupportUser[];
  planTypeOptions: { value: string; count: number }[];
  filteredUsers: SupportUser[];
  currentDailyRecord: DailySupportRecord | null;
  pendingCount: number;
  isComplete: boolean;

  // setters (UI 配線用)
  setSearchTerm: (v: string) => void;
  setSelectedDate: (v: string) => void;
  setSelectedPlanType: (v: string) => void;
  setSelectionClearedNotice: (v: boolean) => void;

  // handlers
  handleUserSelect: (userId: string) => void;
  handleAddRecord: (record: SupportRecord) => void;
  handleUpdateRecord: (updatedRecord: SupportRecord) => void;
  handleMarkComplete: () => void;
  generateAutoSchedule: () => void;
  getActiveUsersCount: () => number;
  handleTabChange: (_event: React.SyntheticEvent, value: 'input' | 'review') => void;
  handleBack: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useTimeFlowState(): UseTimeFlowStateResult {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ========== URL params ==================================================
  const initialUserId = searchParams.get('userId');
  const returnMode = useMemo<ReturnMode>(() => {
    const raw = searchParams.get('returnMode');
    if (raw === 'morning' || raw === 'evening' || raw === 'detail') return raw;
    return null;
  }, [searchParams]);
  const returnUserId = searchParams.get('returnUserId');

  // ========== State =======================================================
  const procedureStore = useProcedureStore();
  const [masterSupportActivities, setMasterSupportActivities] = useState<FlowSupportActivityTemplate[]>(
    DEFAULT_FLOW_MASTER_ACTIVITIES,
  );
  const [selectedUser, setSelectedUser] = useState<string>(initialUserId || '');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlanType, setSelectedPlanType] = useState<string>('');
  const [dailyRecords, setDailyRecords] = useState<Record<string, DailySupportRecord>>({});
  const [activeTab, setActiveTab] = useState<'input' | 'review'>('input');
  const [selectionClearedNotice, setSelectionClearedNotice] = useState<boolean>(false);
  const recordSectionRef = useRef<HTMLDivElement | null>(null);

  // ========== Derived (useMemo) ===========================================

  // CSVインポート/localStorage の動的データを優先して計画を解決
  const storedProcedures = useMemo(() => {
    if (!selectedUser) return null;
    return procedureStore.hasUserData(selectedUser)
      ? procedureStore.getByUser(selectedUser)
      : null;
  }, [procedureStore, selectedUser]);

  const supportDeployment = useMemo<SupportPlanDeployment | null>(() => {
    if (!selectedUser) return null;
    return resolveSupportFlowForUser(selectedUser, storedProcedures);
  }, [selectedUser, storedProcedures]);

  const supportActivities = useMemo<FlowSupportActivityTemplate[]>(() => {
    if (supportDeployment?.activities && supportDeployment.activities.length > 0) {
      return supportDeployment.activities;
    }
    if (masterSupportActivities.length > 0) {
      return masterSupportActivities;
    }
    return fallbackSupportActivities;
  }, [supportDeployment, masterSupportActivities]);

  const searchMatchedUsers = useMemo<SupportUser[]>(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return mockSupportUsers.filter(
      (user) => user.isActive && user.name.toLowerCase().includes(normalizedTerm),
    );
  }, [searchTerm]);

  const planTypeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    searchMatchedUsers.forEach((user) => {
      counts.set(user.planType, (counts.get(user.planType) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value, 'ja'));
  }, [searchMatchedUsers]);

  const filteredUsers = useMemo<SupportUser[]>(() => {
    return searchMatchedUsers.filter((user) =>
      selectedPlanType ? user.planType === selectedPlanType : true,
    );
  }, [searchMatchedUsers, selectedPlanType]);

  const recordKey = useMemo(() => {
    if (!selectedUser) return null;
    return `${selectedUser}-${selectedDate}`;
  }, [selectedDate, selectedUser]);

  const currentDailyRecord = useMemo(() => {
    if (!selectedUser || !recordKey) return null;

    const user = mockSupportUsers.find((u) => u.id === selectedUser);
    if (!user) return null;

    if (!dailyRecords[recordKey]) {
      const newRecord = generateMockTimeFlowDailyRecord(
        user,
        selectedDate,
        supportActivities,
        supportDeployment,
      );
      const normalizedRecord: DailySupportRecord = {
        ...newRecord,
        summary: {
          ...newRecord.summary,
          totalTimeSlots: supportActivities.length,
          recordedTimeSlots: countRecordedSlots(newRecord.records),
        },
      };
      setDailyRecords((prev) => ({ ...prev, [recordKey]: normalizedRecord }));
      return normalizedRecord;
    }

    const existingRecord = dailyRecords[recordKey];
    const recordedCount = countRecordedSlots(existingRecord.records);
    const needsSummaryUpdate =
      existingRecord.summary.totalTimeSlots !== supportActivities.length ||
      existingRecord.summary.recordedTimeSlots !== recordedCount;
    const needsPlanUpdate =
      supportDeployment && existingRecord.supportPlanId !== supportDeployment.planId;

    if (needsSummaryUpdate || needsPlanUpdate) {
      const updatedPlanId = supportDeployment?.planId ?? existingRecord.supportPlanId;
      const adjustedRecord: DailySupportRecord = {
        ...existingRecord,
        supportPlanId: updatedPlanId,
        records:
          supportDeployment && existingRecord.supportPlanId !== updatedPlanId
            ? existingRecord.records.map((record) => ({
                ...record,
                supportPlanId: updatedPlanId,
              }))
            : existingRecord.records,
        summary: {
          ...existingRecord.summary,
          totalTimeSlots: supportActivities.length,
          recordedTimeSlots: recordedCount,
        },
      };
      setDailyRecords((prev) => ({ ...prev, [recordKey]: adjustedRecord }));
      return adjustedRecord;
    }

    return existingRecord;
  }, [dailyRecords, recordKey, selectedDate, selectedUser, supportActivities, supportDeployment]);

  const pendingCount = useMemo(() => {
    if (!selectedUser || !currentDailyRecord) {
      return supportActivities.length;
    }
    return supportActivities.filter((activity) => {
      const record = currentDailyRecord.records.find(
        (entry) => entry.activityKey === activity.time,
      );
      return !(record && record.status === '記録済み');
    }).length;
  }, [currentDailyRecord, selectedUser, supportActivities]);

  const isComplete = currentDailyRecord?.status === '完了';

  // ========== Effects =====================================================

  // 初回ロード: localStorage からマスター活動を読み込む
  useEffect(() => {
    setMasterSupportActivities(loadMasterSupportActivities());
  }, []);

  // 他タブでの localStorage 変更をリッスン
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key === SUPPORT_ACTIVITY_STORAGE_KEY) {
        setMasterSupportActivities(loadMasterSupportActivities());
      }
    };

    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, []);

  // フィルタ変更時に選択クリア
  useEffect(() => {
    if (selectedUser && !filteredUsers.some((user) => user.id === selectedUser)) {
      setSelectedUser('');
      setSelectionClearedNotice(true);
    }
  }, [filteredUsers, selectedUser]);

  // スクロール制御
  useEffect(() => {
    if (selectedUser && recordSectionRef.current) {
      recordSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedUser, currentDailyRecord]);

  // ========== Handlers (useCallback) ======================================

  const handleUserSelect = useCallback((userId: string) => {
    setSelectedUser(userId);
    setActiveTab('input');
    setSelectionClearedNotice(false);
  }, []);

  const handleAddRecord = useCallback(
    (record: SupportRecord) => {
      if (!currentDailyRecord || !recordKey) return;

      const updatedRecords = [...currentDailyRecord.records, record];
      const recordedCount = countRecordedSlots(updatedRecords);

      const updatedDailyRecord: DailySupportRecord = {
        ...currentDailyRecord,
        records: updatedRecords,
        status: '作成中',
        summary: {
          ...currentDailyRecord.summary,
          totalTimeSlots: supportActivities.length,
          recordedTimeSlots: recordedCount,
        },
      };

      setDailyRecords((prev) => ({ ...prev, [recordKey]: updatedDailyRecord }));
    },
    [currentDailyRecord, recordKey, supportActivities.length],
  );

  const handleUpdateRecord = useCallback(
    (updatedRecord: SupportRecord) => {
      if (!currentDailyRecord || !recordKey) return;

      const updatedRecords = currentDailyRecord.records.map((record: SupportRecord) =>
        record.id === updatedRecord.id ? updatedRecord : record,
      );
      const recordedCount = countRecordedSlots(updatedRecords);

      const updatedDailyRecord: DailySupportRecord = {
        ...currentDailyRecord,
        records: updatedRecords,
        summary: {
          ...currentDailyRecord.summary,
          totalTimeSlots: supportActivities.length,
          recordedTimeSlots: recordedCount,
        },
      };

      setDailyRecords((prev) => ({ ...prev, [recordKey]: updatedDailyRecord }));
    },
    [currentDailyRecord, recordKey, supportActivities.length],
  );

  const handleMarkComplete = useCallback(() => {
    if (!recordKey) return;

    setDailyRecords((prev) => {
      const target = prev[recordKey];
      if (!target) return prev;

      const recordedCount = countRecordedSlots(target.records);

      const updatedRecord: DailySupportRecord = {
        ...target,
        status: '完了',
        completedAt: new Date().toISOString(),
        summary: {
          ...target.summary,
          totalTimeSlots: supportActivities.length,
          recordedTimeSlots: recordedCount,
        },
      };

      return { ...prev, [recordKey]: updatedRecord };
    });
  }, [recordKey, supportActivities.length]);

  const generateAutoSchedule = useCallback(() => {
    if (!selectedUser || !recordKey) return;

    const user = mockSupportUsers.find((u) => u.id === selectedUser);
    if (!user) return;

    const autoRecord = generateMockTimeFlowDailyRecord(
      user,
      selectedDate,
      supportActivities,
      supportDeployment,
    );
    const normalizedRecord: DailySupportRecord = {
      ...autoRecord,
      summary: {
        ...autoRecord.summary,
        totalTimeSlots: supportActivities.length,
        recordedTimeSlots: countRecordedSlots(autoRecord.records),
      },
    };

    setDailyRecords((prev) => ({ ...prev, [recordKey]: normalizedRecord }));
  }, [recordKey, selectedDate, selectedUser, supportActivities, supportDeployment]);

  const getActiveUsersCount = useCallback(
    () => mockSupportUsers.filter((u) => u.isActive).length,
    [],
  );

  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, value: 'input' | 'review') => {
      setActiveTab(value);
    },
    [],
  );

  const handleBack = useCallback(() => {
    if (returnMode === 'morning' || returnMode === 'evening') {
      const dashboardPath = getDashboardPath();
      navigate(`${dashboardPath}?mode=${returnMode}`);
      return;
    }
    if (returnMode === 'detail' && returnUserId) {
      navigate(`/users/${returnUserId}`);
      return;
    }
    navigate('/daily');
  }, [navigate, returnMode, returnUserId]);

  // ========== Return ======================================================
  return {
    returnMode,

    selectedUser,
    selectedDate,
    searchTerm,
    selectedPlanType,
    activeTab,
    selectionClearedNotice,
    recordSectionRef,

    supportDeployment,
    supportActivities,
    searchMatchedUsers,
    planTypeOptions,
    filteredUsers,
    currentDailyRecord,
    pendingCount,
    isComplete,

    setSearchTerm,
    setSelectedDate,
    setSelectedPlanType,
    setSelectionClearedNotice,

    handleUserSelect,
    handleAddRecord,
    handleUpdateRecord,
    handleMarkComplete,
    generateAutoSchedule,
    getActiveUsersCount,
    handleTabChange,
    handleBack,
  };
}
