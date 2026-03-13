/**
 * useIsokatsuPreviewData — いそかつ書式プレビュー用データ取得 Hook
 *
 * 選択ユーザーの月次実績データ + マスタ情報を集約し、
 * IsokatsuSheetPreview に渡す props を構築する。
 *
 * - ユーザー未選択時は null を返す
 * - 月次レコードは selectedUser.id で filter
 * - マスタ情報は useUsersStore から取得
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useUsersStore } from '@/features/users/store';

import type { IsokatsuSheetPreviewProps } from './components/IsokatsuSheetPreview';
import type { ServiceProvisionRecord } from './domain/types';
import { useServiceProvisionRepository } from './repositoryFactory';

export interface UseIsokatsuPreviewDataParams {
  /** 対象の yearMonth (YYYY-MM) */
  yearMonth: string;
  /** 選択中の利用者コード (UserID) */
  selectedUserCode: string | null;
  /** 選択中の利用者名 */
  selectedUserName: string | null;
}

export interface UseIsokatsuPreviewDataReturn {
  /** プレビュー用 props。ユーザー未選択時は null */
  previewProps: Omit<IsokatsuSheetPreviewProps, 'facilityNumber' | 'facilityName'> | null;
  /** ローディング状態 */
  loading: boolean;
}

export function useIsokatsuPreviewData({
  yearMonth,
  selectedUserCode,
  selectedUserName,
}: UseIsokatsuPreviewDataParams): UseIsokatsuPreviewDataReturn {
  const repository = useServiceProvisionRepository();
  const { data: users } = useUsersStore();

  const [monthRecords, setMonthRecords] = useState<ServiceProvisionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(false);

  // ── 月次レコード取得 ─────────────────────────
  const fetchMonth = useCallback(async () => {
    if (!yearMonth || !selectedUserCode) {
      setMonthRecords([]);
      return;
    }
    setLoading(true);
    abortRef.current = false;
    try {
      const all = await repository.listByMonth(yearMonth);
      if (!abortRef.current) {
        // 対象ユーザーのレコードだけ抽出
        const filtered = all.filter((r) => r.userCode === selectedUserCode);
        setMonthRecords(filtered);
      }
    } catch (err) {
      if (!abortRef.current) {
        console.error('[useIsokatsuPreviewData] fetch failed', err);
        setMonthRecords([]);
      }
    } finally {
      if (!abortRef.current) {
        setLoading(false);
      }
    }
  }, [repository, yearMonth, selectedUserCode]);

  useEffect(() => {
    fetchMonth();
    return () => {
      abortRef.current = true;
    };
  }, [fetchMonth]);

  // ── マスタ情報解決 ─────────────────────────────
  const userMaster = useMemo(() => {
    if (!selectedUserCode || !Array.isArray(users)) return null;
    return users.find((u) => (u.UserID ?? '').trim() === selectedUserCode) ?? null;
  }, [users, selectedUserCode]);

  // ── プレビュー Props 構築 ──────────────────────
  const previewProps = useMemo(() => {
    if (!selectedUserCode || !selectedUserName) return null;

    const grantedDays = userMaster?.GrantedDaysPerMonth;
    const contractDays = grantedDays
      ? parseInt(String(grantedDays), 10) || undefined
      : undefined;

    return {
      yearMonth,
      userName: selectedUserName,
      recipientCertNumber: (userMaster?.RecipientCertNumber ?? '') || undefined,
      supportGrade: parseDisabilityLevel(userMaster?.DisabilitySupportLevel),
      contractDays,
      records: monthRecords,
    };
  }, [yearMonth, selectedUserCode, selectedUserName, userMaster, monthRecords]);

  return { previewProps, loading };
}

// ── ヘルパー ──────────────────────────────────────
/** 障害支援区分文字列から数値を抽出。「区分5」→ 5 */
function parseDisabilityLevel(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const match = raw.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}
