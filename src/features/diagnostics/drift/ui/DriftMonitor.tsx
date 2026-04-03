import React, { useEffect } from 'react';
import { DriftObserver } from '../application/DriftObserver';
import { SharePointDriftEventRepository } from '../infra/SharePointDriftEventRepository';
import { useSP } from '@/lib/spClient';

/**
 * DriftMonitor — ドリフト監視の有効化コンポーネント
 * 
 * AppLayout または AdminLayout の最上位に配置することで、
 * システム全体のドリフトイベントをバックグラウンドで収集・永続化します。
 */
export const DriftMonitor: React.FC = () => {
  const sp = useSP();

  useEffect(() => {
    if (!sp) return;

    const repository = new SharePointDriftEventRepository(sp);
    const observer = new DriftObserver(repository);

    observer.start();

    return () => {
      observer.stop();
    };
  }, [sp]);

  // UI は持たない（ロジックのみ）
  return null;
};
