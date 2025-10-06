/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import Loading from '../../ui/components/Loading';
import ErrorState from '../../ui/components/ErrorState';
import { pushAudit } from '../../lib/audit';
import { useRecordsApi } from './api';
import { mapToRecordItem, RecordItem, SupportRecordInsertDTO, SupportRecordItem } from './types';

const RecordList: React.FC = () => {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SupportRecordInsertDTO>({ Title: '' });
  const { list, add } = useRecordsApi();

  const loadRecords = async () => {
    setLoading(true);
    try {
      const items = await list();
      const mapped: RecordItem[] = items.map(mapToRecordItem);
      setRecords(mapped);
      pushAudit({ actor: 'user', action: 'READ_LIST', entity: 'SupportRecord_Daily', channel: 'UI', after: { count: items.length } });
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecords(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const insert: SupportRecordInsertDTO = {
        Title: form.Title,
        cr013_recorddate: form.cr013_recorddate || undefined,
        cr013_specialnote: form.cr013_specialnote || undefined
      };
      const created: SupportRecordItem = await add(insert);
      setRecords(prev => [mapToRecordItem(created), ...prev]);
      pushAudit({
        actor: 'user',
        action: 'CREATE_SUCCESS',
        entity: 'SupportRecord_Daily',
        entity_id: String(created.Id),
        channel: 'UI',
        after: { item: created }
      });
      setForm({ Title: '' });
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <h2>日次記録</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="タイトル"
          value={form.Title}
          onChange={(e) => setForm({ ...form, Title: e.target.value })}
          required
          style={{ minWidth: 200, minHeight: 44, marginRight: 8 }}
        />
        <input
          type="date" aria-label="日付"
          value={form.cr013_recorddate || ''}
          onChange={(e) => setForm({ ...form, cr013_recorddate: e.target.value })}
          style={{ minWidth: 160, minHeight: 44, marginRight: 8 }}
        />
        <input
          type="text"
          placeholder="特記事項"
          value={form.cr013_specialnote || ''}
          onChange={(e) => setForm({ ...form, cr013_specialnote: e.target.value })}
          style={{ minWidth: 240, minHeight: 44, marginRight: 8 }}
        />
        <button type="submit" style={{ minHeight: 44 }}>新規記録追加</button>
      </form>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>タイトル</th>
            <th>記録日</th>
            <th>特記事項</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>{r.title}</td>
              <td>{r.recordDate}</td>
              <td>{r.specialNote}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecordList;
