import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';

/**
 * DailyRecordPage (/daily/activity) ViewModel
 */

type BaseRecord = {
  id: number;
  personName: string;
  personId: string;
  status: string;
  date: string;
  draft: { isDraft: boolean };
};

type ValidationResult = {
  isValid: boolean;
  errors: string[];
};

export type DailyRecordViewModel<TRecord extends BaseRecord> = {
  // highlight (nav state / query)
  highlightUserId: string | null;
  highlightDate: string | null;

  // filters
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;

  // derived
  filteredRecords: TRecord[];

  // handlers
  handleOpenForm: () => void;
  handleEditRecord: (record: TRecord) => void;
  handleCloseForm: () => void;
  handleOpenAttendance: (record: { personId: string; date: string }) => void;
  handleSaveRecord: (record: Omit<TRecord, 'id'>) => void;
  handleDeleteRecord: (recordId: number) => void;
  handleGenerateTodayRecords: () => void;
  handleBulkCreateMissing: () => void;
  handleBulkComplete: () => void;
};

export type UseDailyRecordViewModelParams<TRecord extends BaseRecord> = {
  // highlight sources
  locationState: unknown;
  searchParams: URLSearchParams;

  // data/state owned by page (for minimal diff)
  records: TRecord[];
  setRecords: Dispatch<SetStateAction<TRecord[]>>;
  editingRecord: TRecord | undefined;
  setEditingRecord: Dispatch<SetStateAction<TRecord | undefined>>;
  setFormOpen: Dispatch<SetStateAction<boolean>>;

  // navigation
  navigate: (to: string) => void;

  // domain operations
  validateDailyRecord: (record: Omit<TRecord, 'id'>) => ValidationResult;
  saveDailyRecord: (
    records: TRecord[],
    record: Omit<TRecord, 'id'>,
    editingId?: number,
  ) => TRecord[];
  generateTodayRecords: () => TRecord[];
  mockUsers: string[];
  createMissingRecord: (name: string, userId: string, date: string, index: number) => TRecord;
};

export function useDailyRecordViewModel<TRecord extends BaseRecord>(
  params: UseDailyRecordViewModelParams<TRecord>,
): DailyRecordViewModel<TRecord> {
  const {
    locationState,
    searchParams,
    records,
    setRecords,
    editingRecord,
    setEditingRecord,
    setFormOpen,
    navigate,
    validateDailyRecord,
    saveDailyRecord,
    generateTodayRecords,
    mockUsers,
    createMissingRecord,
  } = params;

  // --- Highlight resolution (nav state > query) ---
  const navState = (locationState ?? {}) as {
    highlightUserId?: string | null;
    highlightDate?: string | null;
  };
  const highlightUserIdFromState = navState.highlightUserId ?? null;
  const highlightDateFromState = navState.highlightDate ?? null;
  const highlightUserIdFromQuery = searchParams.get('userId');
  const highlightDateFromQuery = searchParams.get('date');
  const highlightUserId = highlightUserIdFromState ?? highlightUserIdFromQuery;
  const highlightDate = highlightDateFromState ?? highlightDateFromQuery;

  // --- Filters ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch =
        !searchQuery ||
        record.personName.includes(searchQuery) ||
        record.personId.includes(searchQuery);

      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      const matchesDate = !dateFilter || record.date === dateFilter;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [records, searchQuery, statusFilter, dateFilter]);

  // --- Handlers ---
  const handleOpenForm = useCallback(() => {
    setEditingRecord(undefined);
    setFormOpen(true);
  }, [setEditingRecord, setFormOpen]);

  const handleEditRecord = useCallback(
    (record: TRecord) => {
      setEditingRecord(record);
      setFormOpen(true);
    },
    [setEditingRecord, setFormOpen],
  );

  const handleCloseForm = useCallback(() => {
    setFormOpen(false);
    setEditingRecord(undefined);
  }, [setFormOpen, setEditingRecord]);

  const handleOpenAttendance = useCallback(
    (record: { personId: string; date: string }) => {
      navigate(`/daily/attendance?userId=${record.personId}&date=${record.date}`);
    },
    [navigate],
  );

  const handleSaveRecord = useCallback(
    (record: Omit<TRecord, 'id'>) => {
      try {
        // バリデーション実行
        const validationResult = validateDailyRecord(record);

        if (!validationResult.isValid) {
          // バリデーションエラーがある場合
          const errorMessage = validationResult.errors.join('\n');
          toast.error(`保存に失敗しました\n\n${errorMessage}`, {
            duration: 6000,
            style: {
              maxWidth: '500px',
            },
          });
          console.error('保存失敗 - バリデーションエラー:', validationResult.errors);
          return;
        }

        // 保存処理実行
        const updatedRecords = saveDailyRecord(records, record, editingRecord?.id);

        setRecords(updatedRecords);

        // フォームを閉じる
        handleCloseForm();

        // 成功通知
        const operation = editingRecord ? '更新' : '新規作成';
        toast.success(
          `日次記録の${operation}が完了しました\n\n利用者: ${record.personName}\n日付: ${record.date}`,
          {
            duration: 4000,
            style: {
              maxWidth: '400px',
            },
          },
        );

        // 成功ログ
        if (import.meta.env.DEV) {
          console.log('保存成功:', {
            operation,
            personName: record.personName,
            date: record.date,
            status: record.status,
          });
        }
      } catch (error) {
        // 予期しないエラーをキャッチ
        const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
        toast.error(`システムエラーが発生しました\n\n${errorMessage}`, {
          duration: 8000,
          style: {
            maxWidth: '500px',
          },
        });
        console.error('保存失敗 - システムエラー:', error);
      }
    },
    [
      validateDailyRecord,
      saveDailyRecord,
      records,
      editingRecord,
      setRecords,
      handleCloseForm,
    ],
  );

  const handleDeleteRecord = useCallback(
    (recordId: number) => {
      const recordToDelete = records.find((record) => record.id === recordId);

      setRecords(records.filter((record) => record.id !== recordId));

      if (recordToDelete) {
        toast.success(`${recordToDelete.personName}さんの記録を削除しました`, {
          duration: 3000,
        });
      } else {
        toast.error('削除対象の記録が見つかりませんでした', {
          duration: 3000,
        });
      }
    },
    [records, setRecords],
  );

  const handleGenerateTodayRecords = useCallback(() => {
    const todayRecords = generateTodayRecords();
    setRecords(todayRecords);
    toast.success('本日分の記録を32名分作成しました', {
      duration: 3000,
    });
  }, [generateTodayRecords, setRecords]);

  const handleBulkCreateMissing = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const existingPersonIds = records
      .filter((record) => record.date === today)
      .map((record) => record.personId);

    const missingUsers = mockUsers.filter((_name, index) => {
      const userId = String(index + 1).padStart(3, '0');
      return !existingPersonIds.includes(userId);
    });

    if (missingUsers.length === 0) {
      toast('本日分の記録は全員作成済みです', {
        icon: 'ℹ️',
        duration: 2000,
      });
      return;
    }

    const newRecords = missingUsers.map((name, index) => {
      const globalIndex = mockUsers.indexOf(name);
      const userId = String(globalIndex + 1).padStart(3, '0');

      return createMissingRecord(name, userId, today, index);
    });

    setRecords([...records, ...newRecords]);
    toast.success(`${missingUsers.length}名分の未作成記録を追加しました`, {
      duration: 3000,
    });
  }, [records, setRecords, mockUsers, createMissingRecord]);

  const handleBulkComplete = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    let completedCount = 0;

    const updatedRecords = records.map((record) => {
      if (record.date === today && record.status === '未作成') {
        completedCount += 1;
        return {
          ...record,
          status: '完了',
          draft: { isDraft: false },
        };
      }
      return record;
    });

    setRecords(updatedRecords);

    if (completedCount === 0) {
      toast('本日分の記録で一括完了対象はありませんでした', {
        icon: 'ℹ️',
        duration: 2000,
      });
    } else {
      toast.success(`${completedCount}件の記録を一括完了しました`, {
        duration: 3000,
      });
    }
  }, [records, setRecords]);

  return useMemo(
    () => ({
      highlightUserId,
      highlightDate,
      searchQuery,
      setSearchQuery,
      statusFilter,
      setStatusFilter,
      dateFilter,
      setDateFilter,
      filteredRecords,
      handleOpenForm,
      handleEditRecord,
      handleCloseForm,
      handleOpenAttendance,
      handleSaveRecord,
      handleDeleteRecord,
      handleGenerateTodayRecords,
      handleBulkCreateMissing,
      handleBulkComplete,
    }),
    [
      highlightUserId,
      highlightDate,
      searchQuery,
      statusFilter,
      dateFilter,
      filteredRecords,
      handleOpenForm,
      handleEditRecord,
      handleCloseForm,
      handleOpenAttendance,
      handleSaveRecord,
      handleDeleteRecord,
      handleGenerateTodayRecords,
      handleBulkCreateMissing,
      handleBulkComplete,
    ],
  );
}
