import { addHours, format } from 'date-fns';

import type { CreateScheduleEventInput, ScheduleCategory, ScheduleServiceType, ScheduleStatus } from '../data';

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

// ===== Types =====

export interface ScheduleUserOption {
  id: string;
  name: string;
  lookupId?: string;
}

export interface ScheduleFormState {
  title: string;
  category: ScheduleCategory;
  userId: string;
  startLocal: string;
  endLocal: string;
  serviceType?: ScheduleServiceType | string | null;
  locationName: string;
  notes: string;
  assignedStaffId: string;
  vehicleId: string;
  status: ScheduleStatus;
  statusReason: string;
}

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
    };
  }

  return initial;
}

export interface ScheduleFormValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateScheduleForm(form: ScheduleFormState): ScheduleFormValidationResult {
  const errors: string[] = [];

  if (!form.title.trim()) {
    errors.push('予定タイトルを入力してください');
  }

  if (!form.startLocal) {
    errors.push('開始日時を入力してください');
  }

  if (!form.endLocal) {
    errors.push('終了日時を入力してください');
  }

  if (form.startLocal && form.endLocal) {
    const start = new Date(form.startLocal);
    const end = new Date(form.endLocal);

    if (!(start instanceof Date) || isNaN(start.getTime())) {
      errors.push('開始日時の形式が正しくありません');
    }
    if (!(end instanceof Date) || isNaN(end.getTime())) {
      errors.push('終了日時の形式が正しくありません');
    }
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) {
      errors.push('終了日時は開始日時より後にしてください');
    }
  }

  if (form.category === 'User' && !form.serviceType) {
    errors.push('サービス種別を選択してください');
  }

  return { isValid: errors.length === 0, errors };
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

  const normalizeLookupId = (value?: unknown): string | undefined => {
    if (value == null) {
      return undefined;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
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
    return undefined;
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
  const resolvedUserName = selectedUser?.name?.trim() || undefined;

  return {
    title: trimmedTitle,
    category: form.category,
    userId: form.userId?.trim() || undefined,
    userLookupId: resolvedUserLookupId,
    userName: resolvedUserName,
    startLocal: form.startLocal,
    endLocal: form.endLocal,
    serviceType: resolvedServiceType,
    locationName: form.locationName || undefined,
    notes: form.notes || undefined,
    assignedStaffId: normalizeLookupId(form.assignedStaffId),
    vehicleId: normalizeLookupId(form.vehicleId),
    status: form.status,
    statusReason: statusReason ? statusReason : null,
  };
}
