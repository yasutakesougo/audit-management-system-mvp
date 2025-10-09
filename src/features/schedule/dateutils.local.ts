import { formatInTimeZone } from '@/lib/tz';

const TIME_ZONE = 'Asia/Tokyo';

export function getLocalDateKey(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return formatInTimeZone(date, TIME_ZONE, 'yyyy-MM-dd');
}

export function startOfDay(input: Date | string): Date {
  const date = typeof input === 'string' ? new Date(input) : new Date(input.getTime());
  if (Number.isNaN(date.getTime())) {
    return new Date(0);
  }
  const key = getLocalDateKey(date);
  if (!key) {
    return new Date(0);
  }
  return new Date(`${key}T00:00:00`);
}

export function assignLocalDateKey<T extends {
  start?: string | null;
  end?: string | null;
  startLocal?: string | null;
  endLocal?: string | null;
}>(item: T): T & {
  localDateKey: string;
} {
  const candidate = item.startLocal ?? item.start ?? item.endLocal ?? item.end ?? '';
  const key = candidate ? getLocalDateKey(candidate) : '';
  return {
    ...item,
    localDateKey: key,
  };
}
