import { useMemo } from 'react';
import { useUsers } from '@/stores/useUsers';
import { useQuery } from '@tanstack/react-query';
import { useDailyRecordRepository } from '@/features/daily/repositoryFactory';
import { buildDailyRecordExceptions } from '@/features/exceptions/domain/buildDailyRecordExceptions';
import { useDailySupportUserFilter } from '@/features/daily/hooks/useDailySupportUserFilter';
import { useSP } from '@/lib/spClient';
import { NURSE_LISTS } from '@/features/nurse/sp/constants';
import type { ObservationListItem } from '@/features/nurse/sp/map';
import { toLocalDateISO } from '@/utils/getNow';
import type { ActionCenterItem } from '../domain/actionCenterTypes';
import { mapExceptionToActionCenterItem } from '../domain/actionCenterMapper';
import { SEVERITY_ORDER, type ExceptionItem, type DailyRecordSummary, detectMissingVitals } from '@/features/exceptions/domain/exceptionLogic';
import type { ActionCenterKind } from '../domain/actionCenterTypes';
import { useTransportStatus } from '../transport/useTransportStatus';

/**
 * 業務カテゴリごとの重要度重み付け
 */
const KIND_ORDER: Record<ActionCenterKind, number> = {
  daily: 0,
  vital: 1,
  transport: 2,
  handoff: 3,
};

/**
 * useTodayActions
 * 
 * Today Hub の「Action Center」に表示する未完了タスクを集約して返す。
 * 現在は「日次記録の未入力」のみを対象とする。
 * 
 * @param targetDateStr YYYY-MM-DD 形式の日付（デフォルトは今日）
 */
export function useTodayActions(targetDateStr: string = toLocalDateISO()) {
  const { data: allUsers = [], isLoading: usersLoading } = useUsers();
  const repository = useDailyRecordRepository();
  
  // 1. 本日の対象利用者のフィルタリング（契約中など）
  const { filteredUsers: activeUsers } = useDailySupportUserFilter(allUsers);

  // 2. 本日の既存記録の取得
  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['daily-records', 'list', targetDateStr],
    queryFn: () => repository.list({ range: { startDate: targetDateStr, endDate: targetDateStr } }),
    enabled: !!repository && !!targetDateStr,
  });

  // 3. 本日のバイタル（健康記録）の取得
  const sp = useSP();
  const { data: vitals = [], isLoading: vitalsLoading } = useQuery({
    queryKey: ['nurse-observations', 'list', targetDateStr],
    queryFn: async () => {
      if (!sp) return [];
      const listTitle = NURSE_LISTS.observation;
      // ObservedAt は ISO 形式 (2024-04-08T00:00:00Z) で格納されている前提
      const results = await sp.listItems<ObservationListItem>(listTitle, {
        filter: `ObservedAt ge '${targetDateStr}T00:00:00Z' and ObservedAt le '${targetDateStr}T23:59:59Z'`,
        select: ['UserLookupId', 'ObservedAt']
      });
      return results;
    },
    enabled: !!targetDateStr && !!sp,
  });

  // 4. 送迎ステータスの取得（今日のみ対象）
  const transport = useTransportStatus();
  const isToday = targetDateStr === toLocalDateISO();

  const actionItems: ActionCenterItem[] = useMemo(() => {
    if (usersLoading || recordsLoading || vitalsLoading) return [];

    const expectedUsers = activeUsers.map(u => ({ userId: u.UserID || '', userName: u.FullName || '' }));
    
    // DailyRecordItem[] を DailyRecordSummary[] に変換（フラット化）
    const existingRecords: DailyRecordSummary[] = records.flatMap(record => 
      record.userRows?.map(row => ({
        userId: row.userId,
        userName: row.userName,
        date: record.date,
        status: '完了', 
      })) || []
    );

    // 既存の例外構築ロジックを呼び出し
    const exceptions = buildDailyRecordExceptions({
      expectedUsers,
      existingRecords,
      targetDate: targetDateStr,
    });

    // Parent レコード (id が daily-missing-record-...) を探して変換
    const parent = exceptions.find(e => e.id.startsWith('daily-missing-record-'));
    
    const results: ActionCenterItem[] = [];

    if (parent) {
      // 実際の未入力数はエラースロットの利用者の重複を除いた数
      const count = exceptions.filter(e => e.parentId === parent.id).length;
      if (count > 0) {
        const action = mapExceptionToActionCenterItem(parent, count);
        if (action) results.push(action);
      }
    }

    // ─── バイタル未計測の検知 ───
    const expectedForVitals = activeUsers.map(u => ({ 
      userId: u.UserID || '', 
      userName: u.FullName || '' 
    }));
    const existingVitalsMapping = vitals.map((v: ObservationListItem) => ({ 
      userId: `I${String(v.UserLookupId).padStart(3, '0')}` // 数値ID (15) を I015 形式に復元
    }));

    const vitalExceptions = detectMissingVitals({
      expectedUsers: expectedForVitals,
      existingVitals: existingVitalsMapping,
      targetDate: targetDateStr,
    });

    if (vitalExceptions.length > 0) {
      // 集約レコードを構築
      const vitalParent: ExceptionItem = {
        id: `vital-missing-record-${targetDateStr}`,
        category: 'missing-vital',
        title: 'バイタル未計測',
        description: 'バイタル入力が済んでいない利用者がいます',
        severity: 'high',
        updatedAt: new Date().toISOString(),
        actionPath: '/nurse/observation/bulk',
        actionLabel: '一括入力へ',
      };
      
      const vitalAction = mapExceptionToActionCenterItem(vitalParent, vitalExceptions.length);
      if (vitalAction) results.push(vitalAction);
    }

    // ─── 送迎アラート（遅延）の検知 ───
    if (isToday && transport.isReady) {
      const overdueCount = transport.status.to.overdueUserIds.length + transport.status.from.overdueUserIds.length;
      if (overdueCount > 0) {
        const transportParent: ExceptionItem = {
          id: `transport-overdue-${targetDateStr}`,
          category: 'transport-alert',
          title: '送迎遅延',
          description: `予定時刻を過ぎても到着していない利用者が ${overdueCount} 名います`,
          severity: 'high',
          updatedAt: new Date().toISOString(),
          actionPath: '/daily/transport',
          actionLabel: '運行状況へ',
        };
        const transportAction = mapExceptionToActionCenterItem(transportParent, overdueCount);
        if (transportAction) results.push(transportAction);
      }
    }

    // ─── 並び順の制御 (優先度 > カテゴリ) ───
    return results.sort((a, b) => {
      // 1. 優先度 (critical > high > medium)
      const pA = SEVERITY_ORDER[a.priority as keyof typeof SEVERITY_ORDER] ?? 99;
      const pB = SEVERITY_ORDER[b.priority as keyof typeof SEVERITY_ORDER] ?? 99;
      if (pA !== pB) return pA - pB;

      // 2. カテゴリ (daily > vital > ...)
      const kA = KIND_ORDER[a.kind] ?? 99;
      const kB = KIND_ORDER[b.kind] ?? 99;
      return kA - kB;
    });
  }, [activeUsers, records, vitals, transport.status, transport.isReady, isToday, usersLoading, recordsLoading, vitalsLoading, targetDateStr]);

  return {
    actions: actionItems,
    isLoading: usersLoading || recordsLoading || vitalsLoading,
    error: null,
  };
}
