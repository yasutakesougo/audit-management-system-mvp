/**
 * 現場記録ページ（強度行動障害／支援手順兼記録）のエントリーポイント。
 * ルーティング `/records/support-procedures` から本コンポーネントを参照し、
 * 実体は TimeFlowSupportRecordPage を委譲先とする。
 * （将来的に切り替えが必要になっても、外部参照は本エントリを固定するため安全）
 */
import TimeFlowSupportRecordPage from './TimeFlowSupportRecordPage';

// 実装本体は TimeFlowSupportRecordPage。ここは安定したエントリーポイントとして提供する。

export default function SupportProcedurePage() {
  return <TimeFlowSupportRecordPage />;
}
