import React, { useEffect } from 'react';
import { DriftObserver } from '../application/DriftObserver';
import { useDriftEventRepository } from '../infra/driftEventRepositoryFactory';

/**
 * DriftMonitor — ドリフト監視の有効化コンポーネント
 * 
 * AppLayout または AdminLayout の最上位に配置することで、
 * システム全体のドリフトイベントをバックグラウンドで収集・永続化します。
 */
export const DriftMonitor: React.FC = () => {
  const repository = useDriftEventRepository();

  useEffect(() => {
    const observer = new DriftObserver(repository);
    observer.start();

    return () => {
      observer.stop();
    };
  }, [repository]);

  // UI は持たない（ロジックのみ）
  return null;
};
