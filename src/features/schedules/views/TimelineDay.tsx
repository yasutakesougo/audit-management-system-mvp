import { useMemo } from 'react';
import { makeRange, useSchedules } from '../useSchedules';

const formatTime = (iso: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

export default function TimelineDay() {
  const range = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return makeRange(start, end);
  }, []);
  const { items, loading } = useSchedules(range);

  return (
    <section data-testid="schedule-timeline-view" className="space-y-3">
      <header className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-2 text-sm font-medium text-indigo-700">
        タイムライン（デモ）
      </header>
      {loading ? (
        <p className="rounded-lg border border-dashed border-indigo-200 bg-white p-6 text-center text-indigo-600">
          予定を読み込み中…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-indigo-200 bg-white p-6 text-center text-indigo-600">
          表示できる予定がありません。
        </p>
      ) : (
        <ol className="space-y-3" data-testid="schedule-timeline-list">
          {items.map((item) => (
            <li key={item.id} className="relative pl-6">
              <span className="absolute left-0 top-2 h-3 w-3 rounded-full bg-indigo-400" />
              <div
                data-testid="schedule-item"
                className="rounded-md border border-indigo-200 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  {formatTime(item.start)} – {formatTime(item.end)}
                </p>
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
