// contract:allow-interface — Form state interfaces are UI-layer contracts, not data shapes (SSOT = schema.ts)
import { addHours, format } from 'date-fns';

import type { CreateScheduleEventInput, ScheduleServiceType } from '../data';

// ===== Helper Functions =====

function formatDateTimeLocal(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export const SERVICE_TYPE_OPTIONS: { value: ScheduleServiceType; label: string }[] = [
  { value: 'absence', label: '欠席' },
  { value: 'late', label: '遅刻' },
  { value: 'earlyLeave', label: '早退' },
  { value: 'other', label: 'その他' },
];

/** 生活支援カテゴリ用サービス種別 */
export const LIVING_SUPPORT_SERVICE_TYPE_OPTIONS: { value: ScheduleServiceType; label: string }[] = [
  { value: 'respite', label: '一時ケア' },
  { value: 'shortStay', label: 'ショートステイ' },
  { value: 'newRegistration', label: '新規登録' },
  { value: 'meeting', label: '会議' },
  { value: 'other', label: 'その他' },
];
export function buildAutoTitle(params: {
  userName?: string;
  serviceType?: ScheduleServiceType | string | null;
  assignedStaffId?: string;
  vehicleId?: string;
}): string {
  if (params.userName?.trim()) return `${params.userName}の予定`;
  if (params.serviceType) {
    const label = SERVICE_TYPE_OPTIONS.find((o) => o.value === params.serviceType)?.label;
    if (label) return `${label}の予定`;
  }
  if (params.assignedStaffId?.trim()) return `担当 ${params.assignedStaffId} の予定`;
  if (params.vehicleId?.trim()) return `車両 ${params.vehicleId} の予定`;
  return '';
}

import { z } from 'zod';
import { 
  ScheduleCategorySchema, 
  ScheduleStatusSchema, 
  CreateScheduleInputSchema 
} from './schema';

// ===== Types =====

export interface ScheduleUserOption {
  id: string;
  name: string;
  lookupId?: string;
}

/**
 * Zod Schema for Schedule Form state
 * Matches ScheduleFormState interface
 */
export const ScheduleFormSchema = z.object({
  title: z.string().min(1, '予定タイトルを入力してください'),
  category: ScheduleCategorySchema,
  userId: z.string(),
  startLocal: z.string().min(1, '開始日時を入力してください'),
  endLocal: z.string().min(1, '終了日時を入力してください'),
  serviceType: z.string().nullable().optional(),
  locationName: z.string(),
  notes: z.string(),
  assignedStaffId: z.string(),
  vehicleId: z.string(),
  status: ScheduleStatusSchema,
  statusReason: z.string(),
}).refine(data => {
  if (!data.startLocal || !data.endLocal) return true;
  const start = new Date(data.startLocal);
  const end = new Date(data.endLocal);
  return end > start;
}, {
  message: '終了日時は開始日時より後にしてください',
  path: ['endLocal'],
}).refine(data => {
  if (data.category === 'User' || data.category === 'LivingSupport') {
    return !!data.serviceType;
  }
  return true;
}, {
  message: 'サービス種別を選択してください',
  path: ['serviceType'],
});

export type ScheduleFormState = z.infer<typeof ScheduleFormSchema>;

export function createInitialScheduleFormState(options?: {
  initialDate?: Date | string;
  initialStartTime?: string;
  initialEndTime?: string;
  defaultUserId?: string;
  defaultTitle?: string;
  override?: Partial<ScheduleFormState> | null;
}): ScheduleFormState {
  const base = (() => {
    if (options?.initialDate) {
      if (typeof options.initialDate === 'string') {
        const parsed = new Date(`${options.initialDate}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      } else if (options.initialDate instanceof Date) {
        return options.initialDate;
      }
    }
    return new Date();
  })();

  const parseTime = (value?: string): { hours: number; minutes: number } | null => {
    if (!value) return null;
    const [hoursStr, minutesStr] = value.split(':');
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return { hours, minutes };
  };

  const start = new Date(base);
  const startTime = parseTime(options?.initialStartTime);
  if (startTime) {
    start.setHours(startTime.hours, startTime.minutes, 0, 0);
  } else {
    start.setHours(10, 0, 0, 0);
  }

  let end = new Date(base);
  const endTime = parseTime(options?.initialEndTime);
  if (endTime) {
    end.setHours(endTime.hours, endTime.minutes, 0, 0);
  } else {
    end = addHours(start, 1);
  }

  const initial: ScheduleFormState = {
    title: options?.defaultTitle ?? '',
    category: options?.override?.category ?? 'User',
    userId: options?.defaultUserId ?? '',
    startLocal: formatDateTimeLocal(start),
    endLocal: formatDateTimeLocal(end),
    serviceType: '',
    locationName: '',
    notes: '',
    assignedStaffId: '',
    vehicleId: '',
    status: 'Planned',
    statusReason: '',
  };

  if (options?.override) {
    const override: Partial<ScheduleFormState> = {
      ...options.override,
      status: options.override.status ?? 'Planned',
      statusReason: options.override.statusReason ?? '',
    };
    return {
      ...initial,
      ...override,
    } as ScheduleFormState;
  }

  return initial;
}

export interface ScheduleFormValidationResult {
  isValid: boolean;
  errors: string[];
  fieldErrors: Record<string, string[] | undefined>;
}

export function validateScheduleForm(form: ScheduleFormState): ScheduleFormValidationResult {
  const result = ScheduleFormSchema.safeParse(form);
  if (result.success) {
    return { isValid: true, errors: [], fieldErrors: {} };
  }

  const { formErrors, fieldErrors } = result.error.flatten();
  
  // Collect all unique error messages for the summary
  const allErrors = [
    ...formErrors,
    ...Object.values(fieldErrors).flat()
  ].filter((msg): msg is string => !!msg);

  return { 
    isValid: false, 
    errors: Array.from(new Set(allErrors)),
    fieldErrors
  };
}

export function toCreateScheduleInput(
  form: ScheduleFormState,
  selectedUser?: ScheduleUserOption | null,
): CreateScheduleEventInput {
  const trimmedTitle = form.title.trim();
  if (!trimmedTitle) {
    throw new Error('title is required');
  }
  if (!form.startLocal || !form.endLocal) {
    throw new Error('startLocal and endLocal are required');
  }
  if (form.category === 'User' && !form.serviceType) {
    throw new Error('serviceType is required for user schedules');
  }

  const normalizeLookupId = (value?: unknown): string | null => {
    if (value == null) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    if (typeof value === 'object') {
      const lookupSource = value as Record<string, unknown>;
      if ('lookupId' in lookupSource) {
        return normalizeLookupId(lookupSource.lookupId);
      }
      if ('id' in lookupSource) {
        return normalizeLookupId(lookupSource.id);
      }
      if ('value' in lookupSource) {
        return normalizeLookupId(lookupSource.value);
      }
    }
    return null;
  };

  if (form.category === 'User' && !form.userId.trim()) {
    throw new Error('userId is required for user schedules');
  }

  if (form.category === 'Staff' && !form.assignedStaffId.trim()) {
    throw new Error('assignedStaffId is required for staff schedules');
  }

  let resolvedServiceType: ScheduleServiceType;
  if (form.category === 'User') {
    if (typeof form.serviceType === 'string') {
      resolvedServiceType = form.serviceType as ScheduleServiceType;
    } else if (!form.serviceType) {
      resolvedServiceType = 'normal';
    } else {
      resolvedServiceType = form.serviceType;
    }
  } else {
    if (typeof form.serviceType === 'string') {
      resolvedServiceType = form.serviceType as ScheduleServiceType;
    } else if (!form.serviceType) {
      resolvedServiceType = 'other';
    } else {
      resolvedServiceType = form.serviceType;
    }
  }
  const statusReason = form.statusReason.trim();
  const resolvedUserLookupId = normalizeLookupId(selectedUser?.lookupId ?? undefined);
  const resolvedUserName = selectedUser?.name?.trim() || null;

  return CreateScheduleInputSchema.parse({
    title: trimmedTitle,
    category: form.category,
    userId: form.userId?.trim() || null,
    userLookupId: resolvedUserLookupId,
    userName: resolvedUserName,
    startLocal: form.startLocal,
    endLocal: form.endLocal,
    serviceType: resolvedServiceType,
    locationName: form.locationName?.trim() || null,
    notes: form.notes?.trim() || null,
    assignedStaffId: normalizeLookupId(form.assignedStaffId),
    vehicleId: normalizeLookupId(form.vehicleId),
    status: form.status,
    statusReason: statusReason ? statusReason : null,
  });
}
