import { useUsers } from '@/stores/useUsers';
import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User } from '@/types';
import { emitDailySubmissionEvents } from '@/features/iceberg-pdca/dailyMetricsAdapter';
import { useTableDailyRecordRouting } from './useTableDailyRecordRouting';
import { useTableDailyRecordFiltering } from './useTableDailyRecordFiltering';
import { useTableDailyRecordPersistence } from './useTableDailyRecordPersistence';
import { useTableDailyRecordSelection } from './useTableDailyRecordSelection';
import type { DraftInput } from './useTableDailyRecordPersistence';

export type UserRowData = {
  userId: string;
  userName: string;
  amActivity: string;
  pmActivity: string;
  lunchAmount: string;
  problemBehavior: {
    selfHarm: boolean;
    violence: boolean;
    loudVoice: boolean;
    pica: boolean;
    other: boolean;
  };
  specialNotes: string;
};

export type TableDailyRecordData = {
  date: string;
  reporter: {
    name: string;
    role: string;
  };
  userRows: UserRowData[];
};

export type UseTableDailyRecordFormParams = {
  open: boolean;
  onClose: () => void;
  onSave: (data: TableDailyRecordData) => Promise<void>;
};

export type UseTableDailyRecordFormResult = {
  formData: TableDailyRecordData;
  setFormData: Dispatch<SetStateAction<TableDailyRecordData>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  showTodayOnly: boolean;
  setShowTodayOnly: Dispatch<SetStateAction<boolean>>;
  filteredUsers: User[];
  selectedUsers: User[];
  selectedUserIds: string[];
  handleUserToggle: (userId: string) => void;
  handleSelectAll: () => void;
  handleClearAll: () => void;
  handleRowDataChange: (userId: string, field: string, value: string | boolean) => void;
  handleProblemBehaviorChange: (userId: string, behaviorType: string, checked: boolean) => void;
  handleClearRow: (userId: string) => void;
  showUnsentOnly: boolean;
  setShowUnsentOnly: Dispatch<SetStateAction<boolean>>;
  visibleRows: UserRowData[];
  unsentRowCount: number;
  hasDraft: boolean;
  draftSavedAt: string | null;
  handleSaveDraft: () => void;
  handleSave: () => Promise<void>;
  saving: boolean;
};

const createInitialFormData = (initialDate?: string | null): TableDailyRecordData => ({
  date: initialDate ?? new Date().toISOString().split('T')[0],
  reporter: {
    name: '',
    role: '生活支援員',
  },
  userRows: [],
});

const hasRowContent = (row: UserRowData): boolean => {
  if (row.amActivity.trim() || row.pmActivity.trim() || row.lunchAmount.trim() || row.specialNotes.trim()) {
    return true;
  }

  return Object.values(row.problemBehavior).some(Boolean);
};

export const useTableDailyRecordForm = ({
  open,
  onClose,
  onSave,
}: UseTableDailyRecordFormParams): UseTableDailyRecordFormResult => {
  // Extract routing logic to separate hook
  const { initialDateFromUrl, showUnsentOnly, setShowUnsentOnly } = useTableDailyRecordRouting(open);

  const [formData, setFormData] = useState<TableDailyRecordData>(() => createInitialFormData(initialDateFromUrl));
  const [saving, setSaving] = useState(false);

  const { data: users = [] } = useUsers();

  // Draft persistence logic extracted to separate hook
  const { draftSavedAt, loadedDraft, saveDraft, clearDraft } = useTableDailyRecordPersistence({ open });

  // Extract filtering logic to separate hook
  const targetDate = useMemo(() => new Date(formData.date), [formData.date]);
  const {
    filteredUsers,
    attendanceFilteredUsers,
    filters: { showTodayOnly, setShowTodayOnly, searchQuery, setSearchQuery },
  } = useTableDailyRecordFiltering({ users, targetDate });

  // Extract selection logic to separate hook
  const {
    selectedUserIds,
    selectedUsers,
    selectionManuallyEdited: _selectionManuallyEdited,
    handleUserToggle,
    handleSelectAll,
    handleClearAll,
    setSelectedUserIds,
    setSelectionManuallyEdited,
  } = useTableDailyRecordSelection({
    open,
    showTodayOnly,
    filteredUsers,
    attendanceFilteredUsers,
    targetDate,
    users,
    loadedDraftSelectedUserIds: loadedDraft?.selectedUserIds,
  });

  const unsentRowCount = useMemo(() => {
    const contentBasedCount = formData.userRows.filter(hasRowContent).length;
    if (contentBasedCount > 0) {
      return contentBasedCount;
    }
    return selectedUserIds.length;
  }, [formData.userRows, selectedUserIds]);

  const visibleRows = useMemo(() => {
    if (!showUnsentOnly) {
      return formData.userRows;
    }

    return formData.userRows.filter(hasRowContent);
  }, [formData.userRows, showUnsentOnly]);

  useEffect(() => {
    setFormData((prev) => {
      const existingMap = new Map(prev.userRows.map((row) => [row.userId, row]));
      const rowsFromResolvedUsers: UserRowData[] = selectedUsers.map((user) => {
        const userId = user.userId || '';
        const existing = existingMap.get(userId);
        if (existing) {
          return existing;
        }
        return {
          userId,
          userName: user.name || '',
          amActivity: '',
          pmActivity: '',
          lunchAmount: '',
          problemBehavior: {
            selfHarm: false,
            violence: false,
            loudVoice: false,
            pica: false,
            other: false,
          },
          specialNotes: '',
        };
      });

      const resolvedUserIds = new Set(rowsFromResolvedUsers.map((row) => row.userId));
      const unresolvedButSelectedRows: UserRowData[] = selectedUserIds
        .filter((userId) => !resolvedUserIds.has(userId))
        .map((userId) => {
          const existing = existingMap.get(userId);
          if (existing) {
            return existing;
          }

          return {
            userId,
            userName: userId,
            amActivity: '',
            pmActivity: '',
            lunchAmount: '',
            problemBehavior: {
              selfHarm: false,
              violence: false,
              loudVoice: false,
              pica: false,
              other: false,
            },
            specialNotes: '',
          };
        });

      const nextRows: UserRowData[] = [...rowsFromResolvedUsers, ...unresolvedButSelectedRows];

      return {
        ...prev,
        userRows: nextRows,
      };
    });
  }, [selectedUsers, selectedUserIds]);

  // Auto-disable unsent filter when no unsent rows remain
  useEffect(() => {
    if (showUnsentOnly && unsentRowCount === 0) {
      setShowUnsentOnly(false);
    }
  }, [showUnsentOnly, unsentRowCount, setShowUnsentOnly]);

  // Restore draft when loaded
  useEffect(() => {
    if (!loadedDraft) {
      return;
    }

    setFormData(loadedDraft.formData);
    setSearchQuery(loadedDraft.searchQuery);
    setShowTodayOnly(loadedDraft.showTodayOnly);
  }, [loadedDraft, setSearchQuery, setShowTodayOnly]);

  const handleRowDataChange = (userId: string, field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      userRows: prev.userRows.map((row) =>
        row.userId === userId
          ? { ...row, [field]: value }
          : row
      ),
    }));
  };

  const handleProblemBehaviorChange = (userId: string, behaviorType: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      userRows: prev.userRows.map((row) =>
        row.userId === userId
          ? {
              ...row,
              problemBehavior: {
                ...row.problemBehavior,
                [behaviorType]: checked,
              },
            }
          : row
      ),
    }));
  };

  const handleClearRow = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      userRows: prev.userRows.map((row) =>
        row.userId === userId
          ? {
              ...row,
              amActivity: '',
              pmActivity: '',
              lunchAmount: '',
              problemBehavior: {
                selfHarm: false,
                violence: false,
                loudVoice: false,
                pica: false,
                other: false,
              },
              specialNotes: '',
            }
          : row
      ),
    }));
  };

  const handleSaveDraft = () => {
    const input: DraftInput = {
      formData,
      selectedUserIds,
      searchQuery,
      showTodayOnly,
    };
    saveDraft(input);
  };

  const handleSave = async () => {
    if (selectedUserIds.length === 0) {
      alert('利用者を1人以上選択してください');
      return;
    }

    if (!formData.reporter.name.trim()) {
      alert('記録者名を入力してください');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);

      const submittedAt = new Date().toISOString();
      const submissionEvents = selectedUserIds.map((userId) => ({
        userId,
        recordDate: formData.date,
        submittedAt,
        draftCreatedAt: draftSavedAt ?? undefined,
      }));
      emitDailySubmissionEvents(submissionEvents);

      clearDraft();
      onClose();
      setSelectedUserIds([]);
      setSearchQuery('');
      setShowTodayOnly(true);
      setShowUnsentOnly(false);
      setSelectionManuallyEdited(false);
      setFormData(createInitialFormData());
    } catch (error) {
      console.error('保存に失敗しました:', error);
      alert('保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  return {
    formData,
    setFormData,
    searchQuery,
    setSearchQuery,
    showTodayOnly,
    setShowTodayOnly,
    filteredUsers,
    selectedUsers,
    selectedUserIds,
    handleUserToggle,
    handleSelectAll,
    handleClearAll,
    handleRowDataChange,
    handleProblemBehaviorChange,
    handleClearRow,
    showUnsentOnly,
    setShowUnsentOnly,
    visibleRows,
    unsentRowCount,
    hasDraft: Boolean(draftSavedAt),
    draftSavedAt,
    handleSaveDraft,
    handleSave,
    saving,
  };
};
