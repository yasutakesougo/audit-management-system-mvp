/**
 * useUserFormTypes
 *
 * useUserForm フックで使用する型定義をまとめたファイル。
 * ランタイム値は含まない。
 */
import type { ChangeEvent, FormEvent, RefObject } from 'react';
import type { IUserMaster } from '../../sharepoint/fields';

// ---------------------------------------------------------------------------
// フォーム値・エラー型
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
  TransportCourse: string;
  TransportSchedule: Record<string, { to: string; from: string }>;
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

export type DayTransport = { to: string; from: string };

export type DayField = 'TransportToDays' | 'TransportFromDays' | 'AttendanceDays';

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
  formRef: RefObject<HTMLFormElement | null>;
  errRefs: {
    fullName: RefObject<HTMLInputElement | null>;
    furigana: RefObject<HTMLInputElement | null>;
    certNumber: RefObject<HTMLInputElement | null>;
  };
  // Handlers
  setField: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  setScheduleDay: (day: string, direction: 'to' | 'from', method: string) => void;
  handleSupportTargetToggle: (event: ChangeEvent<HTMLInputElement>) => void;
  handleClose: () => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setMessage: (msg: MessageState) => void;
  setShowConfirmDialog: (v: boolean) => void;
};
