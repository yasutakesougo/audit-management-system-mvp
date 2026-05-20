import React, { useState } from 'react';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import { useDataProvider } from '@/lib/data/useDataProvider';
import { migrateUserSplitData } from '../features/users/utils/migrateUserSplitData';
import { BTN, RESULT } from './spDevPanelStyles';

export function MigrationTab({ confirmDialog }: { confirmDialog: ReturnType<typeof useConfirmDialog> }) {
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
