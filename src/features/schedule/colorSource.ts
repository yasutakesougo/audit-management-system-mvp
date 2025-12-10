import type { Schedule } from '@/features/schedule/types';
import { isOrg, isStaff, isUserCare } from '@/features/schedule/types';
import type { ScheduleColorSource } from '@/features/schedule/serviceColors';

export function buildScheduleColorSource(event: Schedule): ScheduleColorSource {
  const base: ScheduleColorSource = {
    category: event.category,
    notes: event.notes,
    title: event.title,
  };

  if (isUserCare(event)) {
    return {
      ...base,
      serviceType: event.serviceType,
      personType: event.personType,
    };
  }

  if (isStaff(event) || isOrg(event)) {
    return {
      ...base,
      serviceType: event.subType,
    };
  }

  return base;
}

export function getScheduleServiceLabel(event: Schedule): string | undefined {
  if (isUserCare(event)) {
    return event.serviceType;
  }
  if (isStaff(event) || isOrg(event)) {
    return event.subType;
  }
  return undefined;
}
