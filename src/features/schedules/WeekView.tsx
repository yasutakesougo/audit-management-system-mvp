import { useMemo } from 'react';
import { makeRange, useSchedules } from './useSchedules';

const startOfWeek = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const diff = (day + 6) % 7; // Monday start
  next.setDate(next.getDate() - diff);
  return next;
};

const endOfWeek = (start: Date): Date => {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
};

const formatTime = (iso: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

export default function WeekView() {
  const range = useMemo(() => {
    const start = startOfWeek(new Date());
    return makeRange(start, endOfWeek(start));
  }, []);
  const { items, loading } = useSchedules(range);

  return (
    <div data-testid="schedule-week-view" className="space-y-3">
      <header className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
        <span>今週の予定</span>
        <span>
          {new Date(range.from).toLocaleDateString()} – {new Date(range.to).toLocaleDateString()}
        </span>
      </header>
      {loading ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          予定を読み込み中…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
          今週の予定はまだありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="schedule-week-list">
          {items.map((item) => (
            <li
              key={item.id}
              data-testid="schedule-item"
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
    </div>
  );
}
