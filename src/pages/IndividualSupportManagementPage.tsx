// ---------------------------------------------------------------------------
// IndividualSupportManagementPage — オーケストレーター
//
// 責務: タブ切替 + 状態管理 + Snackbar
// 表示は SupportPlanTab / DailyRecordsTab に委譲
// ---------------------------------------------------------------------------
import FavoriteIcon from '@mui/icons-material/Favorite';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SupportIcon from '@mui/icons-material/Support';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';

import { DailyRecordsTab } from '@/features/individual-support/components/DailyRecordsTab';
import { SupportPlanTab } from '@/features/individual-support/components/SupportPlanTab';
import {
    type ABCSelection,
    type ScheduleSlot,
    type SlotFormState,
    type TabValue,
    type TimelineEntry,
    TARGET_NAME,
    buildInitialFormState,
    initialSchedule,
    supportSections,
} from '@/features/individual-support/types';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const IndividualSupportManagementPage: React.FC = () => {
  const [tab, setTab] = useState<TabValue>('plan');
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>(initialSchedule);
  const [formState, setFormState] = useState<Record<string, SlotFormState>>(() => buildInitialFormState(initialSchedule));
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' },
  );
  const [showOnlyUnrecorded, setShowOnlyUnrecorded] = useState(false);

  const recordedCount = useMemo(() => scheduleSlots.filter((slot) => slot.isRecorded).length, [scheduleSlots]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleTabChange = (_event: React.SyntheticEvent, value: TabValue) => {
    setTab(value);
  };

  const handleMoodSelect = (slotId: string, mood: string) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: { ...prev[slotId], mood, error: null },
    }));
  };

  const handleNoteChange = (slotId: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: { ...prev[slotId], note: value },
    }));
  };

  const handleToggleABC = (slotId: string) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: { ...prev[slotId], showABC: !prev[slotId].showABC },
    }));
  };

  const handleABCSelect = (slotId: string, key: keyof ABCSelection, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        abc: { ...prev[slotId].abc, [key]: value },
      },
    }));
  };

  const handleRecord = (slot: ScheduleSlot) => {
    const currentState = formState[slot.id];

    if (!currentState.mood) {
      setFormState((prev) => ({
        ...prev,
        [slot.id]: { ...prev[slot.id], error: '「本人の様子」を選択してください。' },
      }));
      setSnackbar({ open: true, message: '記録に必要な項目が未入力です。', severity: 'error' });
      return;
    }

    const abcIncluded = currentState.showABC && (currentState.abc.antecedent || currentState.abc.behavior || currentState.abc.consequence);
    const entry: TimelineEntry = {
      id: `${slot.id}-${Date.now()}`,
      time: slot.time,
      activity: slot.activity,
      mood: currentState.mood,
      note: currentState.note.trim(),
      abc: abcIncluded ? currentState.abc : undefined,
      recordedAt: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };

    setTimeline((prev) => [entry, ...prev]);
    setScheduleSlots((prev) => prev.map((item) => (item.id === slot.id ? { ...item, isRecorded: true } : item)));
    setFormState((prev) => ({
      ...prev,
      [slot.id]: {
        mood: '',
        note: '',
        showABC: prev[slot.id].showABC,
        abc: { antecedent: '', behavior: '', consequence: '' },
        error: null,
      },
    }));
    setSnackbar({ open: true, message: `${slot.time}「${slot.activity}」を記録しました。`, severity: 'success' });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper elevation={1} sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <SupportIcon color="primary" />
          <Typography variant="overline" color="text.secondary">
            強度行動障害支援ツール
          </Typography>
        </Stack>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          {TARGET_NAME} の支援手順記録
        </Typography>
        <Typography variant="body1" color="text.secondary">
          支援計画の確認と日々の記録をワンページで管理できます。記録済み {recordedCount}/{scheduleSlots.length}
        </Typography>
      </Paper>

      <Paper elevation={1}>
        <Tabs
          value={tab}
          onChange={handleTabChange}
          aria-label="支援計画と日々の記録タブ"
          variant="fullWidth"
        >
          <Tab value="plan" label="支援計画書" icon={<FavoriteIcon fontSize="small" />} iconPosition="start" />
          <Tab value="records" label="日々の記録" icon={<ScheduleIcon fontSize="small" />} iconPosition="start" />
        </Tabs>

        {tab === 'plan' && <SupportPlanTab sections={supportSections} />}

        {tab === 'records' && (
          <DailyRecordsTab
            slots={scheduleSlots}
            formState={formState}
            timeline={timeline}
            showOnlyUnrecorded={showOnlyUnrecorded}
            onMoodSelect={handleMoodSelect}
            onNoteChange={handleNoteChange}
            onToggleABC={handleToggleABC}
            onABCSelect={handleABCSelect}
            onRecord={handleRecord}
            onToggleUnrecorded={setShowOnlyUnrecorded}
          />
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default IndividualSupportManagementPage;
