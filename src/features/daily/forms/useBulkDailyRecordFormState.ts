/**
 * useBulkDailyRecordFormState.ts
 *
 * State, handlers, and derived data for BulkDailyRecordForm.
 * Extracted from BulkDailyRecordForm.tsx following the same pattern
 * as useDailyRecordFormState.ts.
 */

import { useUsers } from '@/features/users/store';
import type { IUserMaster } from '@/features/users/types';
import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { filterActiveUsers } from '@/features/users/domain/userLifecycle';
import type { BulkActivityData, BulkDailyRecordFormProps } from './bulkDailyRecordFormLogic';
import { createEmptyBulkActivityData, filterUsers } from './bulkDailyRecordFormLogic';

type BulkSelectableUser = {
  id: number;
  userId: string;
  name: string;
  furigana: string | undefined;
};

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useBulkDailyRecordFormState(props: Pick<BulkDailyRecordFormProps, 'onClose' | 'onSave'>) {
  const { onClose, onSave } = props;

  // ─── State ────────────────────────────────────────────────────────────
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<BulkActivityData>(createEmptyBulkActivityData);
  const [newActivityAM, setNewActivityAM] = useState('');
  const [newActivityPM, setNewActivityPM] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── Data ─────────────────────────────────────────────────────────────
  const { data: users = [] } = useUsers();

  // ─── Derived ──────────────────────────────────────────────────────────
  const candidateUsers = useMemo<BulkSelectableUser[]>(
    () => {
      const result: BulkSelectableUser[] = [];
      for (const user of filterActiveUsers(users as unknown as IUserMaster[])) {
        const userId = (user.UserID ?? '').trim();
        if (!userId) {
          continue;
        }
        result.push({
          id: user.Id,
          userId,
          name: (user.FullName ?? '').trim() || userId,
          furigana: (user.Furigana ?? user.FullNameKana ?? '').trim() || undefined,
        });
      }
      return result;
    },
    [users],
  );

  const filteredUsers = useMemo(
    () => filterUsers(candidateUsers, searchQuery),
    [candidateUsers, searchQuery],
  );

  const selectedUsers = useMemo(
    () => candidateUsers.filter((user) => selectedUserIds.includes(user.userId)),
    [candidateUsers, selectedUserIds],
  );

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleUserToggle = useCallback((userId: string) => {
    setSelectedUserIds(prev => {
      const newIds = prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId];

      // Initialize individual notes for new users
      if (!prev.includes(userId)) {
        setFormData(prevData => ({
          ...prevData,
          individualNotes: {
            ...prevData.individualNotes,
            [userId]: {},
          },
        }));
      }

      return newIds;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = filteredUsers
      .map((user) => user.userId)
      .filter((id): id is string => Boolean(id));
    setSelectedUserIds(allIds);

    const newIndividualNotes: Record<string, object> = {};
    allIds.forEach(id => {
      newIndividualNotes[id] = {};
    });

    setFormData(prev => ({
      ...prev,
      individualNotes: {
        ...prev.individualNotes,
        ...newIndividualNotes,
      },
    }));
  }, [filteredUsers]);

  const handleClearAll = useCallback(() => {
    setSelectedUserIds([]);
  }, []);

  const handleAddActivity = useCallback((period: 'AM' | 'PM') => {
    const newActivity = period === 'AM' ? newActivityAM : newActivityPM;
    if (newActivity.trim()) {
      const field = period === 'AM' ? 'amActivities' : 'pmActivities';
      setFormData(prev => ({
        ...prev,
        commonActivities: {
          ...prev.commonActivities,
          [field]: [...prev.commonActivities[field], newActivity.trim()],
        },
      }));
      if (period === 'AM') {
        setNewActivityAM('');
      } else {
        setNewActivityPM('');
      }
    }
  }, [newActivityAM, newActivityPM]);

  const handleRemoveActivity = useCallback((period: 'AM' | 'PM', index: number) => {
    const field = period === 'AM' ? 'amActivities' : 'pmActivities';
    setFormData(prev => ({
      ...prev,
      commonActivities: {
        ...prev.commonActivities,
        [field]: prev.commonActivities[field].filter((_, i) => i !== index),
      },
    }));
  }, []);

  const handleIndividualNoteChange = useCallback((userId: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      individualNotes: {
        ...prev.individualNotes,
        [userId]: {
          ...prev.individualNotes[userId],
          [field]: value,
        },
      },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (selectedUserIds.length === 0) {
      toast.error('利用者を1人以上選択してください', { duration: 4000 });
      return;
    }

    if (!formData.reporter.name.trim()) {
      toast.error('記録者名を入力してください', { duration: 4000 });
      return;
    }

    setSaving(true);
    try {
      await onSave(formData, selectedUserIds);
      onClose();
      // Reset form
      setSelectedUserIds([]);
      setFormData(createEmptyBulkActivityData());
    } catch (error) {
      console.error('保存に失敗しました:', error);
      toast.error('保存に失敗しました。もう一度お試しください。', { duration: 5000 });
    } finally {
      setSaving(false);
    }
  }, [selectedUserIds, formData, onSave, onClose]);

  // ─── Field updaters (replace inline setFormData in JSX) ───────────────

  const updateDate = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, date: value }));
  }, []);

  const updateReporterName = useCallback((value: string) => {
    setFormData(prev => ({
      ...prev,
      reporter: { ...prev.reporter, name: value },
    }));
  }, []);

  const updateReporterRole = useCallback((value: string) => {
    setFormData(prev => ({
      ...prev,
      reporter: { ...prev.reporter, role: value },
    }));
  }, []);

  const updateAmNotes = useCallback((value: string) => {
    setFormData(prev => ({
      ...prev,
      commonActivities: { ...prev.commonActivities, amNotes: value },
    }));
  }, []);

  const updatePmNotes = useCallback((value: string) => {
    setFormData(prev => ({
      ...prev,
      commonActivities: { ...prev.commonActivities, pmNotes: value },
    }));
  }, []);

  // ─── Return ───────────────────────────────────────────────────────────

  return {
    // State
    formData,
    selectedUserIds,
    searchQuery,
    newActivityAM,
    newActivityPM,
    saving,
    // Derived
    filteredUsers,
    selectedUsers,
    // Setters
    setSearchQuery,
    setNewActivityAM,
    setNewActivityPM,
    // Handlers
    handleUserToggle,
    handleSelectAll,
    handleClearAll,
    handleAddActivity,
    handleRemoveActivity,
    handleIndividualNoteChange,
    handleSave,
    // Field updaters
    updateDate,
    updateReporterName,
    updateReporterRole,
    updateAmNotes,
    updatePmNotes,
  } as const;
}
