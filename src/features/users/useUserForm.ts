/**
 * useUserForm
 *
 * UserForm のフォームロジックを集約するカスタムフック。
 * UI（JSX）と完全に分離されており、テスト・再利用が容易。
 *
 * 型定義    → useUserFormTypes.ts
 * 定数      → useUserFormConstants.ts
 * ヘルパー  → useUserFormHelpers.ts
 */
import { ChangeEvent, createRef, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IUserMaster } from '../../sharepoint/fields';
import { useUsersStore } from './store';
import { CLEARED_VALUES } from './useUserFormConstants';
import { parseTransportSchedule, toCreateDto } from './useUserFormHelpers';
import type {
    FormErrors,
    FormValues,
    MessageState,
    UseUserFormOptions,
    UseUserFormReturn,
} from './useUserFormTypes';

// ---------------------------------------------------------------------------
// Re-exports — preserve import compatibility for existing callers
// ---------------------------------------------------------------------------

export type {
    DayField,
    DayTransport,
    FormErrors,
    FormValues,
    MessageState,
    UseUserFormOptions,
    UseUserFormReturn
} from './useUserFormTypes';

export {
    CLEARED_VALUES,
    COPAY_METHOD_OPTIONS,
    DISABILITY_SUPPORT_LEVEL_OPTIONS,
    MEAL_ADDITION_OPTIONS,
    TRANSPORT_ADDITION_OPTIONS,
    TRANSPORT_METHOD_OPTIONS,
    USAGE_STATUS_OPTIONS,
    WEEKDAYS
} from './useUserFormConstants';

export { parseTransportSchedule, toCreateDto } from './useUserFormHelpers';

// ---------------------------------------------------------------------------
// メインフック
// ---------------------------------------------------------------------------

export function useUserForm(
  user: IUserMaster | undefined,
  mode: 'create' | 'update',
  options: UseUserFormOptions,
): UseUserFormReturn {
  const { create, update: updateUser } = useUsersStore();
  const { onSuccess, onDone, onClose } = options;

  // --------------------------------
  // 初期値の導出
  // --------------------------------
  const deriveInitialValues = useCallback(
    (): FormValues => ({
      FullName: user?.FullName ?? '',
      Furigana: user?.Furigana ?? '',
      FullNameKana: user?.FullNameKana ?? '',
      ContractDate: user?.ContractDate ?? '',
      ServiceStartDate: user?.ServiceStartDate ?? '',
      ServiceEndDate: user?.ServiceEndDate ?? '',
      IsHighIntensitySupportTarget: user?.IsHighIntensitySupportTarget ?? false,
      IsSupportProcedureTarget:
        user?.IsSupportProcedureTarget ?? user?.IsHighIntensitySupportTarget ?? false,
      IsActive: user?.IsActive ?? true,
      TransportSchedule: parseTransportSchedule(user?.TransportSchedule),
      RecipientCertNumber: user?.RecipientCertNumber ?? '',
      RecipientCertExpiry: user?.RecipientCertExpiry ?? '',
      UsageStatus:
        user?.UsageStatus ?? (user?.IsActive === false ? '契約終了' : '利用中'),
      GrantMunicipality: user?.GrantMunicipality ?? '',
      GrantPeriodStart: user?.GrantPeriodStart ?? '',
      GrantPeriodEnd: user?.GrantPeriodEnd ?? '',
      DisabilitySupportLevel: user?.DisabilitySupportLevel ?? '',
      GrantedDaysPerMonth: user?.GrantedDaysPerMonth ?? '',
      UserCopayLimit: user?.UserCopayLimit ?? '',
      TransportAdditionType: user?.TransportAdditionType ?? '',
      MealAddition: user?.MealAddition ?? '',
      CopayPaymentMethod: user?.CopayPaymentMethod ?? '',
    }),
    [user],
  );

  // --------------------------------
  // State
  // --------------------------------
  const [values, setValues] = useState<FormValues>(() => deriveInitialValues());
  const [errors, setErrors] = useState<FormErrors>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const initialJson = useRef(JSON.stringify(values));
  const formRef = useRef<HTMLFormElement | null>(null);
  const confirmDialogTimer = useRef<number | null>(null);

  // user prop 変更時にフォームをリセット
  useEffect(() => {
    const next = deriveInitialValues();
    setValues(next);
    setErrors({});
    setMessage(null);
    initialJson.current = JSON.stringify(next);
  }, [deriveInitialValues]);

  // --------------------------------
  // isDirty
  // --------------------------------
  const serializedValues = useMemo(() => JSON.stringify(values), [values]);
  const isDirty = serializedValues !== initialJson.current;

  // --------------------------------
  // エラーフォーカス用 Refs
  // --------------------------------
  const errRefs = useMemo(
    () => ({
      fullName: createRef<HTMLInputElement | null>(),
      furigana: createRef<HTMLInputElement | null>(),
      certNumber: createRef<HTMLInputElement | null>(),
    }),
    [],
  );

  const focusFirstInvalid = useCallback(
    (nextErrors: FormErrors) => {
      const order: Array<keyof typeof errRefs> = ['fullName', 'furigana', 'certNumber'];
      for (const key of order) {
        if (nextErrors[key]) {
          const ref = errRefs[key];
          ref?.current?.focus();
          break;
        }
      }
    },
    [errRefs],
  );

  // --------------------------------
  // バリデーション
  // --------------------------------
  const validate = useCallback((next: FormValues): FormErrors => {
    const errs: FormErrors = {};
    if (!next.FullName.trim()) {
      errs.fullName = '氏名は必須です';
    }
    if (!next.Furigana.trim()) {
      errs.furigana = 'ふりがなは必須です';
    }
    if (next.RecipientCertNumber.trim() && !/^\d{10}$/.test(next.RecipientCertNumber.trim())) {
      errs.certNumber = '受給者証番号は10桁の数字で入力してください';
    }
    const startDate = next.ServiceStartDate.trim();
    const endDate = next.ServiceEndDate.trim();
    if (startDate && endDate && endDate <= startDate) {
      errs.dates = 'サービス終了日は開始日より後にしてください';
    }
    const grantStart = next.GrantPeriodStart.trim();
    const grantEnd = next.GrantPeriodEnd.trim();
    if (grantStart && grantEnd && grantEnd <= grantStart) {
      errs.grantPeriod = '支給決定期間の終了日は開始日より後にしてください';
    }
    return errs;
  }, []);

  // --------------------------------
  // タイマー管理
  // --------------------------------
  useEffect(() => {
    return () => {
      if (confirmDialogTimer.current !== null) {
        window.clearTimeout(confirmDialogTimer.current);
      }
    };
  }, []);

  // --------------------------------
  // beforeunload
  // --------------------------------
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

  // --------------------------------
  // blurActiveElement（ヘルパー）
  // --------------------------------
  const blurActiveElement = useCallback(() => {
    if (typeof document === 'undefined') return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
    const body = document.body as HTMLElement | null;
    if (body) {
      const hadTabIndex = body.hasAttribute('tabindex');
      if (!hadTabIndex) body.setAttribute('tabindex', '-1');
      body.focus();
      if (!hadTabIndex) body.removeAttribute('tabindex');
    }
  }, []);

  // --------------------------------
  // handleClose
  // --------------------------------
  const handleClose = useCallback(() => {
    blurActiveElement();
    if (isDirty) {
      if (confirmDialogTimer.current !== null) {
        window.clearTimeout(confirmDialogTimer.current);
      }
      confirmDialogTimer.current = window.setTimeout(() => {
        setShowConfirmDialog(true);
      }, 0);
    } else {
      onClose?.();
    }
  }, [blurActiveElement, isDirty, onClose]);

  // --------------------------------
  // keydown ショートカット
  // --------------------------------
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

  // --------------------------------
  // setField / setScheduleDay
  // --------------------------------
  const setField = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setScheduleDay = useCallback((day: string, direction: 'to' | 'from', method: string) => {
    setValues((prev) => {
      const schedule = { ...prev.TransportSchedule };
      const entry = schedule[day] ?? { to: '', from: '' };
      schedule[day] = { ...entry, [direction]: method };
      return { ...prev, TransportSchedule: schedule };
    });
  }, []);

  // --------------------------------
  // 強度行動障害フラグ同期
  // --------------------------------
  useEffect(() => {
    // 強度行動障害支援対象者の場合、支援手順記録対象は必須
    if (values.IsHighIntensitySupportTarget && !values.IsSupportProcedureTarget) {
      setValues((prev) => ({
        ...prev,
        IsSupportProcedureTarget: true,
      }));
    }
  }, [values.IsHighIntensitySupportTarget, values.IsSupportProcedureTarget]);

  const handleSupportTargetToggle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked;
    setValues((prev) => ({
      ...prev,
      IsHighIntensitySupportTarget: nextValue,
      IsSupportProcedureTarget: nextValue,
    }));
  }, []);

  // --------------------------------
  // handleSubmit
  // --------------------------------
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

      const payload = toCreateDto(values);

      try {
        let result: IUserMaster | null = null;
        if (mode === 'create') {
          result = await create(payload);
          setValues(CLEARED_VALUES);
          initialJson.current = JSON.stringify(CLEARED_VALUES);
        } else if (mode === 'update' && user) {
          if (user.Id == null) {
            throw new Error('更新対象の利用者IDが指定されていません。');
          }
          result = await updateUser(user.Id, payload);
          initialJson.current = JSON.stringify(values);
        } else {
          throw new Error('更新対象の利用者IDが指定されていません。');
        }

        if (result) {
          setMessage({
            type: 'success',
            text: mode === 'create' ? '作成しました' : '更新しました',
          });
          onSuccess?.(result);
          onDone?.(result);
        }
      } catch (error) {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : '保存に失敗しました',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [create, focusFirstInvalid, mode, onDone, onSuccess, updateUser, user, validate, values],
  );

  // --------------------------------
  // 返り値
  // --------------------------------
  return {
    values,
    errors,
    isSaving,
    message,
    showConfirmDialog,
    isDirty,
    formRef,
    errRefs,
    setField,
    setScheduleDay,
    handleSupportTargetToggle,
    handleClose,
    handleSubmit,
    setMessage,
    setShowConfirmDialog,
  };
}
