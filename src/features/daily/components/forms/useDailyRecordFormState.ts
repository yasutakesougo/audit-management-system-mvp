/**
 * useDailyRecordFormState
 *
 * State management hook extracted from DailyRecordForm.tsx.
 * Handles all form state, handlers, effects, validation, and saving logic.
 */

import type { ConfirmDialogProps } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import type { DailyAData, MealAmount, PersonDaily } from '@/features/daily';
import {
    buildSpecialNotesFromImportantHandoffs,
    shouldAutoGenerateSpecialNotes,
    useImportantHandoffsForDaily,
} from '@/features/handoff';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    buildProblemBehaviorSuggestion,
    createEmptyDailyRecord,
    todayYmdLocal,
    validateDailyRecordForm,
    type ProblemBehaviorSuggestion,
} from './dailyRecordFormLogic';
import type { DailyUserOption } from '../../index';
import { useDailyUserOptions } from '../../index';

export interface DailyRecordFormStateParams {
  open: boolean;
  onClose: () => void;
  record?: PersonDaily;
  onSave: (record: Omit<PersonDaily, 'id'>) => Promise<void>;
}

export interface DailyRecordFormState {
  // Core form data
  formData: Omit<PersonDaily, 'id'>;
  setFormData: React.Dispatch<React.SetStateAction<Omit<PersonDaily, 'id'>>>;

  // User selection
  userOptions: DailyUserOption[];
  selectedUserValue: DailyUserOption | null;

  // Errors & validation
  errors: Record<string, string>;
  isFormValid: string | false | undefined;

  // Saving state
  isSaving: boolean;
  saveError: string | null;
  setSaveError: (e: string | null) => void;
  isDirty: boolean;

  // Activity input
  newActivityAM: string;
  setNewActivityAM: (v: string) => void;
  newActivityPM: string;
  setNewActivityPM: (v: string) => void;

  // Handoff integration
  loadingHandoffs: boolean;
  handoffError: string | null;
  handoffCount: number;
  importantHandoffs: ReturnType<typeof useImportantHandoffsForDaily>['items'];
  dayScope: string;

  // Problem behavior suggestion
  problemSuggestion: ProblemBehaviorSuggestion | null;
  problemSuggestionApplied: boolean;

  // Navigation
  navigate: ReturnType<typeof useNavigate>;

  // Handlers
  handleClose: () => void;
  handleDateChange: (value: string) => void;
  handleDataChange: (field: keyof DailyAData, value: string | string[] | MealAmount) => void;
  handleProblemBehaviorChange: (field: string, value: boolean | string) => void;
  handleSeizureRecordChange: (field: string, value: boolean | string) => void;
  handleReporterChange: (value: string) => void;
  handlePersonChange: (option: DailyUserOption | null) => void;
  handleAddActivity: (period: 'AM' | 'PM') => void;
  handleRemoveActivity: (period: 'AM' | 'PM', index: number) => void;
  handleBehaviorTagToggle: (tagKey: string) => void;
  applyProblemBehaviorSuggestion: () => void;
  handleSave: () => Promise<void>;

  // Confirm dialog for unsaved-changes guard
  closeConfirmDialog: ConfirmDialogProps;
}

export function useDailyRecordFormState({
  open,
  onClose,
  record,
  onSave,
}: DailyRecordFormStateParams): DailyRecordFormState {
  const navigate = useNavigate();
  const { options: userOptions, findByUserId } = useDailyUserOptions();
  const confirmDialog = useConfirmDialog();

  const initialFormDataRef = useRef<string>('');
  const [formData, setFormData] = useState<Omit<PersonDaily, 'id'>>(() => createEmptyDailyRecord());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newActivityAM, setNewActivityAM] = useState('');
  const [newActivityPM, setNewActivityPM] = useState('');
  const [problemSuggestionApplied, setProblemSuggestionApplied] = useState(false);

  // User selection
  const selectedUserValue = useMemo<DailyUserOption | null>(() => {
    if (!formData.userId) return null;
    const matched = findByUserId(formData.userId);
    if (matched) return matched;
    if (formData.userName) {
      return { id: formData.userId, label: formData.userName, lookupId: undefined, furigana: null };
    }
    return null;
  }, [findByUserId, formData.userId, formData.userName]);

  // Date scope for handoff lookup
  const todayYmd = todayYmdLocal();
  const dayScope = formData.date === todayYmd ? 'today' : 'yesterday';

  // Handoff integration
  const {
    items: importantHandoffs,
    loading: loadingHandoffs,
    error: handoffError,
    count: handoffCount,
  } = useImportantHandoffsForDaily(formData.userId, formData.date);

  // Problem behavior suggestion
  const problemSuggestion = useMemo(
    () =>
      importantHandoffs && importantHandoffs.length > 0
        ? buildProblemBehaviorSuggestion(importantHandoffs)
        : null,
    [importantHandoffs],
  );

  // ─── Effects ────────────────────────────────────────────────────────────

  // Record initialization
  useEffect(() => {
    if (record) {
      const initial = {
        userId: record.userId,
        userName: record.userName,
        date: record.date,
        status: record.status,
        reporter: record.reporter,
        draft: record.draft,
        kind: record.kind,
        data: record.data,
      };
      setFormData(initial);
      initialFormDataRef.current = JSON.stringify(initial);
    } else {
      const initial = createEmptyDailyRecord();
      setFormData(initial);
      initialFormDataRef.current = JSON.stringify(initial);
    }
  }, [record, open]);

  // Dirty detection
  const isDirty = useMemo(
    () => initialFormDataRef.current !== '' && JSON.stringify(formData) !== initialFormDataRef.current,
    [formData],
  );

  // Browser unload guard
  useEffect(() => {
    if (!open) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [open, isDirty]);

  // Auto-generate special notes from handoffs
  useEffect(() => {
    if (
      shouldAutoGenerateSpecialNotes(
        !record,
        formData.userId,
        formData.data.specialNotes || '',
        handoffCount,
      ) &&
      !loadingHandoffs &&
      !handoffError &&
      importantHandoffs
    ) {
      setFormData((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          specialNotes: buildSpecialNotesFromImportantHandoffs(
            importantHandoffs,
            prev.data.specialNotes || '',
          ),
        },
      }));
    }
  }, [record, formData.userId, loadingHandoffs, importantHandoffs, handoffCount, handoffError]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    if (isSaving) return;
    if (isDirty) {
      confirmDialog.open({
        title: '変更が保存されていません',
        message: 'このまま閉じると入力内容は失われます。',
        confirmLabel: '破棄して閉じる',
        cancelLabel: '戻る',
        severity: 'warning',
        onConfirm: () => {
          setSaveError(null);
          onClose();
        },
      });
      return;
    }
    setSaveError(null);
    onClose();
  }, [isDirty, isSaving, onClose, confirmDialog]);

  const handleDateChange = (value: string) => {
    setFormData((prev) => ({ ...prev, date: value }));
    if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
  };

  const handleDataChange = (field: keyof DailyAData, value: string | string[] | MealAmount) => {
    setFormData((prev) => ({
      ...prev,
      data: { ...prev.data, [field]: value },
    }));
  };

  const handleProblemBehaviorChange = (field: string, value: boolean | string) => {
    setFormData((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        problemBehavior: {
          selfHarm: false,
          otherInjury: false,
          loudVoice: false,
          pica: false,
          other: false,
          otherDetail: '',
          ...prev.data.problemBehavior,
          [field]: value,
        },
      },
    }));
  };

  const handleSeizureRecordChange = (field: string, value: boolean | string) => {
    setFormData((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        seizureRecord: {
          occurred: false,
          time: '',
          duration: '',
          severity: undefined,
          notes: '',
          ...prev.data.seizureRecord,
          [field]: value,
        },
      },
    }));
  };

  const handleReporterChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      reporter: { ...prev.reporter, name: value },
    }));
  };

  const handlePersonChange = (option: DailyUserOption | null) => {
    setFormData((prev) => ({
      ...prev,
      userId: option?.id ?? '',
      userName: option?.label ?? '',
    }));
    if (errors.userId) setErrors((prev) => ({ ...prev, userId: '' }));
  };

  const handleAddActivity = (period: 'AM' | 'PM') => {
    const newActivity = period === 'AM' ? newActivityAM : newActivityPM;
    if (newActivity.trim()) {
      const field = period === 'AM' ? 'amActivities' : 'pmActivities';
      setFormData((prev) => ({
        ...prev,
        data: { ...prev.data, [field]: [...prev.data[field], newActivity.trim()] },
      }));
      if (period === 'AM') setNewActivityAM('');
      else setNewActivityPM('');
    }
  };

  const handleRemoveActivity = (period: 'AM' | 'PM', index: number) => {
    const field = period === 'AM' ? 'amActivities' : 'pmActivities';
    setFormData((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        [field]: prev.data[field].filter((_: string, i: number) => i !== index),
      },
    }));
  };

  const handleBehaviorTagToggle = useCallback((tagKey: string) => {
    setFormData((prev) => {
      const current = prev.data.behaviorTags ?? [];
      const next = current.includes(tagKey)
        ? current.filter((t: string) => t !== tagKey)
        : [...current, tagKey];
      return { ...prev, data: { ...prev.data, behaviorTags: next } };
    });
  }, []);

  const applyProblemBehaviorSuggestion = () => {
    if (!problemSuggestion) return;
    setFormData((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        problemBehavior: {
          selfHarm: prev.data.problemBehavior?.selfHarm || problemSuggestion.selfHarm,
          otherInjury: prev.data.problemBehavior?.otherInjury || problemSuggestion.otherInjury,
          loudVoice: prev.data.problemBehavior?.loudVoice || problemSuggestion.loudVoice,
          pica: prev.data.problemBehavior?.pica || problemSuggestion.pica,
          other: prev.data.problemBehavior?.other || problemSuggestion.other,
          otherDetail: prev.data.problemBehavior?.otherDetail || problemSuggestion.otherDetail,
        },
      },
    }));
    setProblemSuggestionApplied(true);
  };

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    const validationErrors = validateDailyRecordForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(formData);
      initialFormDataRef.current = JSON.stringify(formData);
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, onSave, formData, onClose]);

  const isFormValid = formData.userId && formData.date && formData.reporter.name.trim();

  return {
    formData,
    setFormData,
    userOptions,
    selectedUserValue,
    errors,
    isFormValid,
    isSaving,
    saveError,
    setSaveError,
    isDirty,
    newActivityAM,
    setNewActivityAM,
    newActivityPM,
    setNewActivityPM,
    loadingHandoffs,
    handoffError,
    handoffCount,
    importantHandoffs: importantHandoffs ?? [],
    dayScope,
    problemSuggestion,
    problemSuggestionApplied,
    navigate,
    handleClose,
    handleDateChange,
    handleDataChange,
    handleProblemBehaviorChange,
    handleSeizureRecordChange,
    handleReporterChange,
    handlePersonChange,
    handleAddActivity,
    handleRemoveActivity,
    handleBehaviorTagToggle,
    applyProblemBehaviorSuggestion,
    handleSave,
    closeConfirmDialog: confirmDialog.dialogProps,
  };
}
