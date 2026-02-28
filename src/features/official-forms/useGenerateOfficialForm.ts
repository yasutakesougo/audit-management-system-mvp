/**
 * useGenerateOfficialForm — 月次票面バッチ生成 + SharePoint保存 Hook
 *
 * 月次プレビュー画面から「全利用者分の票面を一括保存」するための Hook。
 */
import { useCallback, useState } from 'react';

import { useSP } from '@/lib/spClient';
import { useUsersStore } from '@/features/users/store';
import { useServiceProvisionRepository } from '@/features/service-provision/repositoryFactory';
import type { KokuhorenUserProfile } from '@/features/kokuhoren-validation/types';
import type { IUserMaster } from '@/features/users/types';
import { readEnv } from '@/lib/env';
import { generateSeikatsuKaigoExcel } from './generateSeikatsuKaigoExcel';
import type { SeikatsuKaigoSheetInput } from './generateSeikatsuKaigoExcel';
import { uploadToSharePointLibrary } from './uploadToSharePoint';

/** 事業所番号: env → 将来は SP設定リスト */
const getFacilityNumber = () => readEnv('VITE_FACILITY_NUMBER', '');

export type FormGenStatus = 'idle' | 'running' | 'success' | 'error';

export interface SavedItem {
  userCode: string;
  fileName: string;
  url: string;
}

export interface FailedItem {
  userCode: string;
  error: string;
}

export interface BatchResult {
  saved: SavedItem[];
  failed: FailedItem[];
}

export interface UseGenerateOfficialFormReturn {
  status: FormGenStatus;
  run: (opts: { monthISO: string }) => Promise<BatchResult>;
  lastResult: BatchResult | null;
}

function toProfile(u: IUserMaster): KokuhorenUserProfile {
  const userCode = (u.UserID ?? '').trim() || String(u.Id ?? '');
  return {
    userCode,
    userName: (u.FullName ?? '').trim() || `利用者 ${userCode}`,
    recipientCertNumber: u.RecipientCertNumber ?? null,
  };
}

export function useGenerateOfficialForm(): UseGenerateOfficialFormReturn {
  const sp = useSP();
  const repo = useServiceProvisionRepository();
  const { data: users } = useUsersStore();

  const [status, setStatus] = useState<FormGenStatus>('idle');
  const [lastResult, setLastResult] = useState<BatchResult | null>(null);

  const run = useCallback(async (opts: { monthISO: string }): Promise<BatchResult> => {
    const { monthISO } = opts;
    setStatus('running');

    const saved: SavedItem[] = [];
    const failed: FailedItem[] = [];

    try {
      // 1) 月内レコード全件取得
      const allRecords = await repo.listByMonth(monthISO);

      // 2) レコードがあるユーザーコードを特定
      const userCodesWithRecords = new Set(allRecords.map((r) => r.userCode));

      // 3) テンプレ取得（1回だけ）
      const templateRes = await fetch('/templates/seikatsu_kaigo_template.xlsx');
      if (!templateRes.ok) throw new Error('テンプレートが見つかりません');
      const templateBuf = await templateRes.arrayBuffer();

      // 4) レコードがあるユーザーごとに生成＋保存
      for (const userCode of userCodesWithRecords) {
        try {
          const userMaster = (users ?? []).find(
            (u) => (u.UserID ?? '').trim() === userCode || String(u.Id) === userCode,
          );
          const profile = userMaster
            ? toProfile(userMaster)
            : { userCode, userName: `利用者 ${userCode}`, recipientCertNumber: null };

          const userRecords = allRecords.filter((r) => r.userCode === userCode);

          const input: SeikatsuKaigoSheetInput = {
            yearMonth: monthISO,
            facility: { facilityNumber: getFacilityNumber() },
            user: profile,
            records: userRecords,
          };

          const { fileName, bytes } = await generateSeikatsuKaigoExcel(templateBuf, input);
          const result = await uploadToSharePointLibrary(sp, fileName, bytes);

          saved.push({ userCode, fileName, url: result.fileUrl });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          failed.push({ userCode, error: msg });
          console.error(`[useGenerateOfficialForm] failed for ${userCode}`, err);
        }
      }

      const batchResult: BatchResult = { saved, failed };
      setLastResult(batchResult);
      setStatus(failed.length > 0 ? 'error' : 'success');
      return batchResult;
    } catch (err) {
      console.error('[useGenerateOfficialForm] batch failed', err);
      const batchResult: BatchResult = { saved, failed: [{ userCode: '*', error: String(err) }] };
      setLastResult(batchResult);
      setStatus('error');
      return batchResult;
    }
  }, [sp, repo, users]);

  return { status, run, lastResult };
}
