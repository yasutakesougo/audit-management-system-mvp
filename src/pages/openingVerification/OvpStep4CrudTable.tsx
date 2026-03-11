import React from 'react';
import { crudIcon, sectionStyle, tdStyle, thStyle } from './constants';
import type { CrudResult } from './types';

type OvpStep4CrudTableProps = {
  crudResults: CrudResult[];
};

export const OvpStep4CrudTable: React.FC<OvpStep4CrudTableProps> = ({ crudResults }) => (
  <div style={sectionStyle}>
    <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
      🧪 Step4: CRUD確認
    </h2>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thStyle}>Entity</th>
          <th style={thStyle}>List</th>
          <th style={thStyle}>Read</th>
          <th style={thStyle}>Create</th>
          <th style={thStyle}>Update</th>
          <th style={thStyle}>詳細</th>
        </tr>
      </thead>
      <tbody>
        {crudResults.map(r => (
          <tr key={r.entity}>
            <td style={{ ...tdStyle, fontWeight: 600 }}>{r.entity}</td>
            <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{r.listName}</td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>
              {crudIcon(r.read)} {r.readCount !== undefined ? `(${r.readCount})` : ''}
            </td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>
              {crudIcon(r.create)} {r.createdId ? `(#${r.createdId})` : ''}
            </td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>{crudIcon(r.update)}</td>
            <td style={{ ...tdStyle, color: '#c00', fontSize: '11px' }}>
              {[r.readError, r.createError, r.updateError].filter(Boolean).join('; ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
