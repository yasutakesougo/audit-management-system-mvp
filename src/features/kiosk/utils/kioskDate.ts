import { formatDateIso } from '@/lib/dateFormat';

/**
 * Resolves the record date for kiosk screens from search parameters.
 * Falls back to today if date query is invalid, empty, or not in YYYY-MM-DD format.
 */
export const resolveKioskRecordDate = (search: string, now = new Date()): string => {
  if (!search) {
    return formatDateIso(now);
  }

  const params = new URLSearchParams(search);
  const dateQuery = params.get('date');

  if (!dateQuery) {
    return formatDateIso(now);
  }

  // Check strict format: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateQuery)) {
    return formatDateIso(now);
  }

  const parts = dateQuery.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  const parsedDate = new Date(year, month - 1, day);

  // Validate real calendar values
  if (
    parsedDate.getFullYear() !== year ||
    (parsedDate.getMonth() + 1) !== month ||
    parsedDate.getDate() !== day
  ) {
    return formatDateIso(now);
  }

  return dateQuery;
};
