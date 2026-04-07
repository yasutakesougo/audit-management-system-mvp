import React from 'react';
import { useSpIndexCandidates } from './useSpIndexCandidates';
import { type IndexFieldSpec } from './spIndexKnownConfig';

interface Props {
  listName: string;
}

/**
 * SpIndexPressurePanel — インデックス不足（Pressure）を検知し、
 * 運用者に「今何をすべきか」を提示するパネル。
 * 
 * 原則に基づく設計：
 * 1. 現場導線主体: 難しい用語より「今すぐ直すべきか」を優先表示
 * 2. 判断の質向上: なぜ必要なのか（reason）を根拠として添える
 * 3. 組織知化: 誰が見ても同じ判断（追加/削除）ができる NextAction を提示
 */
export const SpIndexPressurePanel: React.FC<Props> = ({ listName }) => {
  const { 
    additionCandidates, 
    deletionCandidates, 
    loading, 
    error,
    hasKnownConfig 
  } = useSpIndexCandidates(listName);

  if (loading) return null; // 親の Loading と重なるため、パネル単体では静かに待機
  if (error) return <div className="p-4 text-red-500 font-bold border border-red-100 rounded-lg bg-red-50">⚠️ インデックス解析に失敗しました: {error}</div>;
  if (!hasKnownConfig) return null; 

  const hasUrgent = additionCandidates.length > 0;
  const hasOptimization = deletionCandidates.length > 0;

  if (!hasUrgent && !hasOptimization) return null;

  return (
    <div className="my-6 border rounded-lg bg-white shadow-sm overflow-hidden border-blue-100 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex items-center justify-between">
        <h3 className="font-bold text-blue-900 flex items-center gap-2">
           🛡️ インデックス最適化アドバイザー
        </h3>
        <span className="text-xs text-blue-600 bg-white px-2 py-1 rounded shadow-inner">
          対象: {listName}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Urgent Addition (Critical/Action Required) */}
        {hasUrgent && (
          <section className="bg-red-50 border border-red-200 rounded p-3">
            <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
              <span className="text-xl">🔴</span>
              <span>至急対応が必要: インデックスが不足しています</span>
            </div>
            <p className="text-sm text-red-600 mb-3 ml-7">
              <strong>リスク:</strong> 一部の画面で表示エラー（5,000件上限エラー）や大幅な速度低下が発生する恐れがあります。
            </p>
            <ul className="space-y-2 ml-7 mb-4">
              {additionCandidates.map((f: IndexFieldSpec) => (
                <li key={f.internalName} className="text-sm bg-white p-2 rounded border border-red-100 shadow-sm">
                  <div className="font-bold text-gray-800">{f.displayName} ({f.internalName})</div>
                  <div className="text-gray-500 text-xs mt-1">
                    <span className="font-semibold text-gray-700">必要理由:</span> {f.reason}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-2 ml-7 p-3 bg-white border border-red-200 rounded text-red-800 text-sm flex items-start gap-2">
               <span className="text-lg">👉</span>
               <div>
                  <strong>次アクション:</strong> SharePoint のリスト設定から「インデックス付きの列」を選択し、上記項目を追加（作成）してください。
               </div>
            </div>
          </section>
        )}

        {/* Optional Cleanup (Watch/Silent) */}
        {hasOptimization && (
          <section className="bg-blue-50 border border-blue-200 rounded p-3">
            <div className="flex items-center gap-2 text-blue-700 font-bold mb-2">
              <span className="text-xl">💡</span>
              <span>最適化の提案: 不要なインデックスを整理できます</span>
            </div>
            <p className="text-sm text-blue-600 mb-3 ml-7">
              <strong>効果:</strong> データの保存速度が向上し、SharePoint のインデックス制限枠（20個/リスト）を節約できます。
            </p>
            <ul className="space-y-2 ml-7">
              {deletionCandidates.map((f) => (
                <li key={f.internalName} className="text-sm bg-white p-2 rounded border border-blue-100 shadow-sm text-gray-600">
                  <div className="font-bold text-gray-700">{f.displayName} ({f.internalName})</div>
                  <div className="text-gray-500 text-xs mt-1">
                    <span className="font-semibold">{f.typeAsString}型であるため、現在は削除しても安全です:</span> {f.deletionReason}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
        ※ この提案は `docs/product/principles.md` (原則) に基づき、運用環境の健全性を維持するために自動計算されています。
      </div>
    </div>
  );
};
