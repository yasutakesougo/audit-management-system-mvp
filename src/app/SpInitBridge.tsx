/**
 * アプリ起動時の SharePoint データ初期化ブリッジ
 *
 * MSAL Provider 内部で useSP() を呼べるコンポーネント。
 * App.tsx の <MsalProvider> 配下に配置して使用する。
 *
 * 現在の初期化タスク:
 * - Holiday_Master からの祝日読み込み
 */
import React, { useEffect, useRef } from 'react';
import { useSP } from '@/lib/spClient';
import { loadHolidaysFromSharePoint } from '@/sharepoint/holidayLoader';

/**
 * SP 初期化ブリッジ — レンダーなし、副作用のみ
 *
 * useSP() で SP クライアントを取得し、起動時に1回だけ
 * Holiday_Master リストからの祝日読み込みを実行する。
 *
 * エラー時は静的テーブルにフォールバックするため、
 * このコンポーネントがクラッシュすることはない。
 */
export const SpInitBridge: React.FC = () => {
  const sp = useSP();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Holiday_Master の読み込み（非同期、失敗しても問題なし）
    loadHolidaysFromSharePoint(sp).catch((err) => {
      console.warn('[SpInitBridge] Holiday load failed (non-fatal):', err);
    });
  }, [sp]);

  return null;
};
