/**
 * ISP比較・更新エディタ — Page薄ラッパー
 * B層(hook) → A層(view) を接続するだけ
 */
import { useISPComparisonEditor } from '@/features/isp-editor/hooks/useISPComparisonEditor';
import ISPComparisonEditorView from '@/features/isp-editor/components/ISPComparisonEditorView';

export default function ISPComparisonEditorPage() {
  const { selectUser, save, ...rest } = useISPComparisonEditor();
  return <ISPComparisonEditorView {...rest} onSelectUser={selectUser} onSave={save} />;
}
