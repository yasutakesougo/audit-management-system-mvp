import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ScheduleForm, ScheduleStatus } from './types';

type ScheduleDialogProps = {
	open: boolean;
	initial?: ScheduleForm;
	onClose(): void;
	onSubmit(values: ScheduleForm): Promise<void>;
};

const STATUS_LABELS: Record<ScheduleStatus, string> = {
	planned: '予定',
	confirmed: '確定',
	absent: '欠勤',
	holiday: '休暇',
};

const toLocalInputValue = (iso: string): string => {
	if (!iso) return '';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	const offset = date.getTimezoneOffset();
	const local = new Date(date.getTime() - offset * 60000);
	return local.toISOString().slice(0, 16);
};

const fromLocalInputValue = (value: string): string => {
	if (!value) return '';
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const defaultForm = (): ScheduleForm => {
	const start = new Date();
	start.setMinutes(0, 0, 0);
	const end = new Date(start);
	end.setHours(start.getHours() + 1);
	return {
		userId: '',
		status: 'planned',
		start: start.toISOString(),
		end: end.toISOString(),
		title: '',
		note: '',
	};
};

const focusSelector = [
	'a[href]',
	'button:not([disabled])',
	'textarea:not([disabled])',
	'input:not([type="hidden"]):not([disabled])',
	'select:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusableElements = (root: HTMLElement | null): HTMLElement[] => {
	if (!root) return [];
	return Array.from(root.querySelectorAll<HTMLElement>(focusSelector));
};

const cloneForm = (input: ScheduleForm): ScheduleForm => ({
	id: input.id,
	userId: input.userId ?? '',
	title: input.title ?? '',
	note: input.note ?? '',
	status: input.status ?? 'planned',
	start: input.start,
	end: input.end,
});

export function ScheduleDialog({ open, initial, onClose, onSubmit }: ScheduleDialogProps) {
	const [form, setForm] = useState<ScheduleForm>(() => cloneForm(defaultForm()));
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const headingId = useId();

	useEffect(() => {
		if (!open) return;
		const payload = initial ? cloneForm(initial) : cloneForm(defaultForm());
		setForm(payload);
		setSubmitting(false);
		setSubmitError(null);
	}, [open, initial]);

	useEffect(() => {
		if (!open) return;
		const container = containerRef.current;
		const previous = document.activeElement as HTMLElement | null;
		const focusables = getFocusableElements(container);
		focusables[0]?.focus();
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		const handleKeyDown = (event: KeyboardEvent) => {
			if (!container?.contains(event.target as Node)) {
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
				return;
			}
			if (event.key === 'Tab') {
				const elements = getFocusableElements(container);
				if (elements.length === 0) {
					event.preventDefault();
					return;
				}
				const first = elements[0];
				const last = elements[elements.length - 1];
				const active = document.activeElement as HTMLElement | null;

				if (event.shiftKey) {
					if (!active || active === first) {
						last.focus();
						event.preventDefault();
					}
				} else if (active === last) {
					first.focus();
					event.preventDefault();
				}
			}
		};

		document.addEventListener('keydown', handleKeyDown, true);

		return () => {
			document.removeEventListener('keydown', handleKeyDown, true);
			document.body.style.overflow = originalOverflow;
			previous?.focus();
		};
	}, [open, onClose]);

	const timeValidation = useMemo(() => {
		const startMs = new Date(form.start).getTime();
		const endMs = new Date(form.end).getTime();
		if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
			return '開始と終了の日時を入力してください。';
		}
		if (endMs <= startMs) {
			return '終了時刻は開始時刻より後に設定してください。';
		}
		return null;
	}, [form.start, form.end]);

		const handleChange = (field: keyof ScheduleForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
		const value = event.target.value;
			setForm((prev: ScheduleForm) => ({
			...prev,
			[field]: field === 'start' || field === 'end' ? fromLocalInputValue(value) : value,
		}));
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (timeValidation) {
			return;
		}
		setSubmitting(true);
		setSubmitError(null);
		try {
			await onSubmit(form);
			onClose();
		} catch (error) {
			const message = (error as { userMessage?: string; message?: string } | null)?.userMessage || (error as Error | null)?.message || '保存に失敗しました。';
			setSubmitError(message);
			setSubmitting(false);
		}
	};

	if (!open) {
		return null;
	}

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation">
			<div
				ref={containerRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={headingId}
				className="w-full max-w-xl rounded-lg bg-white shadow-xl focus:outline-none"
			>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
					<header className="flex items-center justify-between">
						<h2 id={headingId} className="text-lg font-semibold text-slate-900">
							{form.id ? '予定を編集' : '予定を作成'}
						</h2>
						<button
							type="button"
							onClick={onClose}
							className="rounded-md px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
						>
							閉じる
						</button>
					</header>

					{submitError ? (
						<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
							{submitError}
						</div>
					) : null}

					<div className="grid grid-cols-1 gap-4">
						<label className="flex flex-col gap-1 text-sm text-slate-700">
							利用者 ID
							<input
								type="text"
								value={form.userId}
								onChange={handleChange('userId')}
								required
								className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
							/>
						</label>

						<label className="flex flex-col gap-1 text-sm text-slate-700">
							ステータス
							<select
								value={form.status}
								onChange={handleChange('status')}
								className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
							>
								{(Object.keys(STATUS_LABELS) as ScheduleStatus[]).map((status) => (
									<option key={status} value={status}>
										{STATUS_LABELS[status]}
									</option>
								))}
							</select>
						</label>

						<div className="grid gap-4 md:grid-cols-2">
							<label className="flex flex-col gap-1 text-sm text-slate-700">
								開始
								<input
									type="datetime-local"
									value={toLocalInputValue(form.start)}
									onChange={handleChange('start')}
									required
									className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
								/>
							</label>

							<label className="flex flex-col gap-1 text-sm text-slate-700">
								終了
								<input
									type="datetime-local"
									value={toLocalInputValue(form.end)}
									onChange={handleChange('end')}
									required
									aria-invalid={Boolean(timeValidation)}
									className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
								/>
							</label>
						</div>
						{timeValidation ? (
							<p className="text-sm text-red-600" role="alert">
								{timeValidation}
							</p>
						) : null}

						<label className="flex flex-col gap-1 text-sm text-slate-700">
							タイトル
							<input
								type="text"
								value={form.title ?? ''}
								onChange={handleChange('title')}
								placeholder="予定名"
								className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
							/>
						</label>

						<label className="flex flex-col gap-1 text-sm text-slate-700">
							メモ
							<textarea
								value={form.note ?? ''}
								onChange={handleChange('note')}
								rows={4}
								className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
							/>
						</label>
					</div>

					<footer className="flex items-center justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
						>
							キャンセル
						</button>
						<button
							type="submit"
							disabled={submitting || Boolean(timeValidation)}
							className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition enabled:hover:bg-indigo-700 enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-offset-2 enabled:focus-visible:outline-indigo-500 disabled:opacity-50"
						>
							{submitting ? '保存中…' : '保存'}
						</button>
					</footer>
				</form>
			</div>
		</div>,
		document.body
	);
}

export default ScheduleDialog;
