import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PersonDaily } from '../../domain/daily/types';
import BulkDailyRecordList, { type BulkDailyRow } from './BulkDailyRecordList';
import { DailyRecordForm } from './DailyRecordForm';
import { DailyRecordList } from './DailyRecordList';

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

type TabKey = 'bulk' | 'records' | 'form';
const TAB_PARAM = 'tab' as const;

type PersonDailyUpsert = Omit<PersonDaily, 'id'> & { id?: number };

interface DailyRecordWorkspaceProps {
  records: PersonDaily[];
  onEdit: (record: PersonDaily) => void;
  onDelete: (recordId: number) => void;
  onSave: (record: PersonDailyUpsert) => void;
  onBulkSave?: (records: BulkDailyRow[]) => Promise<void>;
  selectedDate?: string;
}

const DailyRecordWorkspace: React.FC<DailyRecordWorkspaceProps> = ({
  records,
  onEdit,
  onDelete,
  onSave,
  onBulkSave,
  selectedDate,
}) => {
  const [params, setParams] = useSearchParams();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<PersonDaily | undefined>();

  const allowedTabs: TabKey[] = ['bulk', 'records', 'form'];
  const rawTab = (params.get(TAB_PARAM) as TabKey | null) ?? 'bulk';
  const tab: TabKey = allowedTabs.includes(rawTab) ? rawTab : 'bulk';

  React.useEffect(() => {
    if (rawTab !== tab) {
      const nextParams = new URLSearchParams(params);
      nextParams.set(TAB_PARAM, tab);
      setParams(nextParams, { replace: true });
    }
  }, [params, rawTab, setParams, tab]);

  const setTab = React.useCallback(
    (next: TabKey) => {
      const normalized = allowedTabs.includes(next) ? next : 'bulk';
      const nextParams = new URLSearchParams(params);
      nextParams.set(TAB_PARAM, normalized);
      setParams(nextParams, { replace: true });
    },
    [allowedTabs, params, setParams],
  );

  const handleEdit = React.useCallback(
    (record: PersonDaily) => {
      setEditingRecord(record);
      setFormOpen(true);
      onEdit(record);
    },
    [onEdit],
  );

  const handleNewRecord = React.useCallback(() => {
    setEditingRecord(undefined);
    setFormOpen(true);
    setTab('form');
  }, [setTab]);

  const handleCloseForm = React.useCallback(() => {
    setFormOpen(false);
    setEditingRecord(undefined);
  }, []);

  const handleSaveRecord = React.useCallback(
    (record: Omit<PersonDaily, 'id'>) => {
      const recordForSave: PersonDailyUpsert =
        editingRecord != null ? { ...record, id: editingRecord.id } : record;
      onSave(recordForSave);
      handleCloseForm();
    },
    [editingRecord, handleCloseForm, onSave],
  );

  const today = new Date().toISOString().split('T')[0];
  const currentDate = selectedDate || today;

  // 今日の記録統計
  const todayStats = React.useMemo(() => {
    const todayRecords = records.filter((r) => r.date === currentDate);
    const total = todayRecords.length;
    const completed = todayRecords.filter((r) => r.status === '完了').length;
    const inProgress = todayRecords.filter((r) => r.status === '作成中').length;
    const notStarted = todayRecords.filter((r) => r.status === '未作成').length;
    return {
      total,
      completed,
      inProgress,
      notStarted,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
    };
  }, [records, currentDate]);

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const isNewRecordShortcut = (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'n';
      if (!isNewRecordShortcut) {
        return;
      }

      event.preventDefault();
      if (!formOpen) {
        handleNewRecord();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [formOpen, handleNewRecord]);

  return (
    <Container maxWidth="xl" data-testid="daily-workspace-root">
      <Box sx={{ py: 3 }}>
        {/* ヘッダー */}
        <Box sx={{ mb: 3 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
          >
            <Box>
              <Typography variant="h4" component="h2" gutterBottom>
                活動日誌ワークスペース
              </Typography>
              <Typography variant="body1" color="text.secondary">
                利用者全員の日々の活動状況を効率的に管理・記録します
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              onClick={handleNewRecord}
              sx={{ alignSelf: { xs: 'stretch', md: 'center' } }}
            >
              新しい記録を作成
            </Button>
          </Stack>
        </Box>

        {/* 統計情報 */}
        <Paper sx={{ mb: 3, p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={1}
            >
              <Typography variant="h6">
                本日の記録状況 ({currentDate})
              </Typography>
              <Chip
                size="small"
                label={`完了率 ${todayStats.completionRate}%`}
                color={todayStats.completionRate >= 90 ? 'success' : todayStats.completionRate >= 70 ? 'warning' : 'error'}
              />
              <Typography component="p" sx={srOnly} aria-live="polite">
                完了率は{todayStats.completionRate}%です
              </Typography>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: 'repeat(1, minmax(0, 1fr))',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    総記録数
                  </Typography>
                  <Typography variant="h5" color="primary.main">
                    {todayStats.total}
                  </Typography>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    完了
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    {todayStats.completed}
                  </Typography>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    作成中
                  </Typography>
                  <Typography variant="h5" color="warning.main">
                    {todayStats.inProgress}
                  </Typography>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    未作成
                  </Typography>
                  <Typography variant="h5" color="text.secondary">
                    {todayStats.notStarted}
                  </Typography>
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </Paper>

        {/* タブナビゲーション */}
        <Tabs
          value={tab}
          onChange={(_, value: TabKey) => {
            if (!allowedTabs.includes(value) || value === tab) return;
            setTab(value);
          }}
          aria-label="活動日誌ワークスペースタブ"
          data-testid="daily-workspace-tabs"
          sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1, mb: 2 }}
        >
          <Tab
            value="bulk"
            label="一覧入力"
            id="daily-tab-bulk"
            aria-controls="daily-tabpanel-bulk"
            data-testid="daily-tab-bulk"
          />
          <Tab
            value="records"
            label="記録一覧"
            id="daily-tab-records"
            aria-controls="daily-tabpanel-records"
            data-testid="daily-tab-records"
          />
          <Tab
            value="form"
            label="個別入力"
            id="daily-tab-form"
            aria-controls="daily-tabpanel-form"
            data-testid="daily-tab-form"
          />
        </Tabs>

        {/* 一覧入力タブ */}
        <Box
          role="tabpanel"
          hidden={tab !== 'bulk'}
          id="daily-tabpanel-bulk"
          aria-labelledby="daily-tab-bulk"
        >
          <Box component="section" aria-label="活動日誌一覧入力">
            <Typography component="p" sx={srOnly}>
              全利用者の活動日誌を一覧形式で効率的に入力できます。
            </Typography>
            <BulkDailyRecordList
              selectedDate={currentDate}
              onSave={onBulkSave}
            />
          </Box>
        </Box>

        {/* 記録一覧タブ */}
        <Box
          role="tabpanel"
          hidden={tab !== 'records'}
          id="daily-tabpanel-records"
          aria-labelledby="daily-tab-records"
        >
          <Box component="section" aria-label="記録一覧表示">
            <Typography component="p" sx={srOnly}>
              過去の活動日誌記録を検索・確認・編集できます。
            </Typography>
            <DailyRecordList
              records={records}
              onEdit={handleEdit}
              onDelete={onDelete}
            />
          </Box>
        </Box>

        {/* 個別入力タブ */}
        <Box
          role="tabpanel"
          hidden={tab !== 'form'}
          id="daily-tabpanel-form"
          aria-labelledby="daily-tab-form"
        >
          <Box component="section" aria-label="個別記録入力">
            <Typography component="p" sx={srOnly}>
              詳細な活動日誌を個別に作成・編集できます。
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <Paper sx={{ p: { xs: 2, md: 4 }, textAlign: 'center', maxWidth: 420 }}>
                <Typography variant="h6" gutterBottom>
                  個別記録入力
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  詳細な活動記録を作成します
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={handleNewRecord}
                  sx={{ px: 3 }}
                >
                  新しい記録を作成
                </Button>
              </Paper>
            </Box>
          </Box>
        </Box>

        {/* フォームダイアログ */}
        <DailyRecordForm
          open={formOpen}
          onClose={handleCloseForm}
          record={editingRecord}
          onSave={handleSaveRecord}
        />

        <Divider flexItem sx={{ mt: 3 }}>
          活動日誌管理システム
        </Divider>
      </Box>
    </Container>
  );
};

export default DailyRecordWorkspace;