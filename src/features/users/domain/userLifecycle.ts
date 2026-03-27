import type { IUserMaster, UserLifecycleStatus } from '@/sharepoint/fields';

import { USAGE_STATUS_VALUES } from '../typesExtended';

const normalize = (value?: string | null): string => (value ?? '').trim().toLowerCase();
const hasText = (value?: string | null): boolean => normalize(value).length > 0;

const TERMINATED_STATUS = normalize(USAGE_STATUS_VALUES.TERMINATED);
const SUSPENDED_STATUS = normalize(USAGE_STATUS_VALUES.SUSPENDED);

type LifecycleInput = Pick<IUserMaster, 'UsageStatus' | 'IsActive' | 'ServiceEndDate'>;

const isServiceEnded = (serviceEndDate?: string | null, referenceDate: Date = new Date()): boolean => {
  if (!hasText(serviceEndDate)) {
    return false;
  }
  const parsed = new Date(String(serviceEndDate));
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.getTime() <= referenceDate.getTime();
};

export function hasLifecycleSignals(user: LifecycleInput): boolean {
  return hasText(user.UsageStatus)
    || (user.IsActive !== undefined && user.IsActive !== null)
    || hasText(user.ServiceEndDate);
}

export function resolveUserLifecycleStatus(
  user: LifecycleInput,
): UserLifecycleStatus {
  const normalizedUsageStatus = normalize(user.UsageStatus);
  if (normalizedUsageStatus === TERMINATED_STATUS) {
    return 'terminated';
  }
  if (isServiceEnded(user.ServiceEndDate)) {
    return 'terminated';
  }
  if (normalizedUsageStatus === SUSPENDED_STATUS || user.IsActive === false) {
    return 'suspended';
  }
  if (!hasLifecycleSignals(user)) {
    return 'unknown';
  }
  return 'active';
}

export type DomainUser = IUserMaster & { lifecycleStatus: UserLifecycleStatus };

export function toDomainUser<T extends IUserMaster>(user: T): T & { lifecycleStatus: UserLifecycleStatus } {
  return {
    ...user,
    lifecycleStatus: resolveUserLifecycleStatus(user),
  };
}

export function isUserTerminated(user: LifecycleInput): boolean {
  return resolveUserLifecycleStatus(user) === 'terminated';
}

export function isUserExplicitlyActive(user: LifecycleInput): boolean {
  return hasLifecycleSignals(user) && resolveUserLifecycleStatus(user) === 'active';
}

export function filterActiveUsers<T extends LifecycleInput>(
  users: readonly T[],
): T[] {
  return users.filter((user) => isUserExplicitlyActive(user));
}

export function canEditUser(user: LifecycleInput): boolean {
  return !isUserTerminated(user);
}
