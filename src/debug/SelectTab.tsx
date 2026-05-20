import React, { useCallback, useState } from 'react';
import { usePersisted } from './usePersisted';
import { CopyButton } from './CopyButton';
import { INPUT, BTN, RESULT } from './spDevPanelStyles';

export function SelectTab({ spFetch }: { spFetch: (path: string, init?: RequestInit) => Promise<Response> }) {
  const [listName, setListName] = usePersisted('select.listName', '');
  const [selectFields, setSelectFields] = usePersisted('select.fields', 'Id,Title');
  const [top, setTop] = usePersisted('select.top', '5');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    if (!listName.trim()) return;
    setLoading(true); setResult('');
    try {
      const url = `/_api/web/lists/getbytitle('${encodeURIComponent(listName.trim())}')/items?$top=${top}&$select=${encodeURIComponent(selectFields)}`;
      const res = await spFetch(url);
      const data = await res.json();
      if (!res.ok) {
        setResult(`❌ HTTP ${res.status}\n${JSON.stringify(data, null, 2)}`);
      } else {
        const items = data.value ?? [];
        setResult(`✅ ${items.length} 件取得\n${JSON.stringify(items, null, 2)}`);
      }
    } catch (e) {
      setResult(`❌ Error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [spFetch, listName, selectFields, top]);

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <input
          style={INPUT}
          value={listName}
          onChange={e => setListName(e.target.value)}
          placeholder="List名 (例: Users_Master)"
        />
        <input
          style={INPUT}
          value={selectFields}
          onChange={e => setSelectFields(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && run()}
          placeholder="$select (例: Id,Title,UserCode)"
        />
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ color: '#888', fontSize: '11px' }}>$top:</span>
          <input
            style={{ ...INPUT, width: '60px' }}
            value={top}
            onChange={e => setTop(e.target.value)}
            type="number"
          />
          <button style={BTN} onClick={run} disabled={loading}>
            {loading ? '実行中...' : '▶ SELECT 実行'}
          </button>
          {result && <CopyButton text={result} />}
        </div>
      </div>
      {result && <div style={RESULT}>{result}</div>}
    </div>
  );
}
