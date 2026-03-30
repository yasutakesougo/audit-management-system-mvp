/**
 * DataLayerStatusBanner
 * 
 * データプロバイダーの解決状況を監視し、
 * 必須リストの欠損やフォールバックの発生をユーザー（主に運用者/開発者）に通知します。
 */
import React from 'react';
import { useDataProviderObservabilityStore } from '@/lib/data/dataProviderObservabilityStore';

export const DataLayerStatusBanner: React.FC = () => {
  const { resolutions, currentProvider } = useDataProviderObservabilityStore();
  
  const resList = Object.values(resolutions);
  const criticals = resList.filter(r => r.status === 'missing_required');
  const fallbacks = resList.filter(r => r.status === 'fallback_triggered');
  const mismatches = resList.filter(r => r.status === 'schema_mismatch');

  // InMemory/Local プロバイダーでは空リストが正常なため、フィールド欠損は誤検知となる
  if (currentProvider !== 'sharepoint') return null;

  if (criticals.length === 0 && fallbacks.length === 0 && mismatches.length === 0) {
    return null;
  }

  return (
    <div style={{
      background: criticals.length > 0 ? '#fff1f0' : '#fffbe6',
      borderBottom: `1px solid ${criticals.length > 0 ? '#ffa39e' : '#ffe58f'}`,
      padding: '4px 12px',
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 1000,
      position: 'relative'
    }}>
      <span style={{ fontWeight: 700 }}>
        {criticals.length > 0 ? '❌ データ接続エラー' : '⚠️ データ警告'}
      </span>
      
      <div style={{ flex: 1, display: 'flex', gap: '8px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {criticals.map(r => (
          <span key={r.resourceName} style={{ color: '#cf1322' }}>
            {r.resourceName}不達
          </span>
        ))}
        {fallbacks.map(r => (
          <span key={r.resourceName} style={{ color: '#d48806' }}>
            {r.resourceName}代替使用中
          </span>
        ))}
        {mismatches.map(r => (
          <span key={r.resourceName} style={{ color: '#d48806' }}>
            {r.resourceName}列不足
          </span>
        ))}
      </div>

      <div style={{ color: '#888', fontSize: '10px' }}>
        Provider: {currentProvider}
      </div>
      
      <button 
        onClick={() => window.location.reload()}
        style={{ 
          border: '1px solid #d9d9d9', 
          background: '#fff', 
          borderRadius: '2px', 
          padding: '0 8px',
          cursor: 'pointer',
          fontSize: '11px'
        }}
      >
        再読込
      </button>
    </div>
  );
};
