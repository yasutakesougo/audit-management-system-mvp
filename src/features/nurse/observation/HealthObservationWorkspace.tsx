import { NURSE_USERS } from '@/features/nurse/users';
import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useObsWorkspaceParams, type WorkspaceTab } from './useObsWorkspaceParams';

const srOnly = {
	border: 0,
	clip: 'rect(0 0 0 0)',
	height: 1,
	width: 1,
	margin: -1,
	padding: 0,
	overflow: 'hidden',
	position: 'absolute' as const,
	whiteSpace: 'nowrap' as const,
};

const HealthObservationWorkspace: React.FC = () => {
	const { user, date, tab, set } = useObsWorkspaceParams();

	const userOptions = React.useMemo(
		() =>
			NURSE_USERS.map((entry) => ({
				value: entry.id,
				label: `${entry.id} ${entry.name}`.trim(),
			})),
		[],
	);

	const handleUserChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			set({ user: event.target.value });
		},
		[set],
	);

	const handleDateChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			set({ date: event.target.value });
		},
		[set],
	);

	const handleTabChange = React.useCallback(
		(event: React.SyntheticEvent, nextValue: WorkspaceTab) => {
			set({ tab: nextValue });
		},
		[set],
	);

	const resolvedUserLabel = React.useMemo(() => {
		const record = NURSE_USERS.find((entry) => entry.id === user);
		return record ? `${record.id} ${record.name}`.trim() : user;
	}, [user]);

	const headingLabel = tab === 'bp' ? '血圧・脈拍' : '発作記録';
	const headingDescription =
		tab === 'bp'
			? '利用者と対象日を選択し、血圧・脈拍の測定値を保存すると同期キューに追加されます。'
			: '利用者と対象日を選択し、発作が発生した時刻をワンタップで記録できます。';
	const sectionAriaLabel = tab === 'bp' ? '血圧・脈拍の対象設定' : '発作記録の対象設定';
	const cardAriaLabel = tab === 'bp' ? '血圧・脈拍カード' : '発作記録カード';

	React.useEffect(() => {
		if (typeof window === 'undefined') {
			return () => undefined;
		}
		const handleKeydown = (event: KeyboardEvent) => {
			const key = event.key?.toLowerCase?.() ?? '';
			const isHotkey = event.code === 'KeyS' || key === 's';
			if (event.altKey && isHotkey) {
				event.preventDefault();
				window.dispatchEvent(new CustomEvent('nurse:flush'));
			}
		};
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	}, []);

	return (
		<>
			<Box
				component="main"
				role="main"
				aria-labelledby="obs-heading"
				aria-keyshortcuts="Alt+S"
				data-testid={TESTIDS.NURSE_OBS_PAGE}
				sx={{
					display: 'flex',
					flexDirection: 'column',
					gap: { xs: 3, md: 4 },
					flex: 1,
					minHeight: { xs: 'calc(100dvh - 160px)', md: 'calc(100dvh - 200px)' },
				}}
			>
				<Box
					component="header"
					sx={{
						display: 'flex',
						flexDirection: 'column',
						gap: 1,
					}}
				>
					<Typography variant="overline" color="primary">
						生活介護 看護ワークスペース
					</Typography>
					<Typography
						id="obs-heading"
						component="h1"
						variant="h4"
						data-testid={TESTIDS.NURSE_OBS_HEADING}
						sx={{ fontWeight: 700 }}
					>
						{headingLabel}
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{headingDescription}
					</Typography>
					<Typography component="p" sx={srOnly} aria-live="polite">
						現在の対象利用者 {resolvedUserLabel || '未選択'}、対象日 {date}
					</Typography>
				</Box>

				<Tabs
					value={tab}
					onChange={handleTabChange}
					aria-label="記録タブ切り替え"
					textColor="primary"
					indicatorColor="primary"
				>
					<Tab
						value="seizure"
						label="発作記録"
						data-testid={TESTIDS.NURSE_TAB_SEIZURE}
						id="nurse-tab-seizure"
						aria-controls="nurse-tabpanel-seizure"
					/>
					<Tab
						value="bp"
						label="血圧・脈拍"
						data-testid={TESTIDS.NURSE_TAB_BP}
						id="nurse-tab-bp"
						aria-controls="nurse-tabpanel-bp"
					/>
				</Tabs>

				<Stack
					component="section"
					aria-label={sectionAriaLabel}
					spacing={{ xs: 2, md: 3 }}
					direction={{ xs: 'column', md: 'row' }}
					sx={{
						alignItems: { xs: 'stretch', md: 'center' },
						flexWrap: 'wrap',
						rowGap: 2,
					}}
				>
					<TextField
						select
						label="利用者"
						value={user}
						onChange={handleUserChange}
						data-testid={TESTIDS.NURSE_OBS_USER}
						sx={{
							minWidth: { xs: '100%', md: 240 },
							maxWidth: { md: 320 },
						}}
					>
						{userOptions.map((option) => (
							<MenuItem key={option.value} value={option.value}>
								{option.label}
							</MenuItem>
						))}
					</TextField>

					<TextField
						type="date"
						label="対象日"
						value={date}
						onChange={handleDateChange}
						InputLabelProps={{ shrink: true }}
						inputProps={{ 'data-testid': TESTIDS.NURSE_SEIZURE_DATE }}
						sx={{ minWidth: { xs: '100%', sm: 220 }, maxWidth: { md: 240 } }}
					/>
				</Stack>

				<Box
					component="section"
					role="tabpanel"
					aria-label={cardAriaLabel}
					id={tab === 'seizure' ? 'nurse-tabpanel-seizure' : 'nurse-tabpanel-bp'}
					aria-labelledby={tab === 'seizure' ? 'nurse-tab-seizure' : 'nurse-tab-bp'}
				>
					  {tab === 'bp' ? <BpPanel userId={user} date={date} /> : <SeizureQuickLog userId={user} date={date} />}
				</Box>
			</Box>

			{tab === 'seizure' ? (
				<Divider flexItem sx={{ mt: 3 }}>
					発作対応ログ
				</Divider>
			) : null}
		</>
	);
};

export default HealthObservationWorkspace;

type PanelProps = {
	userId: string;
	date?: string | null;
};

const PlaceholderPanel: React.FC<{ label: string; testId: string }> = ({ label, testId }) => (
	<Box
		data-testid={testId}
		sx={{
			border: '1px dashed',
			borderRadius: 2,
			minHeight: 200,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			px: 3,
			py: 4,
		}}
	>
		<Typography variant="body2" color="text.secondary">
			{label}
		</Typography>
	</Box>
);

const BpPanel: React.FC<PanelProps> = ({ userId, date }) => {
	const identifier = userId ? `${userId} / ${date ?? '日付未選択'}` : '利用者未選択';
	return <PlaceholderPanel testId="testids.NURSE_BP_PANEL" label={`血圧・脈拍パネル（${identifier}）`} />;
};

const SeizureQuickLog: React.FC<PanelProps> = ({ userId, date }) => {
	const identifier = userId ? `${userId} / ${date ?? '日付未選択'}` : '利用者未選択';
	return (
		<Box data-testid="testids.NURSE_SEIZURE_PANEL" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
			<PlaceholderPanel testId="testids.NURSE_SEIZURE_QUICKLOG" label={`発作クイック記録（${identifier}）`} />
		</Box>
	);
};
