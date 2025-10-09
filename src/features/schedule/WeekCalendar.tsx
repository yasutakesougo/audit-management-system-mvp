import { useMemo } from 'react';
import type { ScheduleForm, ScheduleStatus } from './types';

export const getWeekRange = (input: Date): { start: Date; end: Date } => {
	const base = new Date(input);
	base.setHours(0, 0, 0, 0);
	const day = base.getDay();
	const diffToMonday = (day + 6) % 7; // Sunday -> 6, Monday -> 0
	const start = new Date(base);
	start.setDate(base.getDate() - diffToMonday);
	const end = new Date(start);
	end.setDate(start.getDate() + 6);
	end.setHours(23, 59, 59, 999);
	return { start, end };
};

const HOURS = Array.from({ length: 12 }, (_, index) => 8 + index);
const HOUR_HEIGHT = 56; // px

const STATUS_STYLES: Record<ScheduleStatus, string> = {
	planned: 'bg-sky-100 border-sky-300 text-sky-900',
	confirmed: 'bg-emerald-100 border-emerald-300 text-emerald-900',
	absent: 'bg-amber-100 border-amber-300 text-amber-900',
	holiday: 'bg-pink-100 border-pink-300 text-pink-900',
};

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

const formatTime = (date: Date): string =>
	date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });

const slotLabel = (day: Date, hour: number): string => {
	const start = new Date(day);
	start.setHours(hour, 0, 0, 0);
	const end = new Date(start);
	end.setHours(start.getHours() + 1);
	return `${start.getMonth() + 1}月${start.getDate()}日 ${formatTime(start)} から ${formatTime(end)} の枠`;
};

const isSameDay = (a: Date, b: Date): boolean =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

type WeekCalendarProps = {
	weekStart: Date;
	items: ScheduleForm[];
	onSelectSlot(start: Date, end: Date): void;
	onSelectItem(item: ScheduleForm): void;
};

export function WeekCalendar({ weekStart, items, onSelectSlot, onSelectItem }: WeekCalendarProps) {
	const days = useMemo<Date[]>(() => {
		const start = new Date(weekStart);
		start.setHours(0, 0, 0, 0);
		return Array.from({ length: 7 }, (_, offset) => {
			const date = new Date(start);
			date.setDate(start.getDate() + offset);
			return date;
		});
	}, [weekStart]);

		const rangeItems = useMemo<ScheduleForm[]>(() =>
			items
			.map((item) => ({ ...item }))
					.filter((item) => {
						const startDate = new Date(item.start);
						return days.some((day: Date) => isSameDay(day, startDate));
					}),
	[items, days]);

	const templateColumns = '80px repeat(7, minmax(0, 1fr))';
	const columnHeight = HOUR_HEIGHT * HOURS.length;

	return (
		<div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm" role="grid" aria-label="週次スケジュール">
			<div
				className="grid border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700"
				style={{ gridTemplateColumns: templateColumns }}
			>
				<div className="sticky left-0 z-10 border-r border-slate-200 px-3 py-3 text-xs uppercase tracking-wide text-slate-500">
					時間
				</div>
			{days.map((day: Date, index: number) => {
					const weekday = WEEKDAY_LABELS[index];
					const label = `${day.getMonth() + 1}/${day.getDate()} (${weekday})`;
					return (
						<div
							key={day.toISOString()}
							className="border-r border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-800"
						>
							<span aria-hidden="true">{label}</span>
							<span className="sr-only">{`${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日 (${weekday})`}</span>
						</div>
					);
				})}
			</div>

			<div className="grid" style={{ gridTemplateColumns: templateColumns }} role="rowgroup">
				<div className="relative border-r border-slate-200">
					{HOURS.map((hour) => (
						<div key={hour} className="flex h-14 items-start justify-end border-b border-slate-100 pr-2 text-xs text-slate-500">
							{`${String(hour).padStart(2, '0')}:00`}
						</div>
					))}
				</div>

						{days.map((day: Date) => {
							  const dayItems = rangeItems.filter((item: ScheduleForm) => isSameDay(new Date(item.start), day));
					return (
						<div
							key={`col:${day.toISOString()}`}
							className="relative border-r border-slate-200"
							style={{ minHeight: columnHeight }}
							role="presentation"
						>
							{HOURS.map((hour) => {
								const slotStart = new Date(day);
								slotStart.setHours(hour, 0, 0, 0);
								const slotEnd = new Date(slotStart);
								slotEnd.setHours(slotStart.getHours() + 1);
								return (
									  <button
										type="button"
										key={`${day.toISOString()}-${hour}`}
										className="group relative flex h-14 w-full items-start border-b border-slate-100 px-2 text-left text-xs text-slate-500 transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
										onClick={() => onSelectSlot(slotStart, slotEnd)}
										aria-label={slotLabel(day, hour)}
									>
										<span className="sr-only">空き枠を追加</span>
									</button>
								);
							})}

											{dayItems.map((item) => {
								const startDate = new Date(item.start);
								const endDate = new Date(item.end);
								const startHour = startDate.getHours() + startDate.getMinutes() / 60;
								const endHour = endDate.getHours() + endDate.getMinutes() / 60;
								const top = clamp((startHour - HOURS[0]) * HOUR_HEIGHT, 0, columnHeight);
								const rawHeight = (endHour - startHour) * HOUR_HEIGHT;
								const height = clamp(rawHeight, HOUR_HEIGHT / 2, columnHeight - top);
								const label = `${item.title ?? '予定'}: ${formatTime(startDate)} から ${formatTime(endDate)}`;
								const statusClass = STATUS_STYLES[item.status] ?? STATUS_STYLES.planned;

												const baseClass = 'absolute left-1 right-1 flex flex-col rounded-md border px-2 py-1 text-left text-xs shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';
												const className = `${baseClass} ${statusClass}`;

												return (
													<button
														key={item.id ?? `${item.userId}-${item.start}`}
														type="button"
														className={className}
														style={{ top, height }}
														onClick={() => onSelectItem(item)}
														aria-label={label}
													>
														<span className="font-medium leading-tight">{item.title ?? '予定'}</span>
														<span className="text-[11px] text-slate-600">{`${formatTime(startDate)} – ${formatTime(endDate)}`}</span>
														{item.note ? (
															<span className="mt-1 line-clamp-2 text-[11px] text-slate-600">{item.note}</span>
														) : null}
													</button>
												);
							})}
						</div>
					);
				})}
			</div>
		</div>
	);
}

export default WeekCalendar;
