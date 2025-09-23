import React, { useState } from 'react';
import { readAudit, AuditEvent } from '../../lib/audit';
import { useAuditSync } from './useAuditSync';
import { useAuditSyncBatch } from './useAuditSyncBatch';
import { AuditBatchMetrics } from './types';

const AuditPanel: React.FC = () => {
  const [logs, setLogs] = useState<AuditEvent[]>(readAudit());
  const { syncAll } = useAuditSync();
  const { syncAllBatch } = useAuditSyncBatch();
  const [lastCategories, setLastCategories] = useState<Record<string, number> | undefined>();
  // _lastDuration: metrics duration (currently not surfaced in UI; kept for future display)
  const [_lastDuration, setLastDuration] = useState<number | undefined>();
  const [lastFailed, setLastFailed] = useState<number | undefined>();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [lastSuccess, setLastSuccess] = useState<AuditBatchMetrics['success'] | undefined>();
  const [lastDuplicates, setLastDuplicates] = useState<AuditBatchMetrics['duplicates'] | undefined>();
  const [lastTotal, setLastTotal] = useState<AuditBatchMetrics['total'] | undefined>();
  const [showMetrics, setShowMetrics] = useState(false);

  const handleExport = () => {
    const header = ['日時','実行者','操作','対象エンティティ','対象ID','チャネル','変更後データ'];
  const rows = logs.map((log: AuditEvent) => [
      new Date(log.ts).toLocaleString(),
      log.actor,
      log.action,
      log.entity,
      log.entity_id || '',
      log.channel,
      JSON.stringify(log.after || {})
    ].map(f => `"${String(f).replace(/"/g,'""')}"`).join(','));
    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit_logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>監査ログ</h2>
        {(lastTotal !== undefined) && (
          <div data-testid="audit-metrics" style={{ display: 'flex', gap: 6, fontSize: 11 }}>
            <span style={{ padding: '2px 6px', borderRadius: 12, background: '#1976d2', color: '#fff' }}>新規 {typeof lastSuccess === 'number' ? Math.max(0,(lastSuccess - (lastDuplicates||0))) : 0}</span>
            <span style={{ padding: '2px 6px', borderRadius: 12, background: '#0288d1', color: '#fff' }}>重複 {lastDuplicates || 0}</span>
            <span style={{ padding: '2px 6px', borderRadius: 12, background: (lastFailed && lastFailed>0) ? '#d32f2f' : '#2e7d32', color: '#fff' }}>失敗 {lastFailed || 0}</span>
          </div>
        )}
        {import.meta.env.DEV && (
          <button aria-label="batch metrics" title="Batch parser metrics" style={{
            marginLeft: 4,
            width: 20,
            height: 20,
            borderRadius: '50%',
            padding: 0,
            lineHeight: '18px',
            fontSize: 12,
            cursor: 'pointer',
            background: '#eee',
            border: '1px solid #ccc'
          }} onClick={() => setShowMetrics(true)}>i</button>
        )}
      </div>
      {showMetrics && import.meta.env.DEV && (
        <div style={{ position: 'fixed', top: 0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex: 9999 }} onClick={() => setShowMetrics(false)}>
          <div style={{ background:'#fff', padding:16, width: 480, maxHeight:'80vh', overflow:'auto', borderRadius: 8 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop:0 }}>Batch Metrics</h3>
            <pre style={{ fontSize:11, background:'#f5f5f5', padding:8, borderRadius:4 }}>
{`
${JSON.stringify((window as any).__AUDIT_BATCH_METRICS__, null, 2)}
`}</pre>
            <div style={{ fontSize:11, color:'#555', marginTop:8 }}>
              parserFallbackCount: {(window as any).__AUDIT_BATCH_METRICS__?.parserFallbackCount || 0}
            </div>
            <button style={{ marginTop:12 }} onClick={() => setShowMetrics(false)}>閉じる</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <button onClick={handleExport} style={{ minHeight: 40 }} disabled={!logs.length}>CSVエクスポート</button>
        <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column' }}>
          <span style={{ lineHeight: '14px' }}>Action</span>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ minHeight: 32 }}>
            <option value="ALL">ALL</option>
            {Array.from(new Set(logs.map(l => l.action))).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <button
          onClick={async () => {
            setSyncMsg(null);
            setSyncing(true);
            try {
              const { total, success } = await syncAll();
              setSyncMsg(`同期完了: ${success}/${total} 件`);
              if (success) {
                // 再読込でクリア結果を表示
                setLogs(readAudit());
              }
            } catch (e: any) {
              setSyncMsg(`同期失敗: ${e?.message || e}`);
            } finally {
              setSyncing(false);
            }
          }}
          style={{ minHeight: 40 }}
          disabled={!logs.length || syncing}
        >
          {syncing ? '同期中…' : 'SPOへ同期'}
        </button>
        <button
          onClick={async () => {
            setSyncMsg(null);
            setSyncing(true);
            try {
              const { total, success, duplicates, failed, durationMs, categories } = await syncAllBatch();
              const newItems = (duplicates && success) ? (success - duplicates) : success;
              const dupPart = duplicates ? ` 重複 ${duplicates}` : '';
              const newPart = duplicates ? ` 新規 ${newItems}` : '';
              const failPart = failed ? ` 失敗 ${failed}` : '';
              setSyncMsg(`一括同期完了: ${success}/${total} 件${newPart}${dupPart}${failPart}${durationMs ? ` (${durationMs}ms)` : ''}`);
              setLastCategories(categories);
              setLastDuration(durationMs);
              setLastFailed(failed);
              setLastSuccess(success);
              setLastDuplicates(duplicates);
              setLastTotal(total);
              setLogs(readAudit());
            } catch (e: any) {
              setSyncMsg(`一括同期失敗: ${e?.message || e}`);
            } finally {
              setSyncing(false);
            }
          }}
          style={{ minHeight: 40 }}
          disabled={!logs.length || syncing}
        >
          {syncing ? '一括同期中…' : 'SPOへ一括同期($batch)'}
        </button>
        {lastFailed && lastFailed > 0 && (
          <button
            style={{ minHeight: 40 }}
            disabled={syncing}
            onClick={async () => {
              // 失敗のみ残っているので再度バッチ同期で再送
              setSyncMsg('失敗再送中…');
              setSyncing(true);
              try {
                const { total, success, duplicates, failed, durationMs } = await syncAllBatch();
                const newItems = (duplicates && success) ? (success - duplicates) : success;
                setSyncMsg(`失敗再送: ${success}/${total} 件 (新規 ${newItems}${duplicates ? ` 重複 ${duplicates}` : ''}${failed ? ` 失敗 ${failed}` : ''})${durationMs ? ` (${durationMs}ms)` : ''}`);
                setLastFailed(failed);
                setLastSuccess(success);
                setLastDuplicates(duplicates);
                setLastTotal(total);
                setLogs(readAudit());
              } catch (e: any) {
                setSyncMsg(`再送失敗: ${e?.message || e}`);
              } finally {
                setSyncing(false);
              }
            }}
          >失敗のみ再送</button>
        )}
        {syncMsg && <span style={{ fontSize: 12 }}>{syncMsg}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 12 }}>直近500件まで保持されます。</span>
      </div>
      {lastCategories && (
        <div style={{ fontSize: 12, marginTop: 4, color: '#555' }}>
          エラー内訳: {Object.entries(lastCategories).map(([k,v]) => `${k}:${v}`).join(' / ')}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr>
            <th>日時</th>
            <th>実行者</th>
            <th>操作</th>
            <th>対象エンティティ</th>
            <th>対象ID</th>
            <th>チャネル</th>
            <th>変更後データ</th>
          </tr>
        </thead>
        <tbody>
          {logs.filter(l => actionFilter === 'ALL' || l.action === actionFilter).map((log: AuditEvent, i: number) => (
            <tr key={i}>
              <td>{new Date(log.ts).toLocaleString()}</td>
              <td>{log.actor}</td>
              <td>{log.action}</td>
              <td>{log.entity}</td>
              <td>{log.entity_id}</td>
              <td>{log.channel}</td>
              <td><pre style={{ margin: 0 }}>{JSON.stringify(log.after, null, 2)}</pre></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AuditPanel;
