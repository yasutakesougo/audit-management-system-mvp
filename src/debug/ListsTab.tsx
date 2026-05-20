import React, { useCallback, useState } from 'react';
import { BTN, TH, TD } from './spDevPanelStyles';

export function ListsTab({ spFetch }: { spFetch: (path: string, init?: RequestInit) => Promise<Response> }) {
  const [lists, setLists] = useState<Array<{ Title: string; Id: string; ItemCount: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await spFetch("/_api/web/lists?$filter=Hidden eq false&$select=Title,Id,ItemCount&$orderby=Title");
      const data = await res.json();
      setLists(data.value ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [spFetch]);

  return (
    <div>
      <button style={BTN} onClick={fetch} disabled={loading}>
        {loading ? '取得中...' : 'テナント全リスト取得'}
      </button>
      {error && <div style={{ color: '#ff6b6b', marginTop: '6px' }}>{error}</div>}
      {lists.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
          <thead>
            <tr><th style={TH}>Title</th><th style={TH}>ItemCount</th></tr>
          </thead>
          <tbody>
            {lists.map(l => (
              <tr key={l.Id}>
                <td style={TD}>{l.Title}</td>
                <td style={{ ...TD, textAlign: 'right' }}>{l.ItemCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {lists.length > 0 && (
        <div style={{ color: '#888', marginTop: '4px', fontSize: '10px' }}>
          計 {lists.length} リスト
        </div>
      )}
    </div>
  );
}
