import React from 'react';
import { useSpIndexCandidates } from './useSpIndexCandidates';
import { type IndexFieldSpec } from './spIndexKnownConfig';
import { useSpIndexRepair } from './useSpIndexRepair';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';

interface Props {
  listName: string;
  onRefresh?: () => Promise<void> | void;
}

/**
 * SpIndexPressurePanel — インデックス不足（Pressure）を検知し、
 * 運用者に「今何をすべきか」を提示し、ワンクリックで修復（Provisioning）を行うパネル。
 */
export const SpIndexPressurePanel: React.FC<Props> = ({ listName, onRefresh }) => {
  const [reloadKey, setReloadKey] = React.useState(0);
  const { 
    additionCandidates, 
    deletionCandidates, 
    loading: loadingCandidates, 
    error: fetchError,
    hasKnownConfig 
  } = useSpIndexCandidates(listName, reloadKey);

  const repair = useSpIndexRepair();
  const confirm = useConfirmDialog();
  const [recheckStatus, setRecheckStatus] = React.useState<'idle' | 'running' | 'success' | 'error'>('idle');

  if (loadingCandidates && recheckStatus !== 'running') return null;
  if (fetchError) return <div className="p-4 text-red-500 font-bold border border-red-100 rounded-lg bg-red-50">⚠️ インデックス解析に失敗しました: {fetchError}</div>;
  if (!hasKnownConfig) return null; 

  const hasUrgent = additionCandidates.length > 0;
  const hasOptimization = deletionCandidates.length > 0;

  if (!hasUrgent && !hasOptimization && repair.results.length === 0) return null;

  const handleStartRepair = () => {
    repair.generatePlan(listName, additionCandidates, deletionCandidates);
    
    confirm.open({
      title: 'インデックスの自動修復',
      message: `
対象リスト: ${listName}
----------------------------------
・追加: ${additionCandidates.length}件
・削除: ${deletionCandidates.length}件

【期待される効果】
・5,000件上限エラーの解消
・データ取得の高速化
・インデックス枠の節約
      `.trim(),
      warningText: '修復中にページを閉じると、一部のインデックス設定が中途半端な状態で残る可能性があります。',
      confirmLabel: '修復を開始する',
      onConfirm: async () => {
        setRecheckStatus('idle');
        await repair.executeRepair();
        
        // 1. まずインデックス候補自体を再取得
        setReloadKey(prev => prev + 1);

        // 2. ページ全体の診断を再実行
        if (onRefresh) {
          setRecheckStatus('running');
          try {
            await onRefresh();
            setRecheckStatus('success');
          } catch {
            setRecheckStatus('error');
          }
        }
      }
    });
  };

  const successCount = repair.results.filter(r => r.status === 'success').length;
  const totalCount = repair.results.length;
  const isPartial = successCount > 0 && successCount < totalCount;
  const isAllFailed = totalCount > 0 && successCount === 0;

  return (
    <div className="my-6 border rounded-lg bg-white shadow-sm overflow-hidden border-blue-100 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex items-center justify-between">
        <h3 className="font-bold text-blue-900 flex items-center gap-2">
           🛡️ インデックス最適化アドバイザー
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-blue-600 bg-white px-2 py-1 rounded shadow-inner">
            対象: {listName}
          </span>
          <button
            onClick={handleStartRepair}
            disabled={repair.isExecuting}
            className={`text-xs font-bold px-4 py-2 rounded shadow-sm transition-all ${
              repair.isExecuting 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
            }`}
          >
            {repair.isExecuting ? '⌛ 修復中...' : '⚡ 今すぐ修復'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Repair Results Summary */}
        {totalCount > 0 && (
          <section className={`p-4 rounded-lg border flex flex-col gap-3 ${
            isAllFailed ? 'bg-red-50 border-red-200' : isPartial ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
          }`}>
            <div className={`font-bold flex items-center gap-2 ${
              isAllFailed ? 'text-red-800' : isPartial ? 'text-orange-800' : 'text-green-800'
            }`}>
              <span>{isAllFailed ? '❌ 修復に失敗しました' : isPartial ? '⚠️ 一部の修復に失敗しました' : '✅ 修復が完了しました'}</span>
              <span className="text-xs px-2 py-0.5 bg-white bg-opacity-50 rounded-full">
                {successCount} / {totalCount} 成功
              </span>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {repair.results.map((r, idx) => (
                <li key={idx} className={`text-xs p-2 rounded bg-white bg-opacity-40 border ${
                  r.status === 'success' ? 'border-green-100 text-green-700' : 'border-red-100 text-red-700'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold">[{r.action.type === 'create' ? '追加' : '削除'}] {r.action.displayName}</span>
                    <span>{r.status === 'success' ? 'OK' : 'FAIL'}</span>
                  </div>
                  {r.errorDetail && <div className="mt-1 opacity-70 scale-95 origin-left">{r.errorDetail}</div>}
                </li>
              ))}
            </ul>

            {/* Recheck status message */}
            {recheckStatus === 'running' && (
              <div className="text-xs text-blue-600 animate-pulse flex items-center gap-1">
                <span className="inline-block animate-spin">⌛</span> 最新の状態を再確認しています...
              </div>
            )}
            {recheckStatus === 'error' && (
              <div className="text-xs text-red-600 font-bold bg-white p-2 rounded border border-red-100">
                ⚠️ 修復処理は実行されましたが、最新状態の確認（再診断）に失敗しました。ページをリロードして確認してください。
              </div>
            )}
            {recheckStatus === 'success' && !repair.isExecuting && (
              <p className="text-[10px] text-gray-500 italic">
                ※ 修復データに基づき、最新の診断結果を反映しました。
              </p>
            )}
          </section>
        )}

        {/* Urgent Addition (Critical/Action Required) */}
        {hasUrgent && !repair.isExecuting && (
          <section className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
              <span className="text-xl">🔴</span>
              <span>至急対応が必要: インデックスが不足しています</span>
            </div>
            <p className="text-sm text-red-600 mb-3 ml-7">
              <strong>リスク:</strong> 5,000件上限エラーにより、一部のデータが表示されなくなる恐れがあります。
            </p>
            <ul className="space-y-2 ml-7 mb-4">
              {additionCandidates.map((f: IndexFieldSpec) => (
                <li key={f.internalName} className="text-sm bg-white p-3 rounded-md border border-red-100 shadow-sm">
                  <div className="font-bold text-gray-800">{f.displayName} ({f.internalName})</div>
                  <div className="text-gray-500 text-xs mt-1 leading-relaxed">
                    <span className="font-bold text-gray-600">必要理由:</span> {f.reason}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Optional Cleanup (Watch/Silent) */}
        {hasOptimization && !repair.isExecuting && (
          <section className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-900">
            <div className="flex items-center gap-2 font-bold mb-2">
              <span className="text-xl">💡</span>
              <span>最適化の提案: 不要なインデックスを整理できます</span>
            </div>
            <p className="text-sm opacity-80 mb-3 ml-7">
              <strong>効果:</strong> リストの書き込み負荷を軽減し、インデックス制限（20個）を節約します。
            </p>
            <ul className="space-y-2 ml-7">
              {deletionCandidates.map((f) => (
                <li key={f.internalName} className="text-sm bg-white p-3 rounded-md border border-blue-100 shadow-sm text-gray-600">
                  <div className="font-bold text-gray-800">{f.displayName} ({f.internalName})</div>
                  <div className="text-gray-500 text-xs mt-1 leading-relaxed">
                    <span className="font-bold">{f.typeAsString}型のため削除可能です:</span> {f.deletionReason}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
        ※ この提案は <code>docs/product/principles.md</code> (原則) に基づき、運用環境の健全性を維持するために自動計算されています。
      </div>

      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};
