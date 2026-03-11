import React from 'react';
import { sectionStyle, tdStyle, thStyle } from './constants';
import type { FieldCheckResult } from './types';

type OvpStep2FieldTableProps = {
  fieldResults: FieldCheckResult[];
};

export const OvpStep2FieldTable: React.FC<OvpStep2FieldTableProps> = ({ fieldResults }) => (
  <div style={sectionStyle}>
    <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
      🔍 Step2: フィールド照合 ({fieldResults.filter(r => r.status === 'ok').length}/{fieldResults.length} OK)
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
        {fieldResults.map((r, i) => (
          <tr
            key={`${r.listKey}-${r.fieldApp}-${i}`}
            style={{ background: r.status === 'ok' ? '#f9fff9' : '#fff5f5' }}
          >
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
