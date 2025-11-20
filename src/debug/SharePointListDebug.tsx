import { useCallback, useState } from 'react';
import { useSP } from '../lib/spClient';

type SharePointList = {
  Title: string;
  Id: string;
};

type ListsResponse = {
  value?: SharePointList[];
};

export default function SharePointListDebug() {
  const [lists, setLists] = useState<SharePointList[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { spFetch } = useSP();

  const fetchLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await spFetch("/_api/web/lists?$select=Title,Id");
      const data = (await (response as Response).json()) as ListsResponse;
      setLists(data.value ?? []);
      setMessage(`リスト件数: ${data.value?.length ?? 0} 件`);
    } catch (e) {
      setError(`リスト一覧取得エラー: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [spFetch]);

  const testComplianceList = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await spFetch("/_api/web/lists/getbytitle('Compliance_CheckRules')/items?$top=5");
      const data = await (response as Response).json();
      console.log('Compliance_CheckRules items:', data.value);
      setMessage(
        `コンプライアンスリスト OK: ${Array.isArray(data.value) ? data.value.length : 0} 件取得`
      );
    } catch (e) {
      console.error('Compliance list error:', e);
      setError(`コンプライアンスリストエラー: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [spFetch]);

  return (
    <div className="m-4 border border-gray-300 bg-gray-50 p-4">
      <h3 className="mb-2 font-bold">SharePoint リスト デバッグ</h3>

      <div className="mb-4 space-x-2">
        <button
          onClick={fetchLists}
          disabled={loading}
          className="rounded bg-blue-500 px-3 py-1 text-white disabled:opacity-50"
        >
          {loading ? '読み込み中...' : 'リスト一覧を取得'}
        </button>

        <button
          onClick={testComplianceList}
          disabled={loading}
          className="rounded bg-green-500 px-3 py-1 text-white disabled:opacity-50"
        >
          コンプライアンスリスト確認
        </button>
      </div>

      {message && (
        <div className="mb-2 rounded border border-blue-200 bg-blue-50 p-2 text-sm text-blue-900">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-100 p-2 text-sm text-red-700">
          エラー: {error}
        </div>
      )}

      {lists.length > 0 && (
        <div>
          <h4 className="mb-2 font-semibold">利用可能なリスト:</h4>
          <ul className="list-inside list-disc space-y-1">
            {lists.map((list) => (
              <li key={list.Id} className="text-sm">
                <strong>{list.Title}</strong> (ID: {list.Id})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}