import { useScheduleUserOptions } from '@/features/schedules/useScheduleUserOptions';
import type { ScheduleUserOption } from '@/features/schedules/ScheduleCreateDialog';
import { SERVICE_TYPE_LABELS } from '@/sharepoint/serviceTypes';
import { useStaff } from '@/stores/useStaff';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import type { SelectChangeEvent } from '@mui/material/Select';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { checkScheduleConflicts, getConflictSeverity, type ConflictCheck } from './conflictChecker';
import type { Category, DayPart, ExtendedScheduleForm, PersonType, Schedule, ScheduleForm, ScheduleOrg, ScheduleStaff, ScheduleStatus, ServiceType } from './types';
import { laneLabels } from './views/TimelineWeek';

type StaffOption = {
	id: string;
	name: string;
	label: string;
};

type ScheduleDialogProps = {
	open: boolean;
	initial?: ExtendedScheduleForm;
	existingSchedules?: Schedule[];
	onClose(): void;
	onSubmit(values: ExtendedScheduleForm): Promise<void>;
	// ★追加: 強制カテゴリモード（optional）
	forcedCategory?: Category;
	// ★追加: カテゴリ選択 UI を非表示にする
	hideCategorySelect?: boolean;
};

const STATUS_LABELS: Record<ScheduleStatus, string> = {
	planned: '予定',
	confirmed: '確定',
	absent: '欠勤',
	holiday: '休暇',
};

// Helper function for date-time local input formatting
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

const defaultForm = (): ExtendedScheduleForm => {
	const start = new Date();
	start.setMinutes(0, 0, 0);
	const end = new Date(start);
	end.setHours(start.getHours() + 1);
	return {
		category: 'User', // デフォルトは利用者
		status: 'planned',
		start: start.toISOString(),
		end: end.toISOString(),
		title: '',
		note: '',
		allDay: false,
		location: '',
		// User defaults
		userId: '',
		userLookupId: undefined,
		serviceType: 'absence',
		personType: 'Internal',
		// Staff defaults
		staffIds: [],
		// Org defaults
		subType: '会議',
		audience: [],
	};
};

const cloneForm = (input: ExtendedScheduleForm): ExtendedScheduleForm => ({
	id: input.id,
	category: input.category ?? 'User',
	title: input.title ?? '',
	note: input.note ?? '',
	status: input.status ?? 'planned',
	start: input.start,
	end: input.end,
	allDay: input.allDay ?? false,
	location: input.location ?? '',
	// User fields
	userId: input.userId ?? '',
	userLookupId: input.userLookupId,
	serviceType: input.serviceType ?? 'absence',
	personType: input.personType ?? 'Internal',
	personId: input.personId,
	personName: input.personName,
	externalPersonName: input.externalPersonName,
	externalPersonOrg: input.externalPersonOrg,
	externalPersonContact: input.externalPersonContact,
	// Staff fields
	staffIds: input.staffIds ?? [],
	staffNames: input.staffNames,
	dayPart: input.dayPart,
	// Org fields
	subType: input.subType ?? '会議',
	audience: input.audience ?? [],
	resourceId: input.resourceId,
	externalOrgName: input.externalOrgName,
});

export function ScheduleDialog({ open, initial, existingSchedules = [], onClose, onSubmit, forcedCategory, hideCategorySelect }: ScheduleDialogProps) {
	const [form, setForm] = useState<ExtendedScheduleForm>(() => cloneForm(defaultForm()));
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const { data: staffData, loading: staffLoading, error: staffError } = useStaff();
	const scheduleUserOptions = useScheduleUserOptions();
	const [userInputValue, setUserInputValue] = useState('');

	const staffOptions = useMemo<StaffOption[]>(() => {
		if (!Array.isArray(staffData)) return [];
		return staffData
			.filter((item) => item && (item.id != null || item.staffId))
			.map((item) => {
				const numericId = item.id != null ? String(item.id) : String(item.staffId ?? '').trim();
				const readableName = item.name?.trim() ?? '';
				const secondary = item.staffId?.trim() ?? numericId;
				const labelParts = [readableName || secondary];
				if (readableName && secondary && secondary !== readableName) {
					labelParts.push(`(${secondary})`);
				}
				return {
					id: numericId,
					name: readableName || secondary,
					label: labelParts.join(' '),
				};
			})
			.filter((option, index, array) => option.id.length > 0 && array.findIndex((candidate) => candidate.id === option.id) === index)
			.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
	}, [staffData]);

	const staffOptionMap = useMemo(() => {
		const map = new Map<string, StaffOption>();
		for (const option of staffOptions) {
			map.set(option.id, option);
		}
		return map;
	}, [staffOptions]);

	// カテゴリ別の候補配列（UIに表示する順序）
	const USER_SERVICE_TYPE_VALUES: readonly ServiceType[] = ['absence', 'late', 'earlyLeave', 'other'];

	const STAFF_SUBTYPE_VALUES: readonly ScheduleStaff['subType'][] = ['年休', '研修', '会議', 'その他'];

	const ORG_SUBTYPE_VALUES: readonly ScheduleOrg['subType'][] = ['外部団体利用', '会議', '研修', '余暇イベント', 'その他'];

	const selectedStaffOptions = useMemo<StaffOption[]>(() => {
		const ids = Array.isArray(form.staffIds) ? form.staffIds : [];
		return ids.map((raw) => {
			const key = String(raw);
			return staffOptionMap.get(key) ?? { id: key, name: key, label: key };
		});
	}, [form.staffIds, staffOptionMap]);

	const selectedUserOption = useMemo<ScheduleUserOption | null>(() => {
		const trimmed = form.userId?.trim();
		if (trimmed) {
			const matched = scheduleUserOptions.find((option) => option.id === trimmed);
			if (matched) return matched;
		}
		if (form.userLookupId) {
			const matched = scheduleUserOptions.find((option) => option.lookupId === form.userLookupId);
			if (matched) return matched;
		}
		return null;
	}, [form.userId, form.userLookupId, scheduleUserOptions]);

	const userFieldValue: ScheduleUserOption | string | null = selectedUserOption ?? (form.userId?.trim() ? form.userId.trim() : null);

	// 競合チェック
	const conflictCheck = useMemo((): ConflictCheck => {
		if (!form.start || !form.end) {
			return { hasConflict: false, conflicts: [] };
		}
		// 一時的にScheduleFormにキャスト（競合チェック関数の制限のため）
		const tempForm = {
			...form,
			userId: form.userId ?? '',
		} as ScheduleForm;
		return checkScheduleConflicts(tempForm, existingSchedules, form.id?.toString());
	}, [form, existingSchedules]);

	// Update form when dialog opens with initial data
	useEffect(() => {
		if (!open) return;
		const payload = initial ? cloneForm(initial) : cloneForm(defaultForm());
		// ★カテゴリ固定モードがあれば上書き
		if (forcedCategory) {
			payload.category = forcedCategory;
		}
		setForm(payload);
		setSubmitting(false);
		setSubmitError(null);
	}, [open, initial, forcedCategory]);

	useEffect(() => {
		if (!open) return;
		if (selectedUserOption) {
			setUserInputValue(selectedUserOption.name);
			return;
		}
		setUserInputValue(form.userId ?? '');
	}, [open, selectedUserOption, form.userId]);

	// Time validation
	const timeValidation = useMemo(() => {
		if (!form.start || !form.end) return null;
		const startTime = new Date(form.start).getTime();
		const endTime = new Date(form.end).getTime();
		if (endTime <= startTime) {
			return '終了時刻は開始時刻より後に設定してください。';
		}
		return null;
	}, [form.start, form.end]);

	const handleChange = useCallback((field: keyof ExtendedScheduleForm) => (
		event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		const value = event.target.value;
		setForm((prev) => ({
			...prev,
			[field]: field === 'start' || field === 'end' ? fromLocalInputValue(value) : value,
		}));
	}, []);

	const handleManualStaffInput = useCallback((event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const value = event.target.value;
		const ids = value
			.split(/[,\s\u3001\uFF0C]+/)
			.map((part) => part.trim())
			.filter((part) => part.length > 0);
		setForm((prev) => ({
			...prev,
			staffIds: ids,
			staffNames: ids,
		}));
	}, []);

	const handleStaffSelect = useCallback((_: unknown, next: StaffOption[]) => {
		setForm((prev) => ({
			...prev,
			staffIds: next.map((option) => option.id),
			staffNames: next.map((option) => option.name),
		}));
	}, []);

	const handleUserOptionChange = useCallback((_: unknown, value: ScheduleUserOption | string | null) => {
		if (typeof value === 'string') {
			const trimmed = value.trim();
			setForm((prev) => ({
				...prev,
				userId: trimmed,
				userLookupId: undefined,
				personId: trimmed || prev.personId,
			}));
			return;
		}
		if (value) {
			setForm((prev) => ({
				...prev,
				userId: value.id,
				userLookupId: value.lookupId ?? prev.userLookupId,
				personId: value.id,
				personName: prev.personType === 'Internal'
					? (prev.personName && prev.personName.trim().length > 0 ? prev.personName : value.name)
					: prev.personName,
			}));
			setUserInputValue(value.name);
			return;
		}
		setForm((prev) => ({
			...prev,
			userId: '',
			userLookupId: undefined,
			personId: '',
		}));
		setUserInputValue('');
	}, []);

	const handleUserInputChange = useCallback((_: unknown, value: string) => {
		setUserInputValue(value);
	}, []);
	const handleStatusChange = useCallback((event: SelectChangeEvent<ScheduleStatus>) => {
		const value = event.target.value as ScheduleStatus;
		setForm((prev) => ({ ...prev, status: value }));
	}, []);

	const handleCategoryChange = useCallback((event: SelectChangeEvent<Category>) => {
		// カテゴリ固定モードなら変更させない
		if (forcedCategory) return;
		const category = event.target.value as Category;
		setForm((prev) => {
			// カテゴリ変更時にデフォルト値をセット
			const base = { ...prev, category };

			if (category === 'User') {
				return {
					...base,
					userId: prev.userId || '',
					serviceType: prev.serviceType || 'absence',
					personType: prev.personType || 'Internal',
				};
			} else if (category === 'Staff') {
				return {
					...base,
					staffIds: prev.staffIds || [],
					subType: prev.subType || '会議',
				};
			} else if (category === 'Org') {
				return {
					...base,
					subType: prev.subType || '会議',
					audience: prev.audience || [],
				};
			}
			return base;
		});
	}, [forcedCategory]);

	const hasConflictError = conflictCheck.hasConflict &&
		conflictCheck.conflicts.some(c => getConflictSeverity(c.reason) === 'error');
	const hasConflictWarning = conflictCheck.hasConflict &&
		conflictCheck.conflicts.some(c => getConflictSeverity(c.reason) === 'warning');

	const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
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
			const message = (error as { userMessage?: string; message?: string } | null)?.userMessage
				|| (error as Error | null)?.message
				|| '保存に失敗しました。';
			setSubmitError(message);
			setSubmitting(false);
		}
	}, [form, timeValidation, hasConflictError, onSubmit, onClose]);

	const handleClose = useCallback(() => {
		if (submitting) return;
		onClose();
	}, [submitting, onClose]);


	const staffSelectionRequired = form.category === 'User';
	const staffSelectionMissing = staffSelectionRequired && (!form.staffIds || form.staffIds.length === 0);

	return (
		<Dialog
			open={open}
			onClose={handleClose}
			maxWidth="md"
			fullWidth
			scroll="body"
			PaperProps={{
				sx: { borderRadius: 2 }
			}}
		>
			<form onSubmit={handleSubmit}>
				<DialogTitle sx={{ pb: 1 }}>
					<Stack direction="row" alignItems="center" spacing={1}>
						<Typography variant="h6" component="span">
							{form.id ? '予定を編集' : '予定を作成'}
						</Typography>
					</Stack>
				</DialogTitle>

				<DialogContent dividers>
					<Stack spacing={3}>
						{submitError && (
							<Alert severity="error" variant="outlined">
								{submitError}
							</Alert>
						)}

						{conflictCheck.hasConflict && (
							<Alert
								severity={hasConflictError ? "error" : "warning"}
								variant="outlined"
								icon={<WarningAmberRoundedIcon />}
							>
								<Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
									スケジュール競合が検出されました
								</Typography>
								<Box component="ul" sx={{ m: 0, pl: 2 }}>
									{conflictCheck.conflicts.map((conflict, index) => {
										const severity = getConflictSeverity(conflict.reason);
										return (
											<Box component="li" key={index} sx={{ mb: 0.5 }}>
												<Typography variant="body2" sx={{ fontWeight: 500 }}>
													{conflict.schedule.title}
												</Typography>
												<Typography variant="caption" display="block">
													{new Date(conflict.schedule.start).toLocaleString('ja-JP', {
														month: 'short', day: 'numeric',
														hour: '2-digit', minute: '2-digit'
													})} - {new Date(conflict.schedule.end).toLocaleString('ja-JP', {
														hour: '2-digit', minute: '2-digit'
													})}
												</Typography>
												<Typography
													variant="caption"
													color={severity === 'error' ? 'error' : severity === 'warning' ? 'warning.main' : 'info.main'}
													sx={{ fontWeight: 500 }}
												>
													{conflict.message}
												</Typography>
											</Box>
										);
									})}
								</Box>
							</Alert>
						)}

						{!hideCategorySelect && !forcedCategory && (
						<FormControl fullWidth>
							<InputLabel>カテゴリ</InputLabel>
							<Select
								value={form.category}
								label="カテゴリ"
								onChange={handleCategoryChange}
							>
								{Object.entries(laneLabels).map(([category, config]) => {
									const IconComponent = config.icon;
									return (
										<MenuItem key={category} value={category}>
											<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
												<IconComponent sx={{ fontSize: 18, color: `${config.color}.main` }} />
												<Typography>{config.label.replace('レーン', '').replace('イベント', '')}</Typography>
											</Box>
										</MenuItem>
									);
								})}
							</Select>
						</FormControl>
						)}

						{/* カテゴリ別フィールド */}
						{form.category === 'User' && (
							<>
								<Autocomplete<ScheduleUserOption, false, false, true>
									freeSolo
									options={scheduleUserOptions}
									value={userFieldValue}
									inputValue={userInputValue}
									onInputChange={handleUserInputChange}
									onChange={handleUserOptionChange}
									getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
									isOptionEqualToValue={(option, value) => {
										if (typeof value === 'string') {
											return option.id === value || option.name === value;
										}
										return option.id === value.id;
									}}
									renderInput={(params) => (
										<TextField
											{...params}
											label="利用者"
											required
											placeholder="氏名で検索"
											inputProps={{
												...params.inputProps,
												'aria-label': '利用者の選択',
											}}
											helperText="利用者コードは保存後に自動採番されます"
										/>
									)}
								/>
								<FormControl fullWidth>
									<InputLabel>サービス種別</InputLabel>
									<Select
										value={form.serviceType || 'absence'}
										label="サービス種別"
										onChange={(e) => setForm(prev => ({ ...prev, serviceType: e.target.value as ServiceType }))}
									>
										{USER_SERVICE_TYPE_VALUES.map((value) => (
											<MenuItem key={value} value={value}>
												{SERVICE_TYPE_LABELS[value] ?? String(value)}
											</MenuItem>
										))}
									</Select>
								</FormControl>
								<FormControl fullWidth>
									<InputLabel>利用者タイプ</InputLabel>
									<Select
										value={form.personType || 'Internal'}
										label="利用者タイプ"
										onChange={(e) => setForm(prev => ({ ...prev, personType: e.target.value as PersonType }))}
									>
										<MenuItem value="Internal">内部利用者</MenuItem>
										<MenuItem value="External">外部利用者</MenuItem>
									</Select>
								</FormControl>
								{form.personType === 'Internal' ? (
									<>
										<TextField
											label="利用者名"
											value={form.personName || ''}
											onChange={handleChange('personName')}
											fullWidth
											placeholder="山田太郎"
										/>
									</>
								) : (
									<>
										<TextField
											label="外部利用者名"
											value={form.externalPersonName || ''}
											onChange={handleChange('externalPersonName')}
											fullWidth
											placeholder="外部利用者名"
										/>
										<TextField
											label="外部団体名"
											value={form.externalPersonOrg || ''}
											onChange={handleChange('externalPersonOrg')}
											fullWidth
											placeholder="団体名"
										/>
										<TextField
											label="連絡先"
											value={form.externalPersonContact || ''}
											onChange={handleChange('externalPersonContact')}
											fullWidth
											placeholder="電話番号やメールアドレス"
										/>
									</>
								)}

								{(!staffLoading && staffOptions.length === 0) ? (
									<TextField
										label="担当職員ID (カンマ区切り)"
										value={(form.staffIds ?? []).join(',')}
										onChange={handleManualStaffInput}
										fullWidth
										placeholder="1,2,3"
										helperText={staffError ? '職員情報の取得に失敗しました。IDを直接入力してください。' : '担当職員を入力してください (複数可)'}
										error={Boolean(staffError) || staffSelectionMissing}
									/>
								) : (
									<Autocomplete
										multiple
										options={staffOptions}
										value={selectedStaffOptions}
										onChange={handleStaffSelect}
										disableCloseOnSelect
										loading={staffLoading}
										isOptionEqualToValue={(option, value) => option.id === value.id}
										getOptionLabel={(option) => option.label}
										renderTags={(value, getTagProps) =>
											value.map((option, index) => (
												<Chip
													{...getTagProps({ index })}
													key={option.id}
													label={option.label}
												/>
											))
										}
										renderInput={(params) => (
											<TextField
												{...params}
												label="担当職員"
												placeholder="担当職員を選択"
												helperText={staffError ? '職員情報の取得に失敗しました。検索できない場合はIDを直接入力してください。' : '担当職員を1名以上選択してください'}
												error={Boolean(staffError) || staffSelectionMissing}
												InputProps={{
													...params.InputProps,
													endAdornment: (
														<>
															{staffLoading ? <CircularProgress color="inherit" size={16} sx={{ mr: 1 }} /> : null}
															{params.InputProps.endAdornment}
														</>
													),
												}}
											/>
										)}
									/>
								)}
							</>
						)}

						{form.category === 'Staff' && (
							<>
								<TextField
									label="職員ID (カンマ区切りで複数可)"
									value={(form.staffIds ?? []).join(',')}
									onChange={handleManualStaffInput}
									fullWidth
									placeholder="S-001,S-002"
									helperText="複数の職員IDをカンマで区切って入力してください"
								/>
								<FormControl fullWidth>
									<InputLabel>サブタイプ</InputLabel>
									<Select
										value={form.subType || '会議'}
										label="サブタイプ"
										onChange={(e) => setForm(prev => ({ ...prev, subType: e.target.value }))}
									>
										{STAFF_SUBTYPE_VALUES.map((v) => (
											<MenuItem key={v} value={v}>{v}</MenuItem>
										))}
									</Select>
								</FormControl>
								{form.subType === '年休' && (
									<FormControl fullWidth>
										<InputLabel>時間帯</InputLabel>
										<Select
											value={form.dayPart || 'Full'}
											label="時間帯"
											onChange={(e) => setForm(prev => ({ ...prev, dayPart: e.target.value as DayPart }))}
										>
											<MenuItem value="Full">終日</MenuItem>
											<MenuItem value="AM">午前</MenuItem>
											<MenuItem value="PM">午後</MenuItem>
										</Select>
									</FormControl>
								)}
							</>
						)}

						{form.category === 'Org' && (
							<>
								<FormControl fullWidth>
									<InputLabel>イベントタイプ</InputLabel>
									<Select
										value={form.subType || '会議'}
										label="イベントタイプ"
										onChange={(e) => setForm(prev => ({ ...prev, subType: e.target.value }))}
									>
										{ORG_SUBTYPE_VALUES.map((v) => (
											<MenuItem key={v} value={v}>{v}</MenuItem>
										))}
									</Select>
								</FormControl>
								{form.subType === '外部団体利用' && (
									<TextField
										label="外部団体名"
										value={form.externalOrgName || ''}
										onChange={handleChange('externalOrgName')}
										fullWidth
										placeholder="さつき会、パレットクラブなど"
									/>
								)}
								<TextField
									label="対象者 (カンマ区切り)"
									value={form.audience?.join(',') || ''}
									onChange={(e) => setForm(prev => ({
										...prev,
										audience: e.target.value.split(',').filter(item => item.trim())
									}))}
									fullWidth
									placeholder="全職員,看護,生活介護"
									helperText="対象者をカンマで区切って入力してください"
								/>
								<TextField
									label="リソースID"
									value={form.resourceId || ''}
									onChange={handleChange('resourceId')}
									fullWidth
									placeholder="プレイルーム、会議室Aなど"
									helperText="使用する部屋や設備を指定してください"
								/>
							</>
						)}

						<FormControl fullWidth>
							<InputLabel>ステータス</InputLabel>
							<Select
								value={form.status}
								label="ステータス"
								onChange={handleStatusChange}
							>
								{(Object.keys(STATUS_LABELS) as ScheduleStatus[]).map((status) => (
									<MenuItem key={status} value={status}>
										{STATUS_LABELS[status]}
									</MenuItem>
								))}
							</Select>
						</FormControl>

						<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
							<TextField
								label="開始日時"
								type="datetime-local"
								value={toLocalInputValue(form.start)}
								onChange={handleChange('start')}
								required
								fullWidth
								InputLabelProps={{ shrink: true }}
							/>
							<TextField
								label="終了日時"
								type="datetime-local"
								value={toLocalInputValue(form.end)}
								onChange={handleChange('end')}
								required
								fullWidth
								InputLabelProps={{ shrink: true }}
								error={Boolean(timeValidation)}
								helperText={timeValidation}
							/>
						</Stack>

						<TextField
							label="タイトル"
							value={form.title ?? ''}
							onChange={handleChange('title')}
							placeholder="予定名を入力"
							fullWidth
						/>

						<TextField
							label="場所"
							value={form.location ?? ''}
							onChange={handleChange('location')}
							placeholder="会議室、訪問先など"
							fullWidth
						/>

						<FormControl component="fieldset">
							<Box display="flex" alignItems="center">
								<input
									type="checkbox"
									id="allDay"
									checked={form.allDay ?? false}
									onChange={(e) => setForm(prev => ({ ...prev, allDay: e.target.checked }))}
									style={{ marginRight: 8 }}
								/>
								<label htmlFor="allDay">終日</label>
							</Box>
						</FormControl>

						<TextField
							label="メモ"
							value={form.note ?? ''}
							onChange={handleChange('note')}
							multiline
							rows={4}
							placeholder="詳細やメモを入力"
							fullWidth
						/>
					</Stack>
				</DialogContent>

				<DialogActions sx={{ px: 3, py: 2 }}>
					<Button
						onClick={handleClose}
						startIcon={<CloseRoundedIcon />}
						disabled={submitting}
					>
						キャンセル
					</Button>
					<Button
						type="submit"
						variant="contained"
						startIcon={<SaveRoundedIcon />}
						disabled={submitting || Boolean(timeValidation)}
						color={hasConflictError ? "error" : hasConflictWarning ? "warning" : "primary"}
					>
						{submitting
							? '保存中…'
							: hasConflictError
							? '競合を承知で保存'
							: hasConflictWarning
							? '注意して保存'
							: '保存'
						}
					</Button>
				</DialogActions>
			</form>
		</Dialog>
	);
}

export default ScheduleDialog;
