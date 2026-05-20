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
import React, { useEffect } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import { useSP } from '../lib/spClient';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { useDataProviderObservabilityStore } from '@/lib/data/dataProviderObservabilityStore';

import { ObservabilityTab } from './ObservabilityTab';
import { ListsTab } from './ListsTab';
import { FieldsTab } from './FieldsTab';
import { SelectTab } from './SelectTab';
import { PostTab } from './PostTab';
import { MigrationTab } from './MigrationTab';

import {
  PANEL,
  HEADER,
  DATA_STATUS,
  TAB_BAR,
  tab,
  BODY,
  INPUT,
  BTN
} from './spDevPanelStyles';

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
