/**
 * Step1 Results — List Existence Table
 */
import type { HealthCheckSummary, ListCheckResult } from '@/sharepoint/spListHealthCheck';
import { sectionStyle, statusIcon, tdStyle, thStyle } from '../helpers';

interface Props {
  result: HealthCheckSummary;
}

export function Step1Results({ result }: Props) {
  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
        📋 Step1: リスト存在確認 ({result.ok}/{result.total} OK)
      </h2>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '13px' }}>
        <span>✅ OK: {result.ok}</span>
        <span>❌ Not Found: {result.notFound}</span>
        <span>🔒 Forbidden: {result.forbidden}</span>
        <span>⚠️ Error: {result.errors}</span>
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
          {result.results.map((r: ListCheckResult) => (
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
}
