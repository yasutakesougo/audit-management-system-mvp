'use client';

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readAudit } from '../../lib/audit';

interface UnsynedAuditBadgeProps {
  /** バッジのスタイルをカスタマイズ */
  className?: string;
  /** バッジに適用する追加のCSSスタイル */
  style?: React.CSSProperties;
  /** 小さいサイズのバッジを表示 */
  size?: 'small' | 'medium';
}

/**
 * 未同期の監査ログ数を表示するクリック可能なバッジコンポーネント
 *
 * - クリックで /audit ページに遷移（既に audit ページの場合はテーブルにスクロール）
 * - 未同期ログがない場合は非表示
 * - Note: Router コンテキスト必須のため、Router 内で使用してください
 */
const UnsynedAuditBadge: React.FC<UnsynedAuditBadgeProps> = ({
  className = '',
  style = {},
  size = 'medium'
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const logs = readAudit();

  // 未同期ログがない場合は何も表示しない
  if (logs.length === 0) {
    return null;
  }

  const isSmall = size === 'small';
  const baseStyle: React.CSSProperties = {
    padding: isSmall ? '1px 6px' : '2px 8px',
    borderRadius: 12,
    background: '#ff9800',
    color: '#fff',
    fontSize: isSmall ? 10 : 12,
    cursor: 'pointer',
    textDecoration: 'none',
    border: 'none',
    display: 'inline-block',
    minHeight: isSmall ? 16 : 20,
    lineHeight: isSmall ? '14px' : '16px',
    ...style,
  };

  const handleClick = () => {
    if (location.pathname !== '/audit') {
      // 他のページから監査ページに遷移
      navigate('/audit');
    } else {
      // 既に監査ページにいる場合はテーブルにスクロール
      const table = document.querySelector('table');
      if (table) {
        table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <span
      className={className}
      style={baseStyle}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={`未同期の監査ログ ${logs.length}件 - クリックして詳細を表示`}
      aria-label={`未同期の監査ログ ${logs.length}件。クリックして監査ログページに移動します。`}
    >
      未同期: {logs.length}件
    </span>
  );
};

export default UnsynedAuditBadge;