/**
 * useUserForm
 *
 * UserForm のフォームロジックを集約するカスタムフック。
 * UI（JSX）と完全に分離されており、テスト・再利用が容易。
 */
import { ChangeEvent, createRef, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IUserMaster, IUserMasterCreateDto } from '../../sharepoint/fields';
import { useUsersStore } from './store';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type FormValues = {
  FullName: string;
  Furigana: string;
  FullNameKana: string;
  ContractDate: string;
  ServiceStartDate: string;
  ServiceEndDate: string;
  IsHighIntensitySupportTarget: boolean;
  IsSupportProcedureTarget: boolean;
  IsActive: boolean;
  TransportToDays: string[];
  TransportFromDays: string[];
  AttendanceDays: string[];
  RecipientCertNumber: string;
  RecipientCertExpiry: string;
  UsageStatus: string;
  GrantMunicipality: string;
  GrantPeriodStart: string;
  GrantPeriodEnd: string;
  DisabilitySupportLevel: string;
  GrantedDaysPerMonth: string;
  UserCopayLimit: string;
  TransportAdditionType: string;
  MealAddition: string;
  CopayPaymentMethod: string;
};

export type FormErrors = Partial<
  Record<'fullName' | 'furigana' | 'certNumber' | 'dates' | 'grantPeriod' | 'transportAddition', string>
>;

export type MessageState = { type: 'success' | 'error'; text: string } | null;

export type DayField = 'TransportToDays' | 'TransportFromDays' | 'AttendanceDays';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

export const WEEKDAYS = [
  { value: '月', label: '月' },
  { value: '火', label: '火' },
  { value: '水', label: '水' },
  { value: '木', label: '木' },
  { value: '金', label: '金' },
] as const;

export const USAGE_STATUS_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: '利用中', label: '利用中' },
  { value: '契約済・利用開始待ち', label: '契約済・利用開始待ち' },
  { value: '利用休止中', label: '利用休止中' },
  { value: '契約終了', label: '契約終了' },
] as const;

export const DISABILITY_SUPPORT_LEVEL_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: 'none', label: '非該当' },
  { value: '1', label: '区分1' },
  { value: '2', label: '区分2' },
  { value: '3', label: '区分3' },
  { value: '4', label: '区分4' },
  { value: '5', label: '区分5' },
  { value: '6', label: '区分6' },
] as const;

export const TRANSPORT_ADDITION_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: 'both', label: '往復利用' },
  { value: 'oneway-to', label: '片道（往）のみ' },
  { value: 'oneway-from', label: '片道（復）のみ' },
  { value: 'none', label: '利用なし' },
] as const;

export const MEAL_ADDITION_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: 'use', label: '利用する' },
  { value: 'not-use', label: '利用しない' },
] as const;

export const COPAY_METHOD_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: 'bank', label: '口座振替' },
  { value: 'cash-office', label: '現金（事業所）' },
  { value: 'cash-transport', label: '現金（送迎時）' },
] as const;

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

const sanitize = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export const toCreateDto = (values: FormValues): IUserMasterCreateDto => ({
  FullName: values.FullName.trim(),
  Furigana: sanitize(values.Furigana) || null,
  FullNameKana: sanitize(values.FullNameKana) || null,
  ContractDate: sanitize(values.ContractDate) || null,
  ServiceStartDate: sanitize(values.ServiceStartDate) || null,
  ServiceEndDate: sanitize(values.ServiceEndDate) || null,
  IsHighIntensitySupportTarget: values.IsHighIntensitySupportTarget,
  IsSupportProcedureTarget: values.IsSupportProcedureTarget,
  severeFlag: false,
  IsActive: values.IsActive,
  TransportToDays: values.TransportToDays.length ? values.TransportToDays : null,
  TransportFromDays: values.TransportFromDays.length ? values.TransportFromDays : null,
  AttendanceDays: values.AttendanceDays.length ? values.AttendanceDays : null,
  RecipientCertNumber: sanitize(values.RecipientCertNumber) || null,
  RecipientCertExpiry: sanitize(values.RecipientCertExpiry) || null,
  UsageStatus: sanitize(values.UsageStatus) || null,
  GrantMunicipality: sanitize(values.GrantMunicipality) || null,
  GrantPeriodStart: sanitize(values.GrantPeriodStart) || null,
  GrantPeriodEnd: sanitize(values.GrantPeriodEnd) || null,
  DisabilitySupportLevel: sanitize(values.DisabilitySupportLevel) || null,
  GrantedDaysPerMonth: sanitize(values.GrantedDaysPerMonth) || null,
  UserCopayLimit: sanitize(values.UserCopayLimit) || null,
  TransportAdditionType: sanitize(values.TransportAdditionType) || null,
  MealAddition: sanitize(values.MealAddition) || null,
  CopayPaymentMethod: sanitize(values.CopayPaymentMethod) || null,
});

const CLEARED_VALUES: FormValues = {
  FullName: '',
  Furigana: '',
  FullNameKana: '',
  ContractDate: '',
  ServiceStartDate: '',
  ServiceEndDate: '',
  IsHighIntensitySupportTarget: false,
  IsSupportProcedureTarget: false,
  IsActive: true,
  TransportToDays: [],
  TransportFromDays: [],
  AttendanceDays: [],
  RecipientCertNumber: '',
  RecipientCertExpiry: '',
  UsageStatus: '',
  GrantMunicipality: '',
  GrantPeriodStart: '',
  GrantPeriodEnd: '',
  DisabilitySupportLevel: '',
  GrantedDaysPerMonth: '',
  UserCopayLimit: '',
  TransportAdditionType: '',
  MealAddition: '',
  CopayPaymentMethod: '',
};

// ---------------------------------------------------------------------------
// フックのパラメータ・返り値型
// ---------------------------------------------------------------------------

export type UseUserFormOptions = {
  onSuccess?: (user: IUserMaster) => void;
  onDone?: (user: IUserMaster) => void;
  onClose?: () => void;
};

export type UseUserFormReturn = {
  // State
  values: FormValues;
  errors: FormErrors;
  isSaving: boolean;
  message: MessageState;
  showConfirmDialog: boolean;
  isDirty: boolean;
  // Refs
  formRef: React.RefObject<HTMLFormElement | null>;
  errRefs: {
    fullName: React.RefObject<HTMLInputElement | null>;
    furigana: React.RefObject<HTMLInputElement | null>;
    certNumber: React.RefObject<HTMLInputElement | null>;
  };
  // Handlers
  setField: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  toggleDay: (day: string, field: DayField) => void;
  handleSupportTargetToggle: (event: ChangeEvent<HTMLInputElement>) => void;
  handleClose: () => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setMessage: (msg: MessageState) => void;
  setShowConfirmDialog: (v: boolean) => void;
};

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
      TransportToDays: [...(user?.TransportToDays ?? [])],
      TransportFromDays: [...(user?.TransportFromDays ?? [])],
      AttendanceDays: [...(user?.AttendanceDays ?? [])],
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
  // ディレクタイム管理
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
    console.log('UserForm handleClose called, isDirty:', isDirty);
    blurActiveElement();
    if (isDirty) {
      if (confirmDialogTimer.current !== null) {
        window.clearTimeout(confirmDialogTimer.current);
      }
      confirmDialogTimer.current = window.setTimeout(() => {
        setShowConfirmDialog(true);
      }, 0);
    } else {
      console.log('Calling onClose callback');
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
  // setField / toggleDay
  // --------------------------------
  const setField = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleDay = useCallback((day: string, field: DayField) => {
    setValues((prev) => {
      const set = new Set(prev[field]);
      if (set.has(day)) {
        set.delete(day);
      } else {
        set.add(day);
      }
      const ordered = WEEKDAYS.map((d) => d.value).filter((d) => set.has(d));
      return { ...prev, [field]: ordered };
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
    toggleDay,
    handleSupportTargetToggle,
    handleClose,
    handleSubmit,
    setMessage,
    setShowConfirmDialog,
  };
}
