import type { ObservationVitalsPayload } from '@/features/nurse/state/offlineQueue';

export type ObservationItemInput = {
  userLookupId: number;
  atISO: string;
  vitals: ObservationVitalsPayload;
  memo?: string;
  tags?: string[];
  idempotencyKey: string;
  source: string;
  localTz?: string;
  createdBy?: string;
  deviceId?: string;
};

export type ObservationListItem = {
  UserLookupId: number;
  ObservedAt: string;
  Temperature?: number | null;
  Pulse?: number | null;
  Systolic?: number | null;
  Diastolic?: number | null;
  SpO2?: number | null;
  Weight?: number | null;
  Memo?: string | null;
  Tags?: string | null;
  IdempotencyKey: string;
  Source?: string | null;
  LocalTimeZone?: string | null;
  CreatedBy?: string | null;
  DeviceId?: string | null;
  VitalsJson?: string | null;
};

const toNullable = (value: unknown): number | null => {
  if (typeof value !== 'number') return null;
  return Number.isFinite(value) ? value : null;
};

const joinTags = (tags?: string[]) => (tags && tags.length > 0 ? tags.join(',') : null);

export const toObservationItem = (input: ObservationItemInput): ObservationListItem => {
  const { vitals } = input;
  const payload: ObservationListItem = {
    UserLookupId: input.userLookupId,
    ObservedAt: input.atISO,
    Temperature: toNullable(vitals.temp),
    Pulse: toNullable(vitals.pulse),
    Systolic: toNullable(vitals.sys),
    Diastolic: toNullable(vitals.dia),
    SpO2: toNullable(vitals.spo2),
    Weight: toNullable(vitals.weight),
    Memo: input.memo?.trim() ? input.memo : null,
    Tags: joinTags(input.tags),
    IdempotencyKey: input.idempotencyKey,
    Source: input.source,
    LocalTimeZone: input.localTz ?? null,
    CreatedBy: input.createdBy ?? null,
    DeviceId: input.deviceId ?? null,
    VitalsJson: JSON.stringify(vitals ?? {}),
  };
  return payload;
};
