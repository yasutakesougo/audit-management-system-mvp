/**
 * useCallLogs — CallLog 機能の Application Hook
 *
 * 責務:
 * - ログ一覧の取得 (React Query / useQuery)
 * - ログ作成 (useMutation)
 * - 対応状況更新 (useMutation)
 * - "all" タブ値 → repository の status フィルタ変換
 *
 * 規約:
 * - UI 層は repository を直接呼ばない。このフック経由のみ。
 * - "all" は UI-only の値。repository には流さない。
 */

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import type { CallLogStatus, CreateCallLogInput } from '@/domain/callLogs/schema';
import { useCallLogRepository } from '../data/callLogRepositoryFactory';

// ─── タブ値型 ─────────────────────────────────────────────────────────────────

/**
 * UI のタブ選択値。"all" は UI-only で domain の CallLogStatus には存在しない。
 */
export type CallLogTabValue = CallLogStatus | 'all';

// ─── Query Key Factory ─────────────────────────────────────────────────────────

const QK = {
  list: (status?: CallLogStatus, targetStaffName?: string) =>
    ['callLogs', status ?? 'ALL', targetStaffName ?? ''] as const,
};

// ─── Options ─────────────────────────────────────────────────────────────────

export type UseCallLogsOptions = {
  /** タブ値。"all" のときは status フィルタを掛けない。 */
  activeTab?: CallLogTabValue;
  /** 担当者名でフィルタ（省略時は全担当者） */
  targetStaffName?: string;
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useCallLogs = (options: UseCallLogsOptions = {}) => {
  const { account } = useAuth();
  const qc = useQueryClient();

  const repository = useCallLogRepository();

  // "all" → undefined の変換はここだけで行う
  const statusFilter: CallLogStatus | undefined =
    options.activeTab === 'all' || options.activeTab === undefined
      ? undefined
      : options.activeTab;

  const queryKey = QK.list(statusFilter, options.targetStaffName);

  // ── 一覧取得 ──────────────────────────────────────────────────────────────

  const query = useQuery({
    queryKey,
    queryFn: () =>
      repository.list({
        status: statusFilter,
        targetStaffName: options.targetStaffName,
      }),
    staleTime: 10_000,
  });

  // ── 新規作成 ──────────────────────────────────────────────────────────────

  /**
   * ログインユーザーの表示名を receivedByName として注入する。
   * MSAL account.name が使える場合はそれを優先。
   */
  const receivedByName: string =
    (account as { name?: string } | null)?.name ?? '(未取得)';

  const createLog = useMutation({
    mutationFn: (input: CreateCallLogInput) =>
      repository.create(input, receivedByName),
    onSuccess: async () => {
      // すべてのタブのキャッシュを無効化（"all" も含む）
      await qc.invalidateQueries({ queryKey: ['callLogs'] });
    },
  });

  // ── 状態更新 ──────────────────────────────────────────────────────────────

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CallLogStatus }) =>
      repository.updateStatus(id, status),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['callLogs'] });
    },
  });

  // ── 手動再取得 ────────────────────────────────────────────────────────────

  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey }),
    [qc, queryKey],
  );

  return {
    /** 取得済みログ一覧（未取得時は undefined） */
    logs: query.data,
    isLoading: query.isLoading,
    error: query.error,
    /** 新規ログ作成 mutation */
    createLog,
    /** 対応状況更新 mutation */
    updateStatus,
    /** 手動でデータを再取得する */
    refresh,
  };
};
