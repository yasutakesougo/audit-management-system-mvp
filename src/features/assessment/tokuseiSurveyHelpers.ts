/**
 * tokuseiSurveyHelpers.ts — Pure helper functions for TokuseiSurveyResultsPage.
 *
 * No side effects. All functions are independently testable.
 * Extracted from TokuseiSurveyResultsPage.tsx.
 */
import type { TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import { formatDateTimeIntl } from '@/lib/dateFormat';

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format an ISO date-time string to a localized Japanese date-time string.
 * Returns '未入力' for empty values and the raw value for unparseable dates.
 */
export const formatDateTime = (value: string): string =>
  formatDateTimeIntl(value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }, value || '未入力');

// ---------------------------------------------------------------------------
// User options
// ---------------------------------------------------------------------------

/**
 * Extract unique, sorted target user names from a list of responses.
 * Used to populate the user filter dropdown.
 */
export const buildUserOptions = (responses: TokuseiSurveyResponse[]): string[] => {
  const names = new Set<string>();
  responses.forEach((response) => {
    if (response.targetUserName) {
      names.add(response.targetUserName);
    }
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'ja'));
};

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

export type ResponseFilterParams = {
  selectedUser: string;
  searchQuery: string;
  fromDate: string;
  toDate: string;
};

/**
 * Filter and date-range-restrict a sorted list of responses.
 * Pure function — no mutation of the original array.
 */
export const applyResponseFilters = (
  responses: TokuseiSurveyResponse[],
  filters: ResponseFilterParams,
): TokuseiSurveyResponse[] => {
  const { selectedUser, searchQuery, fromDate, toDate } = filters;
  const lower = searchQuery.trim().toLowerCase();

  return responses.filter((response) => {
    if (selectedUser !== 'all' && response.targetUserName !== selectedUser) return false;
    if (lower) {
      const haystack = [response.targetUserName, response.responderName, response.guardianName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(lower)) return false;
    }
    if (fromDate) {
      const t = new Date(response.fillDate).getTime();
      const from = new Date(fromDate).setHours(0, 0, 0, 0);
      if (Number.isFinite(t) && t < from) return false;
    }
    if (toDate) {
      const t = new Date(response.fillDate).getTime();
      const to = new Date(toDate).setHours(23, 59, 59, 999);
      if (Number.isFinite(t) && t > to) return false;
    }
    return true;
  });
};
