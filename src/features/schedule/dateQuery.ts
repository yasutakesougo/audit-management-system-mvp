import { startOfDay } from 'date-fns';

const DATE_DASH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_COMPACT_PATTERN = /^\d{8}$/;

const toYyyyMmDd = (value: Date): string => {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const normalizeToDayStart = (input: string | null | undefined): Date => {
  if (!input) {
    return startOfDay(new Date());
  }

  const value = input.trim();
  if (!value) {
    return startOfDay(new Date());
  }

  if (DATE_DASH_PATTERN.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return startOfDay(parsed);
    }
  }

  if (DATE_COMPACT_PATTERN.test(value)) {
    const yyyy = Number(value.slice(0, 4));
    const mm = Number(value.slice(4, 6)) - 1;
    const dd = Number(value.slice(6, 8));
    const parsed = new Date(yyyy, mm, dd);
    if (!Number.isNaN(parsed.getTime())) {
      return startOfDay(parsed);
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return startOfDay(parsed);
  }

  return startOfDay(new Date());
};

export const pickDateParam = (searchParams: URLSearchParams): string | null => {
  const fromDate = searchParams.get('date');
  if (fromDate) {
    return fromDate;
  }

  const fromDay = searchParams.get('day');
  if (fromDay) {
    return fromDay;
  }

  const fromWeek = searchParams.get('week');
  if (fromWeek) {
    return fromWeek;
  }

  return null;
};

export const ensureDateParam = (
  searchParams: URLSearchParams,
  date: Date,
): URLSearchParams => {
  const next = new URLSearchParams(searchParams);
  next.set('date', toYyyyMmDd(date));
  next.delete('day');
  next.delete('week');
  return next;
};
