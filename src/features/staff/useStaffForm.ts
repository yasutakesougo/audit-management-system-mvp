import type { ConfirmDialogProps } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import { useStaff } from '@/features/staff/store';
import type { Staff } from '@/types';
import { createRef, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Errors, FormValues, MessageState, StaffFormProps } from './domain/staffFormDomain';
import {
    BASE_WEEKDAY_DEFAULTS,
    BASE_WEEKDAY_OPTIONS,
    DAYS,
    toStaffStorePayload,
    validateStaffForm,
} from './domain/staffFormDomain';

export interface UseStaffFormReturn {
  // state
  values: FormValues;
  errors: Errors;
  isSaving: boolean;
  message: MessageState;
  isDirty: boolean;
  customCertification: string;

  // refs
  formRef: React.RefObject<HTMLFormElement>;
  errRefs: {
    fullName: React.RefObject<HTMLInputElement>;
    email: React.RefObject<HTMLInputElement>;
    phone: React.RefObject<HTMLInputElement>;
    baseShift: React.RefObject<HTMLInputElement>;
  };

  // confirm dialog for unsaved-changes guard
  closeConfirmDialog: ConfirmDialogProps;

  // setters / handlers
  setMessage: React.Dispatch<React.SetStateAction<MessageState>>;
  setCustomCertification: React.Dispatch<React.SetStateAction<string>>;
  setField: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  toggleWorkDay: (day: string) => void;
  toggleBaseWorkingDay: (day: string) => void;
  toggleCertification: (cert: string) => void;
  removeCertification: (cert: string) => void;
  handleAddCustomCertification: () => void;
  handleClose: () => void;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useStaffForm({
  staff,
  mode = staff ? 'update' : 'create',
  onSuccess,
  onDone,
  onClose,
}: StaffFormProps): UseStaffFormReturn {
  const { createStaff, updateStaff } = useStaff();
  const confirmDialog = useConfirmDialog();

  const deriveInitialValues = useCallback(
    (): FormValues => ({
      StaffID: staff?.staffId ?? '',
      FullName: staff?.name ?? '',
      Email: staff?.email ?? '',
      Phone: staff?.phone ?? '',
      Role: staff?.role ?? '',
      WorkDays: [...(staff?.workDays ?? [])],
      Certifications: [...(staff?.certifications ?? [])],
      IsActive: staff?.active ?? true,
      BaseShiftStartTime: staff?.baseShiftStartTime ?? '08:30',
      BaseShiftEndTime: staff?.baseShiftEndTime ?? '17:30',
      BaseWorkingDays: staff ? [...staff.baseWorkingDays] : [...BASE_WEEKDAY_DEFAULTS],
    }),
    [staff]
  );

  const [values, setValues] = useState<FormValues>(() => deriveInitialValues());
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const initialJson = useRef(JSON.stringify(values));
  const formRef = useRef<HTMLFormElement>(null) as React.RefObject<HTMLFormElement>;

  useEffect(() => {
    const next = deriveInitialValues();
    setValues(next);
    setErrors({});
    setMessage(null);
    initialJson.current = JSON.stringify(next);
  }, [deriveInitialValues]);

  const serializedValues = useMemo(() => JSON.stringify(values), [values]);
  const isDirty = serializedValues !== initialJson.current;

  const errRefs = useMemo(
    () => ({
      fullName: createRef<HTMLInputElement>(),
      email: createRef<HTMLInputElement>(),
      phone: createRef<HTMLInputElement>(),
      baseShift: createRef<HTMLInputElement>(),
    }),
    []
  );

  const focusFirstInvalid = useCallback(
    (nextErrors: Errors) => {
      const order: Array<keyof Errors> = ['fullName', 'email', 'phone', 'baseShift'];
      for (const key of order) {
        if (nextErrors[key]) {
          const ref = errRefs[key];
          ref?.current?.focus();
          break;
        }
      }
    },
    [errRefs]
  );

  const validate = useCallback(
    (next: FormValues): Errors => validateStaffForm(next),
    []
  );

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
          onClose?.();
        },
      });
      return;
    }
    onClose?.();
  }, [isDirty, isSaving, onClose, confirmDialog]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isSaving && isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty, isSaving]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isSaving) return;
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        formRef.current?.requestSubmit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose, isSaving]);

  const setField = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleWorkDay = useCallback((day: string) => {
    setValues((prev) => {
      const set = new Set(prev.WorkDays);
      if (set.has(day)) {
        set.delete(day);
      } else {
        set.add(day);
      }
      const ordered = DAYS.map((d) => d.value).filter((d) => set.has(d));
      return { ...prev, WorkDays: ordered };
    });
  }, []);

  const toggleBaseWorkingDay = useCallback((day: string) => {
    setValues((prev) => {
      const set = new Set(prev.BaseWorkingDays);
      if (set.has(day)) {
        set.delete(day);
      } else {
        set.add(day);
      }
      const ordered = BASE_WEEKDAY_OPTIONS.map((option) => option.value).filter((value) => set.has(value));
      return { ...prev, BaseWorkingDays: ordered };
    });
  }, []);

  const toggleCertification = useCallback((cert: string) => {
    setValues((prev) => {
      const set = new Set(prev.Certifications);
      if (set.has(cert)) {
        set.delete(cert);
      } else {
        set.add(cert);
      }
      return { ...prev, Certifications: Array.from(set) };
    });
  }, []);

  const removeCertification = useCallback((cert: string) => {
    setValues((prev) => ({
      ...prev,
      Certifications: prev.Certifications.filter((value) => value !== cert),
    }));
  }, []);

  const [customCertification, setCustomCertification] = useState('');

  const handleAddCustomCertification = useCallback(() => {
    const trimmed = customCertification.trim();
    if (!trimmed) return;
    setValues((prev) => {
      if (prev.Certifications.includes(trimmed)) {
        return prev;
      }
      return { ...prev, Certifications: [...prev.Certifications, trimmed] };
    });
    setCustomCertification('');
  }, [customCertification]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextErrors = validate(values);
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        focusFirstInvalid(nextErrors);
        return;
      }

      setIsSaving(true);
      setMessage(null);
      setErrors({});

      const payload = toStaffStorePayload(values);

      try {
        let result: Staff | null = null;
        if (mode === 'create') {
          result = await createStaff(payload);
          const cleared: FormValues = {
            StaffID: '',
            FullName: '',
            Email: '',
            Phone: '',
            Role: '',
            WorkDays: [],
            Certifications: [],
            IsActive: true,
            BaseShiftStartTime: '08:30',
            BaseShiftEndTime: '17:30',
            BaseWorkingDays: [...BASE_WEEKDAY_DEFAULTS],
          };
          setValues(cleared);
          initialJson.current = JSON.stringify(cleared);
        } else if (mode === 'update' && staff) {
          result = await updateStaff(staff.id, payload);
          initialJson.current = JSON.stringify(values);
        } else {
          throw new Error('更新対象のスタッフIDが指定されていません。');
        }

        if (result) {
          setMessage({ type: 'success', text: mode === 'create' ? '作成しました' : '更新しました' });
          onSuccess?.(result);
          onDone?.(result);
        }
      } catch (error) {
        setMessage({ type: 'error', text: error instanceof Error ? error.message : '保存に失敗しました' });
      } finally {
        setIsSaving(false);
      }
    },
    [createStaff, focusFirstInvalid, mode, onDone, onSuccess, staff, updateStaff, validate, values]
  );

  return {
    values,
    errors,
    isSaving,
    message,
    isDirty,
    customCertification,
    formRef,
    errRefs,
    closeConfirmDialog: confirmDialog.dialogProps,
    setMessage,
    setCustomCertification,
    setField,
    toggleWorkDay,
    toggleBaseWorkingDay,
    toggleCertification,
    removeCertification,
    handleAddCustomCertification,
    handleClose,
    handleSubmit,
  };
}
