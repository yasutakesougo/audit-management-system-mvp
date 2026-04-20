import React, { useEffect } from 'react';
import { RemediationAuditObserver } from './RemediationAuditObserver';
import { useRemediationAuditRepository } from './remediationAuditRepositoryFactory';

/**
 * RemediationAuditMonitor — 修復監査の有効化コンポーネント
 *
 * DriftMonitor と同じパターン:
 * - App レイアウトの最上位に配置
 * - Repository 取得後に Observer を開始
 * - SP リストが未構築の環境では InMemory にフォールバック
 * - UI は持たない（ロジックのみ）
 */
export const RemediationAuditMonitor: React.FC = () => {
  const repository = useRemediationAuditRepository();

  useEffect(() => {
    const observer = new RemediationAuditObserver(repository);
    observer.start();

    return () => {
      observer.stop();
    };
  }, [repository]);

  return null;
};
