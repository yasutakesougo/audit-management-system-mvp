/**
 * SpDevPanel — SharePoint Dev Panel (Ctrl+Shift+D)
 *
 * アプリ内から SharePoint REST API を直接叩けるインライン開発パネル。
 * DEV環境でのみ表示される。
 *
 * 機能:
 *   Tab1: List Browser     — テナント上の全リスト表示
 *   Tab2: Field Schema     — 指定リストのフィールド一覧
 *   Tab3: SELECT Tester    — 任意の $select を実行
 *   Tab4: POST Tester      — 任意の JSON を送信
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSP } from '../lib/spClient';

// ── Types ──────────────────────────────────────────────────────────────────

interface SpField {
  InternalName: string;
  Title: string;
  TypeAsString: string;
  Required: boolean;
}

// ── Styles ─────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  right: 0,
  width: '520px',
  maxHeight: '70vh',
  background: '#1a1a2e',
  color: '#e0e0e0',
  borderTopLeftRadius: '12px',
  boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
  zIndex: 99999,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '12px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const HEADER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 12px',
  background: '#16213e',
  borderBottom: '1px solid #0f3460',
  cursor: 'grab',
  userSelect: 'none',
};

const TAB_BAR: React.CSSProperties = {
  display: 'flex', gap: '2px',
  background: '#16213e',
  padding: '0 8px',
};

const tab = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px', cursor: 'pointer',
  background: active ? '#1a1a2e' : 'transparent',
  borderBottom: active ? '2px solid #e94560' : '2px solid transparent',
  color: active ? '#e94560' : '#888',
  fontWeight: active ? 700 : 400,
  fontSize: '11px',
  transition: 'all 0.15s ease',
});

const BODY: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '10px 12px',
};

const INPUT: React.CSSProperties = {
  width: '100%', padding: '6px 8px',
  background: '#0f3460', color: '#e0e0e0', border: '1px solid #1a3a6e',
  borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const BTN: React.CSSProperties = {
  padding: '6px 14px', fontSize: '11px', fontWeight: 700,
  background: '#e94560', color: '#fff', border: 'none',
  borderRadius: '4px', cursor: 'pointer',
  marginTop: '6px',
};

const RESULT: React.CSSProperties = {
  marginTop: '8px', padding: '8px',
  background: '#0f3460', borderRadius: '4px',
  maxHeight: '250px', overflowY: 'auto',
  whiteSpace: 'pre-wrap', lineHeight: 1.5,
};

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #1a3a6e',
  color: '#e94560', fontSize: '11px', fontWeight: 600,
};

const TD: React.CSSProperties = {
  padding: '3px 6px', borderBottom: '1px solid #0f3460', fontSize: '11px',
};

// ── LocalStorage helper (dev panel state persistence) ──────────────────

const LS_KEY = 'sp-dev-panel';

function loadPanelState(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
  } catch { return {}; }
}

function savePanelField(key: string, value: string) {
  try {
    const state = loadPanelState();
    state[key] = value;
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function usePersisted(key: string, fallback: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => loadPanelState()[key] ?? fallback);
  const set = useCallback((v: string) => { setValue(v); savePanelField(key, v); }, [key]);
  return [value, set];
}

// ── Copy helper ───────────────────────────────────────────────────

const BTN_COPY: React.CSSProperties = {
  ...BTN,
  background: '#2d6a4f',
  fontSize: '10px',
  padding: '3px 10px',
  marginTop: 0,
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button style={BTN_COPY} onClick={copy}>
      {copied ? '✅ Copied' : '📋 Copy'}
    </button>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

type Tab = 'lists' | 'fields' | 'select' | 'post';

export default function SpDevPanel() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('lists');
  const { spFetch } = useSP();

  // ── Keyboard shortcut (Ctrl+Shift+D) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!open) return null;

  return (
    <div style={PANEL} data-testid="sp-dev-panel">
      {/* Header */}
      <div style={HEADER}>
        <span style={{ fontWeight: 700, color: '#e94560' }}>🛠 SP Dev Panel</span>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}
          aria-label="閉じる"
        >✕</button>
      </div>

      {/* Tabs */}
      <div style={TAB_BAR}>
        <div style={tab(activeTab === 'lists')} onClick={() => setActiveTab('lists')}>📋 Lists</div>
        <div style={tab(activeTab === 'fields')} onClick={() => setActiveTab('fields')}>🔎 Fields</div>
        <div style={tab(activeTab === 'select')} onClick={() => setActiveTab('select')}>📊 SELECT</div>
        <div style={tab(activeTab === 'post')} onClick={() => setActiveTab('post')}>✏️ POST</div>
      </div>

      {/* Body */}
      <div style={BODY}>
        {activeTab === 'lists' && <ListsTab spFetch={spFetch} />}
        {activeTab === 'fields' && <FieldsTab spFetch={spFetch} />}
        {activeTab === 'select' && <SelectTab spFetch={spFetch} />}
        {activeTab === 'post' && <PostTab spFetch={spFetch} />}
      </div>
    </div>
  );
}

// ── Tab 1: List Browser ────────────────────────────────────────────────────

function ListsTab({ spFetch }: { spFetch: (path: string, init?: RequestInit) => Promise<Response> }) {
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

// ── Tab 2: Field Schema ────────────────────────────────────────────────────

function FieldsTab({ spFetch }: { spFetch: (path: string, init?: RequestInit) => Promise<Response> }) {
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

// ── Tab 3: SELECT Tester ───────────────────────────────────────────────────

function SelectTab({ spFetch }: { spFetch: (path: string, init?: RequestInit) => Promise<Response> }) {
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

// ── Tab 4: POST Tester ─────────────────────────────────────────────────────

function PostTab({ spFetch }: { spFetch: (path: string, init?: RequestInit) => Promise<Response> }) {
  const [listName, setListName] = usePersisted('post.listName', '');
  const [body, setBody] = usePersisted('post.body', '{\n  "Title": "テスト"\n}');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    if (!listName.trim()) return;

    // ── Confirmation dialog (accident prevention) ──
    const confirmed = window.confirm(
      `⚠️ この操作は実際にアイテムを作成します。\n\nList: ${listName}\n\n実行しますか？`
    );
    if (!confirmed) return;

    setLoading(true); setResult('');
    try {
      // 1. Get EntityType
      const metaUrl = `/_api/web/lists/getbytitle('${encodeURIComponent(listName.trim())}')?$select=ListItemEntityTypeFullName`;
      const metaRes = await spFetch(metaUrl);
      const metaData = await metaRes.json();
      const entityType = metaData.ListItemEntityTypeFullName;

      // 2. Merge __metadata + user body
      const parsed = JSON.parse(body);
      const payload = {
        ...parsed,
        __metadata: entityType ? { type: entityType } : undefined,
      };

      // 3. POST
      const postUrl = `/_api/web/lists/getbytitle('${encodeURIComponent(listName.trim())}')/items`;
      const postRes = await spFetch(postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;odata=nometadata',
          Accept: 'application/json;odata=nometadata',
        },
        body: JSON.stringify(payload),
      });
      const postData = await postRes.json();

      if (postRes.ok || postRes.status === 201) {
        setResult(`✅ Created Id=${postData.Id}\nEntityType: ${entityType}\n\n${JSON.stringify(postData, null, 2)}`);
      } else {
        setResult(`❌ HTTP ${postRes.status}\nEntityType: ${entityType}\n\n${JSON.stringify(postData, null, 2)}`);
      }
    } catch (e) {
      setResult(`❌ Error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [spFetch, listName, body]);

  return (
    <div>
      <input
        style={{ ...INPUT, marginBottom: '4px' }}
        value={listName}
        onChange={e => setListName(e.target.value)}
        placeholder="List名 (例: Handoff)"
      />
      <textarea
        style={{ ...INPUT, height: '80px', resize: 'vertical' }}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder='{"Title": "テスト"}'
      />
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
        <button style={BTN} onClick={run} disabled={loading}>
          {loading ? '送信中...' : '▶ POST 実行'}
        </button>
        <span style={{ color: '#ffc107', fontSize: '10px' }}>⚠️ 確認ダイアログ付き / EntityType 自動取得</span>
        {result && <CopyButton text={result} />}
      </div>
      {result && <div style={RESULT}>{result}</div>}
    </div>
  );
}
