import * as React from 'react';
import { useDailyOpsSignals } from '@/features/dailyOps/data/useDailyOpsSignals';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export function DailyOpsSignalsSmokeTest(): JSX.Element {
  const date = todayIso();
  const { data, isLoading, error, upsert } = useDailyOpsSignals(date);

  const onCreateOrUpdate = async () => {
    await upsert.mutateAsync({
      date,
      targetType: 'User',
      targetId: 'U012',
      kind: 'EarlyLeave',
      time: '11:00',
      summary: 'Test signal',
      status: 'Active',
      source: 'Phone',
      title: '[Test] U012 EarlyLeave 11:00',
    });
  };

  const onResolve = async () => {
    // 直近の1件をResolvedにしてみる（存在しない場合は何もしない）
    const first = data?.[0];
    if (!first) return;
    await upsert.mutateAsync({
      date: first.date,
      targetType: first.targetType,
      targetId: first.targetId,
      kind: first.kind,
      time: first.time,
      summary: first.summary,
      status: 'Resolved',
      source: first.source,
      title: first.title,
    });
  };

  return (
    <div style={{ padding: 12 }}>
      <h3>DailyOpsSignals Smoke Test</h3>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={onCreateOrUpdate} disabled={upsert.isPending}>
          Upsert (U012 EarlyLeave 11:00)
        </button>
        <button onClick={onResolve} disabled={upsert.isPending}>
          Resolve latest
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <div>date: {date}</div>
        <div data-testid="dailyops-count">Count: {data?.length ?? 0}</div>
        {isLoading && <div>Loading...</div>}
        {error && <pre style={{ whiteSpace: 'pre-wrap', color: 'red' }}>{String(error)}</pre>}
        <pre
          data-testid="dailyops-json"
          style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', backgroundColor: '#f5f5f5' }}
        >
          {JSON.stringify(data ?? [], null, 2)}
        </pre>
      </div>
    </div>
  );
}
