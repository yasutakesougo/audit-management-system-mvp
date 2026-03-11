import React from 'react';
import { sectionStyle, tdStyle, thStyle } from './constants';
import type { SelectCheckResult } from './types';

type OvpStep3SelectTableProps = {
  selectResults: SelectCheckResult[];
};

export const OvpStep3SelectTable: React.FC<OvpStep3SelectTableProps> = ({ selectResults }) => (
  <div style={sectionStyle}>
    <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
      📊 Step3: SELECTクエリ検証 ({selectResults.filter(r => r.status === 'ok').length}/{selectResults.length} 成功)
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
        {selectResults.map(r => (
          <tr key={r.listKey} style={{ background: r.status === 'ok' ? '#f9fff9' : '#fff5f5' }}>
            <td style={{ ...tdStyle, textAlign: 'center' }}>{r.status === 'ok' ? '✅' : '❌'}</td>
            <td style={tdStyle}>{r.listKey}</td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>{r.fieldCount}</td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>{r.httpStatus ?? '—'}</td>
            <td
              style={{
                ...tdStyle,
                color: '#c00',
                fontSize: '11px',
                maxWidth: '300px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {r.error ?? ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
