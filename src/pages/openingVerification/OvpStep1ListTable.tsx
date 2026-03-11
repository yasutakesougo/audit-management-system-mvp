import type { HealthCheckSummary, ListCheckResult } from '@/sharepoint/spListHealthCheck';
import React from 'react';
import { sectionStyle, statusIcon, tdStyle, thStyle } from './constants';

type OvpStep1ListTableProps = {
  healthResult: HealthCheckSummary;
};

export const OvpStep1ListTable: React.FC<OvpStep1ListTableProps> = ({ healthResult }) => (
  <div style={sectionStyle}>
    <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
      📋 Step1: リスト存在確認 ({healthResult.ok}/{healthResult.total} OK)
    </h2>
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '13px' }}>
      <span>✅ OK: {healthResult.ok}</span>
      <span>❌ Not Found: {healthResult.notFound}</span>
      <span>🔒 Forbidden: {healthResult.forbidden}</span>
      <span>⚠️ Error: {healthResult.errors}</span>
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thStyle}>Status</th>
          <th style={thStyle}>名前</th>
          <th style={thStyle}>SPリスト名</th>
          <th style={thStyle}>HTTP</th>
          <th style={thStyle}>詳細</th>
        </tr>
      </thead>
      <tbody>
        {healthResult.results.map((r: ListCheckResult) => (
          <tr key={r.key} style={{ background: r.status === 'ok' ? '#f9fff9' : '#fff5f5' }}>
            <td style={{ ...tdStyle, textAlign: 'center' }}>{statusIcon(r.status)}</td>
            <td style={tdStyle}>{r.displayName}</td>
            <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{r.listName}</td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>{r.httpStatus ?? '—'}</td>
            <td style={{ ...tdStyle, color: '#c00', fontSize: '11px' }}>{r.error ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
