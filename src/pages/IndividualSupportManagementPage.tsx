// ---------------------------------------------------------------------------
// IndividualSupportManagementPage — オーケストレーター
//
// 責務: 利用者選択 + タブ切替 + SP 連動 + Snackbar
// 表示は SupportPlanTab / DailyRecordsTab に委譲
// ---------------------------------------------------------------------------
import EditNoteIcon from '@mui/icons-material/EditNote';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SupportIcon from '@mui/icons-material/Support';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import type { SelectChangeEvent } from '@mui/material/Select';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { IBDPageHeader } from '@/features/ibd/components/IBDPageHeader';
import { addSPS, confirmSPS, getLatestSPS, getSPSHistory } from '@/features/ibd/ibdStore';
import { useSPSRevision } from '@/features/ibd/useSPSHistory';
import { useSupportStepTemplates } from '@/features/support/hooks/useSupportStepTemplates';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { DailyRecordsTab } from '@/features/individual-support/components/DailyRecordsTab';
import { MonitoringRevisionDialog } from '@/features/individual-support/components/MonitoringRevisionDialog';
import { SupportPlanTab } from '@/features/individual-support/components/SupportPlanTab';
import {
    type ABCSelection,
    type ScheduleSlot,
    type SlotFormState,
    type TabValue,
    type TimelineEntry,
    buildInitialFormState,
    toScheduleSlot,
} from '@/features/individual-support/types';

// ---------------------------------------------------------------------------
// Sub-component: 利用者選択カード
// ---------------------------------------------------------------------------

interface UserSelectionProps {
  users: Array<{ Id: number; UserID: string; FullName: string }>;
  onSelect: (userCode: string) => void;
}

const UserSelectionGrid: React.FC<UserSelectionProps> = ({ users, onSelect }) => (
  <Box sx={{ p: { xs: 2, md: 3 } }}>
    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
      対象利用者を選択してください
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      強度行動障害支援の対象となる利用者の個別支援手順を管理します。
    </Typography>
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
      }}
    >
      {users.map((user) => (
        <Card key={user.Id} variant="outlined" sx={{ borderRadius: 2 }}>
          <CardActionArea onClick={() => onSelect(user.UserID)} sx={{ p: 2 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <PersonIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {user.FullName}
              </Typography>
              <Chip label={user.UserID} size="small" variant="outlined" sx={{ mt: 1 }} />
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Box>
    {users.length === 0 && (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          強度行動障害支援の対象利用者が登録されていません。
        </Typography>
      </Paper>
    )}
  </Box>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const IndividualSupportManagementPage: React.FC = () => {
  const { userCode } = useParams<{ userCode: string }>();
  const navigate = useNavigate();
  const { data: allUsers } = useUsersDemo();

  // IBD対象利用者のみフィルタ
  const ibdUsers = useMemo(
    () => allUsers.filter((u) => u.IsHighIntensitySupportTarget),
    [allUsers],
  );

  // 選択中の利用者情報
  const selectedUser = useMemo(
    () => ibdUsers.find((u) => u.UserID === userCode) ?? null,
    [ibdUsers, userCode],
  );

  // SP 支援手順テンプレートを取得
  const {
    templates,
    isLoading: isTemplatesLoading,
  } = useSupportStepTemplates(userCode ?? null);

  // テンプレートから ScheduleSlot を生成
  const scheduleSlots = useMemo(
    () => templates.map(toScheduleSlot),
    [templates],
  );

  // ── ページ内状態 ──
  const [tab, setTab] = useState<TabValue>('plan');
  const [formState, setFormState] = useState<Record<string, SlotFormState>>({});
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' },
  );
  const [showOnlyUnrecorded, setShowOnlyUnrecorded] = useState(false);
  const [monitoringDialogOpen, setMonitoringDialogOpen] = useState(false);

  // SPS 関連
  const { revise: reviseSPS } = useSPSRevision();
  const [activeSPS, setActiveSPS] = useState<import('@/features/ibd/ibdTypes').SupportPlanSheet | null>(null);
  const [activeSPSHistory, setActiveSPSHistory] = useState<import('@/features/ibd/ibdTypes').SPSHistoryEntry[]>([]);

  /** モニタリングダイアログを開く前に SPS を確保する */
  const handleOpenMonitoring = () => {
    if (!selectedUser) return;

    let sps = getLatestSPS(selectedUser.Id);

    // なければデモ用 SPS を自動生成
    if (!sps) {
      const now = new Date().toISOString().split('T')[0];
      const spsId = `sps-${selectedUser.UserID}-auto`;
      addSPS({
        id: spsId,
        userId: selectedUser.Id,
        version: 'v1',
        createdAt: now,
        updatedAt: now,
        status: 'draft' as const,
        confirmedBy: null,
        confirmedAt: null,
        icebergModel: {
          observableBehaviors: ['行動観察データ収集中'],
          underlyingFactors: ['背景要因の分析中'],
          environmentalAdjustments: ['環境調整の検討中'],
        },
        positiveConditions: ['穏やかな環境', '馴染みのスタッフ'],
      });
      confirmSPS(spsId, 100, now);
      sps = getLatestSPS(selectedUser.Id);
    }

    setActiveSPS(sps ?? null);
    setActiveSPSHistory(sps ? getSPSHistory(sps.id) : []);
    setMonitoringDialogOpen(true);
  };

  // scheduleSlots が変わったらフォーム状態をリセット
  useEffect(() => {
    setFormState(buildInitialFormState(scheduleSlots));
    setTimeline([]);
    setShowOnlyUnrecorded(false);
  }, [scheduleSlots]);

  const recordedCount = useMemo(
    () => scheduleSlots.filter((slot) => formState[slot.id]?.mood || slot.isRecorded).length,
    [scheduleSlots, formState],
  );

  // ── 記録済みスロットを追跡するステート ──
  const [recordedSlotIds, setRecordedSlotIds] = useState<Set<string>>(new Set());

  // userCode が変わったら記録済みリセット
  useEffect(() => {
    setRecordedSlotIds(new Set());
  }, [userCode]);

  const slotsWithRecordState = useMemo(
    () => scheduleSlots.map((s) => ({ ...s, isRecorded: recordedSlotIds.has(s.id) })),
    [scheduleSlots, recordedSlotIds],
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleUserSelect = (code: string) => {
    navigate(`/admin/individual-support/${code}`);
  };

  const handleUserChange = (event: SelectChangeEvent) => {
    navigate(`/admin/individual-support/${event.target.value}`);
  };

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

    if (!currentState?.mood) {
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
    setRecordedSlotIds((prev) => new Set(prev).add(slot.id));
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
  // Render: 利用者未選択
  // -----------------------------------------------------------------------
  if (!userCode || !selectedUser) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <IBDPageHeader
          title="個別支援手順管理"
          subtitle="利用者を選択して、支援計画と日々の記録を管理します。"
          icon={<SupportIcon />}
        />
        <Paper elevation={1}>
          <UserSelectionGrid users={ibdUsers} onSelect={handleUserSelect} />
        </Paper>
      </Box>
    );
  }

  // -----------------------------------------------------------------------
  // Render: 利用者選択済み
  // -----------------------------------------------------------------------
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <IBDPageHeader
        title={`${selectedUser.FullName} の支援手順記録`}
        subtitle={`支援計画の確認と日々の記録をワンページで管理できます。記録済み ${recordedCount}/${slotsWithRecordState.length}`}
        icon={<SupportIcon />}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditNoteIcon />}
              onClick={handleOpenMonitoring}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              📝 モニタリング更新
            </Button>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="user-select-label">利用者</InputLabel>
              <Select
                labelId="user-select-label"
                value={userCode}
                label="利用者"
                onChange={handleUserChange}
              >
                {ibdUsers.map((u) => (
                  <MenuItem key={u.UserID} value={u.UserID}>
                    {u.FullName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        }
      />

      {isTemplatesLoading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

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

        {tab === 'plan' && (
          <SupportPlanTab templates={templates} isLoading={isTemplatesLoading} />
        )}

        {tab === 'records' && (
          <DailyRecordsTab
            slots={slotsWithRecordState}
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

      <MonitoringRevisionDialog
        open={monitoringDialogOpen}
        onClose={() => setMonitoringDialogOpen(false)}
        currentSPS={activeSPS}
        history={activeSPSHistory}
        onRevise={reviseSPS}
        userName={selectedUser.FullName}
      />
    </Box>
  );
};

export default IndividualSupportManagementPage;
