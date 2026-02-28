/**
 * useKokuhorenMonthlyPreview — 月次プレビュー Hook
 *
 * 月内の ServiceProvisionRecords を取得し、
 * validateMonthly() で検証結果を返す。
 *
 * kokuhoren-validation は純粋関数の塊として維持し、
 * 副作用を伴うfetch+validate hookはこちらに分離。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useUsersStore } from '@/features/users/store';
import type { IUserMaster } from '@/features/users/types';
import { useServiceProvisionRepository } from '@/features/service-provision/repositoryFactory';
import { validateMonthly } from '@/features/kokuhoren-validation/validateMonthly';
import type {
  KokuhorenUserProfile,
  MonthlyProvisionInput,
  DailyProvisionEntry,
  ValidationResult,
} from '@/features/kokuhoren-validation/types';

export interface UseKokuhorenMonthlyPreviewReturn {
  result: ValidationResult | null;
  /** validateに渡した入力（CSV生成に再利用） */
  lastInput: MonthlyProvisionInput | null;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
}

/**
 * IUserMaster → KokuhorenUserProfile 変換
 */
function toKokuhorenProfile(user: IUserMaster): KokuhorenUserProfile {
  const userCode = (user.UserID ?? '').trim() || String(user.Id ?? '');
  return {
    userCode,
    userName: (user.FullName ?? '').trim() || `利用者 ${userCode}`,
    recipientCertNumber: user.RecipientCertNumber ?? null,
  };
}

export function useKokuhorenMonthlyPreview(
  monthISO: string, // "2026-02"
): UseKokuhorenMonthlyPreviewReturn {
  const repository = useServiceProvisionRepository();
  const { data: users } = useUsersStore();

  const [result, setResult] = useState<ValidationResult | null>(null);
  const [lastInput, setLastInput] = useState<MonthlyProvisionInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // 連打リフレッシュ対策 — requestId で古いレスポンスを無視
  const reqIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!monthISO) return;

    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    try {
      // 1) 月内データ一括取得
      const records = await repository.listByMonth(monthISO);

      // 2) レコード → DailyProvisionEntry 変換
      const entries: DailyProvisionEntry[] = records.map((r) => ({
        userCode: r.userCode,
        recordDateISO: r.recordDateISO,
        status: r.status,
        startHHMM: r.startHHMM,
        endHHMM: r.endHHMM,
        hasTransport: r.hasTransport,
        hasTransportPickup: r.hasTransportPickup,
        hasTransportDropoff: r.hasTransportDropoff,
        hasMeal: r.hasMeal,
        hasBath: r.hasBath,
        hasExtended: r.hasExtended,
        hasAbsentSupport: r.hasAbsentSupport,
      }));

      // 3) ユーザーマスタ → KokuhorenUserProfile
      const profiles: KokuhorenUserProfile[] = Array.isArray(users)
        ? users.map(toKokuhorenProfile)
        : [];

      // 4) validateMonthly 実行
      const input: MonthlyProvisionInput = {
        yearMonth: monthISO,
        users: profiles,
        records: entries,
      };

      const validationResult = validateMonthly(input);

      if (reqId === reqIdRef.current) {
        setResult(validationResult);
        setLastInput(input);
      }
    } catch (err) {
      if (reqId === reqIdRef.current) {
        console.error('[useKokuhorenMonthlyPreview] failed', err);
        setError(err);
      }
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
      }
    }
  }, [repository, monthISO, users]);

  useEffect(() => {
    refresh();
    // cleanup: bump reqId so in-flight responses are ignored
    return () => {
      reqIdRef.current++;
    };
  }, [refresh]);

  return { result, lastInput, loading, error, refresh };
}
