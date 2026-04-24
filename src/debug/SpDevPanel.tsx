/**
 * SpDevPanel — SharePoint Dev Panel (Ctrl+Shift+D)
 *
 * アプリ内から SharePoint REST API を直接叩けるインライン開発パネル。
 * DEV環境でのみ表示される。
 *
 * 機能:
 *   Tab0: Health           — データ層の健康状態（解決状況）と修復アクション
 *   Tab1: List Browser     — テナント上の全リスト表示
 *   Tab2: Field Schema     — 指定リストのフィールド一覧
 *   Tab3: SELECT Tester    — 任意の $select を実行
 *   Tab4: POST Tester      — 任意の JSON を送信
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import { useSP } from '../lib/spClient';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { migrateUserSplitData } from '../features/users/utils/migrateUserSplitData';
import { useDataProviderObservabilityStore } from '@/lib/data/dataProviderObservabilityStore';
import { DATA_OS_RESOURCE_REGISTRY } from '@/lib/data/dataOSResourceRegistry';

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

const DATA_STATUS: React.CSSProperties = {
  background: '#0f3460',
  padding: '8px 12px',
  borderBottom: '1px solid #1a3a6e',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
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
      {copied ? '✅' : '📋'}
    </button>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff1744', // Red A400
  warn: '#ff9100',     // Orange A400
  info: '#4caf50',     // Green 500
};

export default function SpDevPanel() {
  const { resolutions, isPanelOpen, setPanelOpen, activeTab, setPanelTab } = useDataProviderObservabilityStore();
  const { spFetch } = useSP();
  const { type: providerType } = useDataProvider();
  const confirmDialog = useConfirmDialog();

  // ── Keyboard shortcut (Ctrl+Shift+D) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setPanelOpen(!isPanelOpen);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPanelOpen, setPanelOpen]);

  if (!isPanelOpen) return null;

  const resolutionList = Object.values(resolutions);
  const errorCount = resolutionList.filter(r => r.severity === 'critical').length;
  const warnCount = resolutionList.filter(r => r.severity === 'warn').length;

  return (
    <div style={PANEL} data-testid="sp-dev-panel">
      {/* Header */}
      <div style={HEADER}>
        <span style={{ fontWeight: 700, color: '#e94560' }}>🛠 SP Dev Panel</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {errorCount > 0 && <span style={{ color: '#ff6b6b', fontSize: '10px', fontWeight: 700 }}>❌ {errorCount}</span>}
          {warnCount > 0 && <span style={{ color: '#ff9800', fontSize: '10px', fontWeight: 700 }}>⚠️ {warnCount}</span>}
          <button
            onClick={() => setPanelOpen(false)}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}
            aria-label="閉じる"
          >✕</button>
        </div>
      </div>

      {/* Data Source Status */}
      <div style={DATA_STATUS}>
        <div>
          <span style={{ color: '#888' }}>Backend: </span>
          <span style={{ 
            color: providerType === 'memory' ? '#ffc107' : (providerType === 'local' ? '#00bcd4' : '#4caf50'), 
            fontWeight: 700 
          }}>
            {providerType === 'memory' ? 'InMemory (Mock)' : (providerType === 'local' ? 'LocalStorage (Persistent)' : 'SharePoint (REST)')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
           <select 
             style={{ ...INPUT, width: '100px', marginTop: 0, padding: '2px 4px', fontSize: '9px', background: '#444' }}
             value={providerType}
             onChange={(e) => {
               const val = e.target.value;
               const url = new URL(window.location.href);
               if (val === 'sharepoint') url.searchParams.delete('provider');
               else url.searchParams.set('provider', val);
               window.location.href = url.toString();
             }}
           >
             <option value="sharepoint">SharePoint</option>
             <option value="memory">InMemory</option>
             <option value="local">LocalStorage</option>
           </select>
           
           {providerType === 'local' && (
             <button 
               style={{ ...BTN, marginTop: 0, padding: '2px 6px', fontSize: '9px', background: '#c62828' }}
               onClick={() => {
                 confirmDialog.open({
                   title: 'データクリアの確認',
                   message: 'LocalStorage 内の dp:* データをすべて削除しますか？',
                   confirmLabel: 'クリアする',
                   cancelLabel: 'キャンセル',
                   severity: 'error',
                   onConfirm: () => {
                     const keys = Object.keys(localStorage);
                     keys.forEach(k => k.startsWith('dp:v1:') && localStorage.removeItem(k));
                     window.location.reload();
                   }
                 });
               }}
             >
               Clear Local
             </button>
           )}
        </div>
      </div>

      {/* Tabs */}
      <div style={TAB_BAR}>
        <div style={tab(activeTab === 'obs')} onClick={() => setPanelTab('obs')}>📡 Health</div>
        <div style={tab(activeTab === 'lists')} onClick={() => setPanelTab('lists')}>📋 Lists</div>
        <div style={tab(activeTab === 'fields')} onClick={() => setPanelTab('fields')}>🔎 Fields</div>
        <div style={tab(activeTab === 'select')} onClick={() => setPanelTab('select')}>📊 SELECT</div>
        <div style={tab(activeTab === 'post')} onClick={() => setPanelTab('post')}>✏️ POST</div>
        <div style={tab(activeTab === 'migrate')} onClick={() => setPanelTab('migrate')}>🚀 Migration</div>
      </div>

      {/* Body */}
      <div style={BODY}>
        {activeTab === 'obs' && <ObservabilityTab confirmDialog={confirmDialog} />}
        {activeTab === 'lists' && <ListsTab spFetch={spFetch} />}
        {activeTab === 'fields' && <FieldsTab spFetch={spFetch} />}
        {activeTab === 'select' && <SelectTab spFetch={spFetch} />}
        {activeTab === 'post' && <PostTab spFetch={spFetch} confirmDialog={confirmDialog} />}
        {activeTab === 'migrate' && <MigrationTab confirmDialog={confirmDialog} />}
      </div>
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
}

function ObservabilityTab({ confirmDialog }: { confirmDialog: ReturnType<typeof useConfirmDialog> }) {
  const { provider } = useDataProvider();
  const { resolutions, clearResolutions } = useDataProviderObservabilityStore();
  const [provisioning, setProvisioning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const list = Object.values(resolutions).sort((a, b) => a.resourceName.localeCompare(b.resourceName));

  const handleAction = async (resourceName: string, mode: 'repair' | 'create') => {
    const def = DATA_OS_RESOURCE_REGISTRY[resourceName];
    if (!def) {
      alert(`Registry entry not found for ${resourceName}`);
      return;
    }

    setProvisioning(resourceName);
    setLastResult(null);

    try {
      // プロバイダー経由で修復/作成を実行 (SharePointならREST, LocalならlocalStorage経由)
      await provider.ensureListExists(def.defaultListTitle, def.fields);

      setLastResult({ type: 'success', msg: `${mode === 'repair' ? '修復' : '作成'}が完了しました。ページを再読み込みします。` });
      
      setTimeout(() => {
        clearResolutions();
        window.location.reload();
      }, 1500);
    } catch (e) {
      setLastResult({ type: 'error', msg: `失敗: ${String(e)}` });
    } finally {
      setProvisioning(null);
    }
  };

  const confirmAction = (resourceName: string, mode: 'repair' | 'create') => {
    const def = DATA_OS_RESOURCE_REGISTRY[resourceName];
    confirmDialog.open({
      title: `${mode === 'repair' ? '修復' : '作成'}の実行`,
      message: `${def?.defaultListTitle ?? resourceName} の${mode === 'repair' ? '修復' : '作成'}を開始しますか？`,
      confirmLabel: '開始',
      cancelLabel: 'キャンセル',
      severity: 'info',
      onConfirm: () => handleAction(resourceName, mode),
    });
  };

  if (list.length === 0) {
    return <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No resources accessed yet.</div>;
  }

  return (
    <div>
      {lastResult && (
        <div style={{ 
          padding: '8px', marginBottom: '8px', borderRadius: '4px', fontSize: '11px',
          background: lastResult.type === 'success' ? '#2e7d32' : '#c62828',
          color: '#fff'
        }}>
          {lastResult.msg}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH}>Resource</th>
            <th style={TH}>Status</th>
            <th style={TH}>Resolved</th>
            <th style={TH}>Action</th>
          </tr>
        </thead>
        <tbody>
          {list.map(r => (
            <tr key={r.resourceName}>
              <td style={TD}>
                <div style={{ fontWeight: 600 }}>{r.resourceName}</div>
                {r.fallbackFrom && <div style={{ fontSize: '9px', color: '#00bcd4' }}>from {r.fallbackFrom}</div>}
              </td>
              <td style={{ ...TD, color: SEVERITY_COLORS[r.severity], fontWeight: 700 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {r.status.toUpperCase()}
                  {r.fields.some(f => (f.key === 'userId' || f.key === 'id') && !f.isResolved) && (
                    <span style={{ 
                      fontSize: '8px', background: SEVERITY_COLORS.critical, color: '#fff', 
                      padding: '1px 4px', borderRadius: '2px' 
                    }}>ID MISSING</span>
                  )}
                </div>
              </td>
              <td style={TD}>
                <div style={{ fontSize: '10px' }}>{r.resolvedTitle}</div>
                <div style={{ fontSize: '9px', color: '#888' }}>
                  {r.fields.filter(f => f.isResolved).length} / {r.fields.length} fields
                </div>
              </td>
              <td style={TD}>
                {provisioning === r.resourceName ? (
                   <span style={{ fontSize: '9px', color: '#888' }}>処理中...</span>
                ) : (
                  <>
                    {(r.status === 'schema_mismatch' || r.status === 'fallback_triggered') && (
                      <button 
                        style={{ ...BTN, marginTop: 0, padding: '2px 4px', fontSize: '9px', background: '#2196f3' }}
                        onClick={() => confirmAction(r.resourceName, 'repair')}
                      >
                        🛠 REPAIR
                      </button>
                    )}
                    {r.status === 'missing_required' && (
                      <button 
                        style={{ ...BTN, marginTop: 0, padding: '2px 4px', fontSize: '9px' }}
                        onClick={() => confirmAction(r.resourceName, 'create')}
                      >
                        ➕ CREATE
                      </button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={{ color: '#e94560', marginTop: '16px', fontSize: '11px', borderBottom: '1px solid #1a3a6e' }}>Schema Details</h4>
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {list.map(r => (
           <div key={`${r.resourceName}-fields`} style={{ marginBottom: '10px' }}>
             <div style={{ color: '#e0e0e0', fontSize: '10px', fontWeight: 700 }}>{r.resourceName} ({r.resolvedTitle})</div>
             {r.fields.map(f => (
               <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', padding: '1px 4px' }}>
                 <span style={{ 
                   color: f.isEssential ? '#ff6b6b' : (f.isSilent ? '#888' : '#aaa'),
                   fontStyle: f.isSilent ? 'italic' : 'normal'
                 }}>
                   {f.isEssential ? '★ ' : (f.isSilent ? '⚑ ' : '• ')}{f.key}
                   {f.isSilent && <span style={{ fontSize: '8px', marginLeft: '4px' }}>(silent)</span>}
                 </span>
                 <span style={{ color: f.isResolved ? '#4caf50' : (f.isSilent ? '#555' : '#888') }}>
                   {f.isResolved ? f.resolvedName : 'Missing'}
                 </span>
               </div>
             ))}
           </div>
        ))}
      </div>
      <ConfirmDialog {...confirmDialog.dialogProps} />
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

function PostTab({ 
  spFetch, 
  confirmDialog 
}: { 
  spFetch: (path: string, init?: RequestInit) => Promise<Response>;
  confirmDialog: ReturnType<typeof useConfirmDialog>;
}) {
  const [listName, setListName] = usePersisted('post.listName', '');
  const [body, setBody] = usePersisted('post.body', '{\n  "Title": "テスト"\n}');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const executePost = useCallback(async () => {
    setLoading(true); setResult('');
    if (!listName.trim()) return;

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

  const run = useCallback(() => {
    if (!listName.trim()) return;
    confirmDialog.open({
      title: 'POST 実行の確認',
      message: `この操作は実際にアイテムを作成します。\nList: ${listName}`,
      confirmLabel: '実行する',
      cancelLabel: 'キャンセル',
      severity: 'info',
      onConfirm: executePost,
    });
  }, [listName, confirmDialog, executePost]);

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
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
}

// ── Tab 5: Migration ───────────────────────────────────────────────────────

function MigrationTab({ confirmDialog }: { confirmDialog: ReturnType<typeof useConfirmDialog> }) {
  const { provider } = useDataProvider();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ processed: number; transportCreated: number; benefitCreated: number; errors: string[] } | null>(null);

  const runMigration = async (dryRun: boolean) => {
    setRunning(true);
    setResult(null);
    try {
      const stats = await migrateUserSplitData(provider, { dryRun });
      setResult(stats);
      if (stats.errors.length === 0 && !dryRun) {
        alert('移行が正常に完了しました！');
      }
    } catch (e) {
      alert(`エラーが発生しました: ${String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  const handleStart = (dryRun: boolean) => {
    confirmDialog.open({
      title: `Users Migration (${dryRun ? 'DRY RUN' : 'EXE'})`,
      message: dryRun 
        ? 'データを変更せずに移行対象を確認します。コンソールログも確認してください。'
        : '実際にデータを分離先リストにコピーします。移行前に各リストが存在することを確認してください。',
      confirmLabel: dryRun ? 'Dry Run 開始' : '本番移行を開始',
      cancelLabel: 'キャンセル',
      severity: dryRun ? 'info' : 'warning',
      onConfirm: () => runMigration(dryRun),
    });
  };

  return (
    <div>
      <h3 style={{ color: '#e94560', fontSize: '12px', marginBottom: '8px' }}>Users_Master 分割移行ツール</h3>
      <p style={{ fontSize: '10px', color: '#888', marginBottom: '12px' }}>
        Users_Master のデータを UserTransport_Settings と UserBenefit_Profile へ分配します。<br/>
        ※事前に Health タブで各リストを作成(CREATE)しておいてください。
      </p>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button style={{ ...BTN, background: '#2196f3' }} onClick={() => handleStart(true)} disabled={running}>
          {running ? '処理中...' : '🔍 Dry Run'}
        </button>
        <button style={{ ...BTN, background: '#e94560' }} onClick={() => handleStart(false)} disabled={running}>
          {running ? '処理中...' : '🚀 本格移行実行'}
        </button>
      </div>

      {result && (
        <div style={RESULT}>
          <div style={{ fontWeight: 700, color: '#4caf50', marginBottom: '4px' }}>
            {result.errors.length === 0 ? '✅ 完了' : '⚠️ 完了（エラーあり）'}
          </div>
          <div>処理対象: {result.processed} 件</div>
          <div>送迎設定作成: {result.transportCreated} 件</div>
          <div>支給情報作成: {result.benefitCreated} 件</div>
          {result.errors.length > 0 && (
            <div style={{ marginTop: '8px', borderTop: '1px solid #1a3a6e', paddingTop: '4px' }}>
              <div style={{ color: '#ff6b6b', fontWeight: 700 }}>Errors ({result.errors.length}):</div>
              <ul style={{ paddingLeft: '16px', color: '#ff6b6b', fontSize: '10px' }}>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
