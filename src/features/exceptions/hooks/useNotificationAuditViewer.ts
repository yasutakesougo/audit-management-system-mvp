/**
 * @fileoverview 通知監査ログ Viewer のオーケストレーター Hook
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { localNotificationAuditRepository } from '../infra/notificationAuditRepository';
import { 
  filterAuditLogs, 
  calculateAuditSummary, 
  type NotificationAuditFilterState 
} from '../domain/notificationAuditViewModel';
import type { NotificationAuditLog } from '../domain/notificationAuditTypes';

export function useNotificationAuditViewer() {
  const [allLogs, setAllLogs] = useState<NotificationAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<NotificationAuditFilterState>({
    status: 'all',
    channel: 'all',
    level: 'all'
  });

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const logs = await localNotificationAuditRepository.getAll();
      setAllLogs(logs);
      setError(null);
    } catch {
      setError('ログの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => 
    filterAuditLogs(allLogs, filters), 
  [allLogs, filters]);

  const summary = useMemo(() => 
    calculateAuditSummary(filteredLogs), 
  [filteredLogs]);

  const updateFilter = useCallback((newFilters: Partial<NotificationAuditFilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ status: 'all', channel: 'all', level: 'all' });
  }, []);

  return {
    logs: filteredLogs,
    summary,
    filters,
    updateFilter,
    resetFilters,
    isLoading,
    error,
    refresh: fetchLogs
  };
}
