import React, { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { useDataProviderObservabilityStore } from '@/lib/data/dataProviderObservabilityStore';
import { DATA_OS_RESOURCE_REGISTRY } from '@/lib/data/dataOSResourceRegistry';
import { TH, TD, BTN, SEVERITY_COLORS } from './spDevPanelStyles';

export function ObservabilityTab({ confirmDialog }: { confirmDialog: ReturnType<typeof useConfirmDialog> }) {
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
