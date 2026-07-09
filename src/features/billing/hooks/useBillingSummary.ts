import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBillingOrders, billingOrdersQueryKey } from '../useBillingOrders';
import { useBillingOrderRepository } from './useBillingOrderRepository';
import { useUsersStore } from '@/features/users/store';
import { useStaffStore } from '@/features/staff/store';
import { useAuth } from '@/auth/useAuth';
import type { BillingPersistenceDiagnostics } from '../repository';

export interface AggregatedBillingRecord {
  ordererCode: string;
  ordererName: string;
  category: '利用者' | '職員' | 'ゲスト';
  totalCount: number;
  totalAmount: number;
  isPaid: boolean;
  orderIds: number[];
}

export interface BillingSummary {
  records: AggregatedBillingRecord[];
  availableMonths: string[];
  totalServedCount: number;
  totalServedAmount: number;
  totalPaidCount: number;
  totalUnpaidAmount: number;
  isLoading: boolean;
  isError: boolean;
  isMutating: boolean;
  isPersistenceMissing: boolean;
  isPaymentAuditMissing: boolean;
  hasLocalPaymentState: boolean;
  localPaymentStateCount: number;
  persistenceDiagnostics: BillingPersistenceDiagnostics | null;
  persistenceWarningReason?: string;
  togglePaymentStatus: (ordererCode: string) => Promise<void>;
  bulkSettle: (category: '利用者' | '職員' | 'ゲスト' | 'すべて') => Promise<void>;
  exportCsv: (category: '利用者' | '職員' | 'ゲスト' | 'すべて') => void;
}

export const isServedOrder = (served: unknown): boolean => {
  if (served === true) return true;
  if (typeof served === 'number') return served === 1;
  if (typeof served !== 'string') return false;

  const normalized = served.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'served' || normalized === '提供済み';
};

export function useBillingSummary(selectedMonth: string): BillingSummary {
  const repository = useBillingOrderRepository();
  const queryClient = useQueryClient();
  const { account } = useAuth();
  
  const { data: rawOrders = [], isLoading: ordersLoading, isError: ordersError } = useBillingOrders(repository);
  const { data: users = [], isLoading: usersLoading } = useUsersStore();
  const { data: staff = [], isLoading: staffLoading } = useStaffStore();

  const [isMutating, setIsMutating] = useState(false);
  const [isPersistenceMissing, setIsPersistenceMissing] = useState(false);
  const [persistenceDiagnostics, setPersistenceDiagnostics] = useState<BillingPersistenceDiagnostics | null>(null);

  const isLoading = ordersLoading || usersLoading || staffLoading;
  const paidByActor = useMemo(() => {
    const name = account?.name?.trim();
    if (name) return name;
    const username = account?.username?.trim();
    if (username) return username;
    return 'unknown';
  }, [account?.name, account?.username]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    rawOrders.forEach((order) => {
      const month = order.orderDate?.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(month)) {
        months.add(month);
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [rawOrders]);

  // 1. スキーマ存在チェック
  useEffect(() => {
    let active = true;
    async function checkSchema() {
      try {
        if (repository.getPersistenceDiagnostics) {
          const diagnostics = await repository.getPersistenceDiagnostics();
          if (active) {
            setPersistenceDiagnostics(diagnostics);
            setIsPersistenceMissing(
              diagnostics.status === 'missing_payment_status' ||
              diagnostics.status === 'field_resolution_error'
            );
            if (diagnostics.status !== 'resolved') {
              console.warn('[Billing] Payment persistence diagnostics:', {
                status: diagnostics.status,
                listId: diagnostics.listId,
                siteRelative: diagnostics.siteRelative,
                missingFields: diagnostics.missingFields,
                usesList3Fallback: diagnostics.usesList3Fallback,
                errorMessage: diagnostics.errorMessage,
              });
            }
          }
          return;
        }
        const isResolved = await repository.isPersistenceColumnsResolved();
        if (active) {
          setPersistenceDiagnostics(null);
          setIsPersistenceMissing(!isResolved);
        }
      } catch (e) {
        console.error('Failed to resolve SharePoint billing persistence columns', e);
        if (active) {
          setPersistenceDiagnostics({
            status: 'field_resolution_error',
            listId: 'unknown',
            missingFields: ['PaymentStatus'],
            resolvedFields: {},
            errorMessage: e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300),
            usesList3Fallback: false,
          });
          setIsPersistenceMissing(true);
        }
      }
    }
    checkSchema();
    return () => {
      active = false;
    };
  }, [repository]);

  const isPaymentAuditMissing = persistenceDiagnostics?.status === 'missing_audit_fields';

  const persistenceWarningReason = useMemo(() => {
    switch (persistenceDiagnostics?.status) {
      case 'env_fallback_list3':
        return '原因: VITE_SP_LIST_BILLING_ORDERS 未設定により List3 fallback が使われています。';
      case 'field_resolution_error':
        return '原因: SharePoint field 解決でエラーが発生しました。';
      case 'missing_payment_status':
        return '原因: PaymentStatus 列を解決できません。';
      case 'missing_audit_fields':
        return `監査情報列が不足しています: ${persistenceDiagnostics.missingFields.join(', ')}`;
      default:
        return undefined;
    }
  }, [persistenceDiagnostics]);

  // 2. LocalStorage フォールバック用の値
  // 既存端末に残った fallback 値は互換のため読み取るが、
  // SharePoint の PaymentStatus が解決できる環境では新規保存しない。
  const [fallbackPaymentStates, setFallbackPaymentStates] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('app:billing:payment_states');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const localPaymentStateCount = useMemo(
    () => Object.keys(fallbackPaymentStates).length,
    [fallbackPaymentStates]
  );
  const hasLocalPaymentState = localPaymentStateCount > 0;

  const saveFallbackState = (key: string, val: boolean) => {
    const next = { ...fallbackPaymentStates, [key]: val };
    setFallbackPaymentStates(next);
    try {
      localStorage.setItem('app:billing:payment_states', JSON.stringify(next));
    } catch {}
  };

  // 個人ごとの集計およびカテゴリ判別
  const records = useMemo((): AggregatedBillingRecord[] => {
    if (rawOrders.length === 0) return [];

    // 1. 月フィルタ & 提供済みフィルタ
    const filtered = rawOrders.filter((order) => {
      const orderMonth = order.orderDate.slice(0, 7);
      return orderMonth === selectedMonth && isServedOrder(order.served);
    });

    // 2. 個人ごとに集計
    const groups: Record<string, { 
      code: string; 
      name: string; 
      count: number; 
      amount: number;
      orderIds: number[];
      spPaidCount: number;
      totalOrdersCount: number;
    }> = {};

    filtered.forEach((order) => {
      const code = order.ordererCode || 'UNKNOWN';
      const name = order.ordererName || '不明';
      if (!groups[code]) {
        groups[code] = { 
          code, 
          name, 
          count: 0, 
          amount: 0, 
          orderIds: [],
          spPaidCount: 0,
          totalOrdersCount: 0
        };
      }
      groups[code].count += order.orderCount;
      groups[code].amount += order.orderCount * order.drinkPrice;
      groups[code].orderIds.push(order.id);
      groups[code].totalOrdersCount++;
      if (order.paymentStatus === '精算済み') {
        groups[code].spPaidCount++;
      }
    });

    // 3. カテゴリ分類と精算状況の紐付け
    return Object.values(groups).map((group): AggregatedBillingRecord => {
      let category: '利用者' | '職員' | 'ゲスト' = 'ゲスト';

      // 照合ロジック:
      const userMatch = users.find((u) => u.UserID === group.code);
      const staffMatch = staff.find((s) => s.staffId === group.code);

      if (userMatch) {
        category = '利用者';
      } else if (staffMatch) {
        category = '職員';
      } else {
        // フォールバック判定
        if (group.code.startsWith('U-') || group.code.startsWith('I')) {
          category = '利用者';
        } else if (group.code.startsWith('STF') || group.code.startsWith('S')) {
          category = '職員';
        }
      }

      // 精算判定の決定（SharePoint が正、無ければ LocalStorage フォールバック）
      let isPaid = false;
      if (!isPersistenceMissing && group.totalOrdersCount > 0) {
        isPaid = group.spPaidCount === group.totalOrdersCount;
      } else {
        const stateKey = `${selectedMonth}:${group.code}`;
        isPaid = !!fallbackPaymentStates[stateKey];
      }

      return {
        ordererCode: group.code,
        ordererName: group.name,
        category,
        totalCount: group.count,
        totalAmount: group.amount,
        isPaid,
        orderIds: group.orderIds,
      };
    });
  }, [rawOrders, selectedMonth, users, staff, isPersistenceMissing, fallbackPaymentStates]);

  // KPI集計
  const summary = useMemo(() => {
    let totalServedCount = 0;
    let totalServedAmount = 0;
    let totalPaidCount = 0;
    let totalUnpaidAmount = 0;

    records.forEach((r) => {
      totalServedCount += r.totalCount;
      totalServedAmount += r.totalAmount;
      if (r.isPaid) {
        totalPaidCount += r.totalCount;
      } else {
        totalUnpaidAmount += r.totalAmount;
      }
    });

    return {
      totalServedCount,
      totalServedAmount,
      totalPaidCount,
      totalUnpaidAmount,
    };
  }, [records]);

  // 個別精算トグル
  const togglePaymentStatus = useCallback(async (ordererCode: string) => {
    const targetRecord = records.find(r => r.ordererCode === ordererCode);
    if (!targetRecord) return;

    const nextStatus = targetRecord.isPaid ? '未精算' : '精算済み';
    const paidAt = nextStatus === '精算済み' ? new Date().toISOString() : '';
    const paidBy = nextStatus === '精算済み' ? paidByActor : '';

    setIsMutating(true);
    try {
      if (!isPersistenceMissing) {
        await repository.bulkUpdatePaymentStatus(
          targetRecord.orderIds,
          nextStatus,
          paidAt,
          paidBy
        );
        await queryClient.invalidateQueries({ queryKey: billingOrdersQueryKey });
      } else {
        const stateKey = `${selectedMonth}:${ordererCode}`;
        saveFallbackState(stateKey, !targetRecord.isPaid);
      }
    } catch (e) {
      console.error('Failed to toggle payment status', e);
      alert('精算状態の更新に失敗しました。');
      throw e;
    } finally {
      setIsMutating(false);
    }
  }, [records, isPersistenceMissing, repository, queryClient, selectedMonth, paidByActor]);

  // 一括精算 (対象カテゴリ・対象月のみ)
  const bulkSettle = useCallback(async (targetCategory: '利用者' | '職員' | 'ゲスト' | 'すべて') => {
    const filtered = records.filter(
      (r) => targetCategory === 'すべて' || r.category === targetCategory
    );
    const unpaidRecords = filtered.filter(r => !r.isPaid);

    if (unpaidRecords.length === 0) return;

    const allUnpaidIds = unpaidRecords.reduce<number[]>((acc, r) => [...acc, ...r.orderIds], []);

    setIsMutating(true);
    try {
      if (!isPersistenceMissing) {
        const paidAt = new Date().toISOString();
        const paidBy = paidByActor;
        await repository.bulkUpdatePaymentStatus(
          allUnpaidIds,
          '精算済み',
          paidAt,
          paidBy
        );
        await queryClient.invalidateQueries({ queryKey: billingOrdersQueryKey });
      } else {
        const nextStates = { ...fallbackPaymentStates };
        unpaidRecords.forEach((r) => {
          const stateKey = `${selectedMonth}:${r.ordererCode}`;
          nextStates[stateKey] = true;
        });
        setFallbackPaymentStates(nextStates);
        try {
          localStorage.setItem('app:billing:payment_states', JSON.stringify(nextStates));
        } catch {}
      }
    } catch (e) {
      console.error('Failed bulk settle', e);
      alert('一括精算の更新に失敗しました。');
      throw e;
    } finally {
      setIsMutating(false);
    }
  }, [records, isPersistenceMissing, repository, queryClient, selectedMonth, fallbackPaymentStates, paidByActor]);

  // 日本語 Excel 対応 CSV 出力 (BOM 付き)
  const exportCsv = useCallback((targetCategory: '利用者' | '職員' | 'ゲスト' | 'すべて') => {
    const filteredRecords = records.filter(
      (r) => targetCategory === 'すべて' || r.category === targetCategory
    );

    if (filteredRecords.length === 0) {
      alert('出力するデータがありません。');
      return;
    }

    let csvContent = '\uFEFF';
    csvContent += '注文者コード,注文者氏名,区分,提供数,合計金額,精算状況\n';

    filteredRecords.forEach((r) => {
      const isPaidStr = r.isPaid ? '精算済み' : '未精算';
      const nameEscaped = r.ordererName.replace(/"/g, '""');
      csvContent += `"${r.ordererCode}","${nameEscaped}","${r.category}",${r.totalCount},${r.totalAmount},"${isPaidStr}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const catLabel = targetCategory === 'すべて' ? '全体' : targetCategory;
    link.setAttribute('download', `請求集計_${selectedMonth}_${catLabel}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [records, selectedMonth]);

  return {
    records,
    availableMonths,
    ...summary,
    isLoading,
    isError: !!ordersError,
    isMutating,
    isPersistenceMissing,
    isPaymentAuditMissing,
    hasLocalPaymentState,
    localPaymentStateCount,
    persistenceDiagnostics,
    persistenceWarningReason,
    togglePaymentStatus,
    bulkSettle,
    exportCsv,
  };
}
