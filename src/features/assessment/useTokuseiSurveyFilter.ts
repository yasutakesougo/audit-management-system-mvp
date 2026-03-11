/**
 * useTokuseiSurveyFilter.ts — Filter + selection state hook for TokuseiSurveyResultsPage.
 *
 * Encapsulates all useState / useMemo / useEffect related to filtering and
 * response selection that previously lived inline in TokuseiSurveyResultsPage.tsx.
 */
import { summarizeTokuseiResponses, type TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import { useEffect, useMemo, useState } from 'react';
import { applyResponseFilters, buildUserOptions } from './tokuseiSurveyHelpers';

export type FilterState = {
  selectedUser: string;
  searchQuery: string;
  fromDate: string;
  toDate: string;
};

export const useTokuseiSurveyFilter = (data: TokuseiSurveyResponse[]) => {
  // ── Sort ──
  const sortedData = useMemo(
    () =>
      [...data].sort((a, b) => {
        const aTime = a.fillDate ? new Date(a.fillDate).getTime() : 0;
        const bTime = b.fillDate ? new Date(b.fillDate).getTime() : 0;
        return bTime - aTime;
      }),
    [data],
  );

  // ── Filter state ──
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const userOptions = useMemo(() => buildUserOptions(sortedData), [sortedData]);

  // Reset selectedUser if it disappears from options after data refresh
  useEffect(() => {
    if (selectedUser === 'all') return;
    if (!userOptions.includes(selectedUser)) {
      setSelectedUser('all');
    }
  }, [selectedUser, userOptions]);

  const filteredResponses = useMemo(
    () => applyResponseFilters(sortedData, { selectedUser, searchQuery, fromDate, toDate }),
    [sortedData, selectedUser, searchQuery, fromDate, toDate],
  );

  // ── Active selection state ──
  const [activeResponseId, setActiveResponseId] = useState<number | null>(null);

  // Keep activeResponseId pointing to a visible response
  useEffect(() => {
    if (!filteredResponses.length) {
      setActiveResponseId(null);
      return;
    }
    if (activeResponseId && filteredResponses.some((r) => r.id === activeResponseId)) {
      return;
    }
    setActiveResponseId(filteredResponses[0].id);
  }, [filteredResponses, activeResponseId]);

  const activeResponse = useMemo(
    () => filteredResponses.find((r) => r.id === activeResponseId) ?? null,
    [filteredResponses, activeResponseId],
  );

  // ── Summary ──
  const summary = useMemo(() => summarizeTokuseiResponses(sortedData), [sortedData]);

  // ── Convenience flags ──
  const resetFilters = () => {
    setSelectedUser('all');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
  };

  const hasActiveFilters = selectedUser !== 'all' || Boolean(searchQuery) || Boolean(fromDate) || Boolean(toDate);

  return {
    // data
    filteredResponses,
    activeResponse,
    activeResponseId,
    setActiveResponseId,
    summary,
    userOptions,
    // filter state
    selectedUser,
    setSelectedUser,
    searchQuery,
    setSearchQuery,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    // filter actions
    resetFilters,
    hasActiveFilters,
  };
};
