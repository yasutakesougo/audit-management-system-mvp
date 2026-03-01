/**
 * ISP比較・更新エディタ — Page薄ラッパー
 * B層(hook) → A層(view) を接続するだけ
 * URL params: :userId (optional)
 */
import ISPComparisonEditorView from '@/features/isp-editor/components/ISPComparisonEditorView';
import { useISPComparisonEditor } from '@/features/isp-editor/hooks/useISPComparisonEditor';
import { useParams } from 'react-router-dom';

export default function ISPComparisonEditorPage() {
  const { userId } = useParams<{ userId?: string }>();
  const vm = useISPComparisonEditor({ userId });
  return <ISPComparisonEditorView {...vm} />;
}
