import React, { useCallback, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import { usePersisted } from './usePersisted';
import { CopyButton } from './CopyButton';
import { INPUT, BTN, RESULT } from './spDevPanelStyles';

export function PostTab({ 
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
