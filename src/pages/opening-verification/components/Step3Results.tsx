/**
 * Step3 Results — SELECT Query Verification Table
 */
import type { SelectCheckResult } from '../types';
import { sectionStyle, tdStyle, thStyle } from '../helpers';

interface Props {
  results: SelectCheckResult[];
}

export function Step3Results({ results }: Props) {
  if (results.length === 0) return null;

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
        📊 Step3: SELECTクエリ検証 ({results.filter(r => r.status === 'ok').length}/{results.length} 成功)
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>List</th>
            <th style={thStyle}>列数</th>
            <th style={thStyle}>HTTP</th>
            <th style={thStyle}>エラー詳細</th>
          </tr>
        </thead>
        <tbody>
          {results.map(r => (
            <tr key={r.listKey} style={{ background: r.status === 'ok' ? '#f9fff9' : '#fff5f5' }}>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{r.status === 'ok' ? '✅' : '❌'}</td>
              <td style={tdStyle}>{r.listKey}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{r.fieldCount}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{r.httpStatus ?? '—'}</td>
              <td style={{ ...tdStyle, color: '#c00', fontSize: '11px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.error ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
