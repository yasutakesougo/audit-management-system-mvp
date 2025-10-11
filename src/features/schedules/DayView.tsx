import { useMemo } from 'react';
import { makeRange, useSchedules } from './useSchedules';

const formatTime = (iso: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

export default function DayView() {
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
    <section data-testid="schedule-day-view" className="space-y-3">
      <header className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
        今日の予定
      </header>
      {loading ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          予定を読み込み中…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-600">
          今日の予定はありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="schedule-day-list">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-slate-200 bg-white px-4 py-3 text-left shadow-sm"
            >
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-600">
                {formatTime(item.start)} – {formatTime(item.end)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
