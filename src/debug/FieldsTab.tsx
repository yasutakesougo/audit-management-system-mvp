import React, { useCallback, useState, useRef } from 'react';
import { usePersisted } from './usePersisted';
import { INPUT, BTN, TH, TD } from './spDevPanelStyles';

interface SpField {
  InternalName: string;
  Title: string;
  TypeAsString: string;
  Required: boolean;
}

export function FieldsTab({ spFetch }: { spFetch: (path: string, init?: RequestInit) => Promise<Response> }) {
  const [listName, setListName] = usePersisted('fields.listName', '');
  const [fields, setFields] = useState<SpField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const fetch = useCallback(async () => {
    if (!listName.trim()) return;
    setLoading(true); setError(''); setFields([]);
    try {
      const url = `/_api/web/lists/getbytitle('${encodeURIComponent(listName.trim())}')/fields?$filter=Hidden eq false&$select=InternalName,Title,TypeAsString,Required&$orderby=InternalName`;
      const res = await spFetch(url);
      if (!res.ok) { setError(`HTTP ${res.status}`); return; }
      const data = await res.json();
      setFields(data.value ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [spFetch, listName]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          ref={inputRef}
          style={{ ...INPUT, flex: 1 }}
          value={listName}
          onChange={e => setListName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetch()}
          placeholder="List名 (例: Users_Master)"
        />
        <button style={BTN} onClick={fetch} disabled={loading}>
          {loading ? '...' : '取得'}
        </button>
      </div>
      {error && <div style={{ color: '#ff6b6b', marginTop: '6px' }}>{error}</div>}
      {fields.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
          <thead>
            <tr>
              <th style={TH}>InternalName</th>
              <th style={TH}>Type</th>
              <th style={TH}>Req</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(f => (
              <tr key={f.InternalName}>
                <td style={TD}>
                  {f.InternalName}
                  {f.InternalName !== f.Title && (
                    <span style={{ color: '#666', marginLeft: '4px' }}>({f.Title})</span>
                  )}
                </td>
                <td style={{ ...TD, color: f.TypeAsString === 'Lookup' ? '#ffc107' : '#90caf9' }}>
                  {f.TypeAsString}
                </td>
                <td style={{ ...TD, textAlign: 'center', color: f.Required ? '#ff6b6b' : '#666' }}>
                  {f.Required ? '✓' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {fields.length > 0 && (
        <div style={{ color: '#888', marginTop: '4px', fontSize: '10px' }}>
          計 {fields.length} フィールド / Required: {fields.filter(f => f.Required).length} /
          Lookup: {fields.filter(f => f.TypeAsString === 'Lookup').length}
        </div>
      )}
    </div>
  );
}
