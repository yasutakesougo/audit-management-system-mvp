import { useCallback, useState } from 'react';
import { useSP } from '../lib/spClient';

type SharePointList = {
  Title: string;
  Id: string;
};

export default function SharePointListDebug() {
  const [lists, setLists] = useState<SharePointList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { spFetch } = useSP();

  const fetchLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await spFetch("/_api/web/lists?$select=Title,Id");
      const data = await response.json();
      setLists(data.value || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [spFetch]);

  const testComplianceList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await spFetch("/_api/web/lists/getbytitle('Compliance_CheckRules')/items?$top=5");
      const data = await response.json();
      console.log('Compliance_CheckRules items:', data.value);
      alert('コンプライアンスリストが正常に取得できました。コンソールを確認してください。');
    } catch (e) {
      console.error('Compliance list error:', e);
      setError(`コンプライアンスリストエラー: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [spFetch]);

  return (
    <div className="p-4 border border-gray-300 m-4 bg-gray-50">
      <h3 className="font-bold mb-2">SharePoint リスト デバッグ</h3>

      <div className="space-x-2 mb-4">
        <button
          onClick={fetchLists}
          disabled={loading}
          className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? '読み込み中...' : 'リスト一覧を取得'}
        </button>

        <button
          onClick={testComplianceList}
          disabled={loading}
          className="px-3 py-1 bg-green-500 text-white rounded disabled:opacity-50"
        >
          コンプライアンスリスト確認
        </button>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-100 border border-red-300 text-red-700 rounded">
          エラー: {error}
        </div>
      )}

      {lists.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">利用可能なリスト:</h4>
          <ul className="list-disc list-inside space-y-1">
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