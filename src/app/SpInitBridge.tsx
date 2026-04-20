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
import { SharePointProvisioningCoordinator } from '@/sharepoint/spProvisioningCoordinator';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { useToast } from '@/hooks/useToast';
import { useAuthReady } from '@/auth/useAuthReady';
import { useNightlySignalIngestion } from '@/features/sp/health/hooks/useNightlySignalIngestion';

/**
 * SP 初期化ブリッジ — レンダーなし、副作用のみ
 *
 * useSP() で SP クライアントを取得し、起動時に1回だけ
 * 以下の初期化タスクを実行する。
 * 1. SharePoint リストのプロビジョニング・安定性確認 (Coordinator)
 * 2. 祝日の読み込み (Holiday_Master)
 */
// 🛑 Module-level global guard to survive re-mounts (React 18 StrictMode or parent re-renders)
let globalAdminWarningShown = false;

export const SpInitBridge: React.FC = () => {
  const bootstrapStartedRef = useRef(false);
  const sp = useSP();
  const { type: providerType } = useDataProvider(); // 🚀 Data OS Readiness: Trigger initial singleton creation
  const isAuthReady = useAuthReady();
  const { role } = useUserAuthz();
  const { show } = useToast();
  
  // 🩺 Nightly Patrol 結果の自動インジェクション
  useNightlySignalIngestion();

  useEffect(() => {
    if (bootstrapStartedRef.current || !isAuthReady) return;
    bootstrapStartedRef.current = true;

    const bootstrap = async () => {
      // 1. SharePoint リストの一括プロビジョニング・検証（SharePoint モードのみ）
      // Demo/Smoke モード（VITE_SKIP_SHAREPOINT=1）ではプロビジョニングをスキップして 404 を回避する
      const { shouldSkipSharePoint } = await import('@/lib/env');
      if (providerType !== 'sharepoint' || shouldSkipSharePoint()) return;
      
      try {
        const result = await SharePointProvisioningCoordinator.bootstrap(sp);

        // 管理者の場合のみ、不具合のあるリストを通知（一度だけ表示）
        if (role === 'admin' && result.unhealthy > 0 && !globalAdminWarningShown) {
          globalAdminWarningShown = true;
          const message = `SharePoint Schema Warning: ${result.unhealthy} lists may need attention. Check logs for details.`;
          show('warning', message);
        }
      } catch (err) {
        console.error('[SpInitBridge] Provisioning bootstrap critical failure:', err);
      }

      // 2. Holiday_Master の読み込み（非同期、失敗しても問題なし）
      await loadHolidaysFromSharePoint(sp).catch((err) => {
        console.warn('[SpInitBridge] Holiday load failed (non-fatal):', err);
      });
    };

    bootstrap();
  }, [sp, role, show, providerType, isAuthReady]);

  return null;
};
