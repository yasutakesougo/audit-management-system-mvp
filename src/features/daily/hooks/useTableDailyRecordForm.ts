import { useUsers } from '@/stores/useUsers';
import { isUserScheduledForDate } from '@/utils/attendanceUtils';
import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User } from '@/types';

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
  handleSave: () => Promise<void>;
  saving: boolean;
};

export const useTableDailyRecordForm = ({
  open,
  onClose,
  onSave,
}: UseTableDailyRecordFormParams): UseTableDailyRecordFormResult => {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectionManuallyEdited, setSelectionManuallyEdited] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTodayOnly, setShowTodayOnly] = useState(true);
  const [formData, setFormData] = useState<TableDailyRecordData>({
    date: new Date().toISOString().split('T')[0],
    reporter: {
      name: '',
      role: '生活支援員',
    },
    userRows: [],
  });
  const [saving, setSaving] = useState(false);

  const { data: users = [] } = useUsers();

  const attendanceFilteredUsers = useMemo(() => {
    if (!showTodayOnly) {
      return users;
    }

    const targetDate = new Date(formData.date);
    return users.filter((user) => {
      const attendanceDays = user.attendanceDays;
      if (!attendanceDays || !Array.isArray(attendanceDays) || attendanceDays.length === 0) {
        return true;
      }
      return isUserScheduledForDate(
        {
          Id: user.id,
          UserID: user.userId,
          FullName: user.name || '',
          AttendanceDays: attendanceDays,
        },
        targetDate,
      );
    });
  }, [users, showTodayOnly, formData.date]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return attendanceFilteredUsers;
    const query = searchQuery.toLowerCase();
    return attendanceFilteredUsers.filter((user) => (
      user.name?.toLowerCase().includes(query) ||
      user.userId?.toLowerCase().includes(query) ||
      user.furigana?.toLowerCase().includes(query) ||
      user.nameKana?.toLowerCase().includes(query)
    ));
  }, [attendanceFilteredUsers, searchQuery]);

  const selectedUsers = useMemo(() => {
    return selectedUserIds
      .map((id) => users.find((user) => user.userId === id))
      .filter((user): user is User => Boolean(user));
  }, [users, selectedUserIds]);

  useEffect(() => {
    setFormData((prev) => {
      const existingMap = new Map(prev.userRows.map((row) => [row.userId, row]));
      const nextRows: UserRowData[] = selectedUsers.map((user) => {
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
      return {
        ...prev,
        userRows: nextRows,
      };
    });
  }, [selectedUsers]);

  useEffect(() => {
    if (showTodayOnly && selectedUserIds.length > 0) {
      const targetDate = new Date(formData.date);
      const validUserIds = selectedUserIds.filter((userId) => {
        const user = users.find((u) => u.userId === userId);
        if (!user || !user.attendanceDays || !Array.isArray(user.attendanceDays)) {
          return true;
        }

        return isUserScheduledForDate({
          Id: parseInt(userId),
          UserID: userId,
          FullName: user.name || '',
          AttendanceDays: user.attendanceDays,
        }, targetDate);
      });

      if (validUserIds.length !== selectedUserIds.length) {
        setSelectedUserIds(validUserIds);
      }
    }
  }, [formData.date, showTodayOnly, selectedUserIds, users]);

  useEffect(() => {
    if (!open) {
      setSelectionManuallyEdited(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !showTodayOnly || selectionManuallyEdited) {
      return;
    }

    const todayUserIds = attendanceFilteredUsers
      .map((user) => user.userId)
      .filter((id): id is string => Boolean(id));

    if (todayUserIds.length === 0) {
      return;
    }

    const hasSameSelection = todayUserIds.length === selectedUserIds.length &&
      todayUserIds.every((id) => selectedUserIds.includes(id));

    if (!hasSameSelection) {
      setSelectedUserIds(todayUserIds);
    }
  }, [open, showTodayOnly, attendanceFilteredUsers, selectionManuallyEdited, selectedUserIds]);

  const handleUserToggle = (userId: string) => {
    setSelectionManuallyEdited(true);
    setSelectedUserIds((prev) => {
      return prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId];
    });
  };

  const handleSelectAll = () => {
    const allIds = filteredUsers
      .map((user) => user.userId || '')
      .filter((id): id is string => Boolean(id));
    setSelectionManuallyEdited(true);
    setSelectedUserIds(allIds);
  };

  const handleClearAll = () => {
    setSelectionManuallyEdited(true);
    setSelectedUserIds([]);
  };

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
      onClose();
      setSelectedUserIds([]);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        reporter: { name: '', role: '生活支援員' },
        userRows: [],
      });
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
    handleSave,
    saving,
  };
};
