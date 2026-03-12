/**
 * Step2 Results — Field Verification Table
 */
import type { FieldCheckResult } from '../types';
import { sectionStyle, tdStyle, thStyle } from '../helpers';

interface Props {
  results: FieldCheckResult[];
}

export function Step2Results({ results }: Props) {
  if (results.length === 0) return null;

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
        🔍 Step2: フィールド照合 ({results.filter(r => r.status === 'ok').length}/{results.length} OK)
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>List</th>
            <th style={thStyle}>App Field</th>
            <th style={thStyle}>Tenant</th>
            <th style={thStyle}>Type</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={`${r.listKey}-${r.fieldApp}-${i}`} style={{ background: r.status === 'ok' ? '#f9fff9' : '#fff5f5' }}>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                {r.status === 'ok' ? '✅' : r.status === 'missing' ? '❌' : '⚠️'}
              </td>
              <td style={tdStyle}>{r.listKey}</td>
              <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{r.fieldApp}</td>
              <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{r.fieldTenant}</td>
              <td style={{ ...tdStyle, fontSize: '12px' }}>{r.tenantType ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
