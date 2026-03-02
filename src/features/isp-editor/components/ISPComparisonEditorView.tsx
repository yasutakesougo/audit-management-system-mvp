/**
 * A層: ISP比較エディタ View（MUI Card / IconButton / theme palette 準拠）
 *
 * B層 (useISPComparisonEditor) から渡される props だけで描画する。
 * ローカルサブコンポーネントに分割し、可読性・保守性を向上。
 *
 * Sub-components (file-local):
 *   - SmartGuidePanel  — SMART 目標ガイド折りたたみ
 *   - ProgressSidebar  — 左サイドバー（進捗 / 期限 / 5領域カバレッジ）
 *   - GoalTabPanel     — 前回 vs 今回 の比較エディタ本体
 *   - DiffPreview      — 差分ハイライト表示
 */
import { IBDPageHeader } from '@/features/ibd/components/IBDPageHeader';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DescriptionIcon from '@mui/icons-material/Description';
import DoneIcon from '@mui/icons-material/Done';
import SaveIcon from '@mui/icons-material/Save';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';
import type { DiffSegment, GoalItem, SmartCriterion } from '../data/ispRepo';
import { DOMAINS, SMART_CRITERIA } from '../data/ispRepo';
import type { DomainCoverage, ProgressInfo } from '../hooks/useISPComparisonEditor';

/* ═══════════════════════════════════════════════════════════════════════════
   Props（B層との契約 — 変更なし）
   ═══════════════════════════════════════════════════════════════════════════ */
export interface ISPComparisonEditorViewProps {
  // state
  currentPlan: { userName: string; certExpiry: string; planPeriod: string; goals: GoalItem[] };
  previousPlan: { planPeriod: string; goals: GoalItem[] };
  showDiff: boolean;
  showSmart: boolean;
  activeGoalId: string;
  copiedId: string | null;
  sidebarOpen: boolean;
  // derived
  daysRemaining: number;
  progress: ProgressInfo;
  activeGoal: GoalItem | undefined;
  prevGoal: GoalItem | undefined;
  diff: DiffSegment[] | null;
  domainCoverage: DomainCoverage[];
  // actions
  setActiveGoalId: (id: string) => void;
  copyFromPrevious: (id: string) => void;
  updateGoalText: (id: string, text: string) => void;
  toggleDomain: (goalId: string, domainId: string) => void;
  toggleSidebar: () => void;
  toggleDiff: () => void;
  toggleSmart: () => void;
  // data lifecycle
  loading?: boolean;
  error?: Error | null;
  saving?: boolean;
  savePlan?: () => void;
  // optional user switcher (injected by page wrapper)
  userSwitcher?: React.ReactNode;
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. SmartGuidePanel — SMART目標ガイド
   ═══════════════════════════════════════════════════════════════════════════ */

type SmartGuidePanelProps = Pick<ISPComparisonEditorViewProps, 'showSmart'>;

const SmartGuidePanel: React.FC<SmartGuidePanelProps> = ({ showSmart }) => (
  <Collapse in={showSmart} timeout={300}>
    <Card
      elevation={0}
      sx={{
        mb: 2,
        bgcolor: 'warning.50',
        border: 1,
        borderColor: 'warning.200',
        borderRadius: 2,
      }}
      id="smart-guide-panel"
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {SMART_CRITERIA.map((c: SmartCriterion) => (
            <Box key={c.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: '1 1 180px' }}>
              <Chip label={c.key} size="small" color="warning" sx={{ fontWeight: 800, minWidth: 32 }} />
              <Box>
                <Typography variant="caption" fontWeight={700}>{c.label}</Typography>
                <Typography variant="caption" color="text.secondary" display="block">{c.hint}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  </Collapse>
);

/* ═══════════════════════════════════════════════════════════════════════════
   2. ProgressSidebar — 左サイドバー
   ═══════════════════════════════════════════════════════════════════════════ */

type ProgressSidebarProps = Pick<
  ISPComparisonEditorViewProps,
  'sidebarOpen' | 'toggleSidebar' | 'progress' | 'daysRemaining' | 'domainCoverage' | 'currentPlan'
>;

const ProgressSidebar: React.FC<ProgressSidebarProps> = ({
  sidebarOpen, toggleSidebar,
  progress, daysRemaining, domainCoverage, currentPlan,
}) => {
  const deadlineColor: 'error' | 'warning' | 'success' =
    daysRemaining < 30 ? 'error' : daysRemaining < 90 ? 'warning' : 'success';

  return (
    <Card
      elevation={1}
      component="aside"
      aria-label="更新進捗サイドバー"
      sx={{
        width: sidebarOpen ? 270 : 52,
        minWidth: sidebarOpen ? 270 : 52,
        transition: 'width 0.3s ease, min-width 0.3s ease',
        overflow: 'hidden',
        flexShrink: 0,
        display: { xs: sidebarOpen ? 'flex' : 'none', md: 'flex' },
        flexDirection: 'column',
      }}
    >
      {/* Toggle */}
      <Box sx={{ display: 'flex', justifyContent: sidebarOpen ? 'flex-end' : 'center', p: 0.5 }}>
        <IconButton
          size="small"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      {sidebarOpen && (
        <CardContent sx={{ flex: 1, overflowY: 'auto', pt: 0 }}>
          <Stack spacing={2.5}>

            {/* ── Section: Progress ── */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <DescriptionIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={700} color="primary.dark">
                  更新進捗
                </Typography>
              </Stack>

              <Box sx={{ mb: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={progress.pct}
                  color="primary"
                  sx={{ height: 8, borderRadius: 99 }}
                  aria-label="更新進捗"
                />
              </Box>
              <Typography variant="caption" color="text.secondary" align="right" display="block">
                {progress.pct}% 完了
              </Typography>

              {/* Steps checklist */}
              <Stack spacing={1} sx={{ mt: 2 }}>
                {progress.steps.map((s) => (
                  <Stack key={s.key} direction="row" spacing={1} alignItems="center">
                    {s.done
                      ? <CheckCircleOutlineIcon sx={{ fontSize: 20, color: 'success.main' }} />
                      : <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: 'grey.300' }} />
                    }
                    <Typography variant="body2" color={s.done ? 'success.dark' : 'text.secondary'}>
                      {s.label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Divider />

            {/* ── Section: Deadline ── */}
            <Card
              variant="outlined"
              sx={{
                borderColor: `${deadlineColor}.main`,
                bgcolor: `${deadlineColor}.50`,
              }}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  {daysRemaining < 30
                    ? <WarningAmberIcon fontSize="small" color="error" />
                    : <ScheduleIcon fontSize="small" color={deadlineColor} />
                  }
                  <Typography variant="caption" fontWeight={600}>受給者証期限</Typography>
                </Stack>
                <Typography variant="h4" fontWeight={800} color={daysRemaining < 30 ? 'error.main' : 'text.primary'}>
                  {daysRemaining}
                  <Typography component="span" variant="body2" fontWeight={500} sx={{ ml: 0.5 }}>日</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">{currentPlan.certExpiry}</Typography>
              </CardContent>
            </Card>

            <Divider />

            {/* ── Section: 5-Domain Coverage ── */}
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                5領域カバレッジ
              </Typography>
              <Stack spacing={0.5}>
                {domainCoverage.map((d) => (
                  <Stack
                    key={d.id}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{
                      px: 1.5, py: 0.75, borderRadius: 1,
                      bgcolor: d.covered ? d.bg : 'grey.50',
                      border: 1,
                      borderColor: d.covered ? d.color + '40' : 'grey.200',
                    }}
                  >
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: d.covered ? d.color : 'grey.400',
                      flexShrink: 0,
                    }} />
                    <Typography
                      variant="caption"
                      sx={{ color: d.covered ? d.color : 'text.disabled', fontWeight: d.covered ? 600 : 400 }}
                    >
                      {d.label}
                    </Typography>
                    {d.covered && <DoneIcon sx={{ fontSize: 14, color: d.color, ml: 'auto' }} />}
                  </Stack>
                ))}
              </Stack>
            </Box>

          </Stack>
        </CardContent>
      )}
    </Card>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   3. DiffPreview — 差分ハイライト
   ═══════════════════════════════════════════════════════════════════════════ */

type DiffPreviewProps = { diff: DiffSegment[] };

const DiffPreview: React.FC<DiffPreviewProps> = ({ diff }) => (
  <Card
    variant="outlined"
    sx={{ borderStyle: 'dashed', bgcolor: 'grey.50' }}
    aria-live="polite"
    aria-atomic="true"
  >
    <CardHeader
      avatar={<CompareArrowsIcon fontSize="small" color="primary" />}
      title="変更差分プレビュー（監査エビデンス）"
      titleTypographyProps={{ variant: 'caption', fontWeight: 700, color: 'primary.main' }}
      sx={{ pb: 0, pt: 1.5, px: 2 }}
    />
    <CardContent sx={{ pt: 0.5 }}>
      <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
        {diff.map((seg, i) => (
          <Typography
            key={i}
            component="span"
            variant="body2"
            sx={
              seg.type === 'del'
                ? { bgcolor: 'error.50', color: 'error.main', textDecoration: 'line-through', px: 0.3, borderRadius: 0.5 }
                : seg.type === 'add'
                  ? { bgcolor: 'success.50', color: 'success.dark', fontWeight: 700, px: 0.3, borderRadius: 0.5 }
                  : undefined
            }
          >
            {seg.text}
          </Typography>
        ))}
      </Typography>
    </CardContent>
  </Card>
);

/* ═══════════════════════════════════════════════════════════════════════════
   4. GoalTabPanel — 前回 vs 今回 比較エディタ
   ═══════════════════════════════════════════════════════════════════════════ */

type GoalTabPanelProps = Pick<
  ISPComparisonEditorViewProps,
  | 'currentPlan' | 'previousPlan' | 'activeGoalId' | 'activeGoal' | 'prevGoal'
  | 'copiedId' | 'diff' | 'showSmart' | 'showDiff'
  | 'setActiveGoalId' | 'copyFromPrevious' | 'updateGoalText' | 'toggleDomain'
>;

const GoalTabPanel: React.FC<GoalTabPanelProps> = ({
  currentPlan, previousPlan, activeGoalId, activeGoal, prevGoal,
  copiedId, diff, showSmart,
  setActiveGoalId, copyFromPrevious, updateGoalText, toggleDomain,
}) => {
  // Active tab index
  const activeTabIndex = useMemo(
    () => currentPlan.goals.findIndex((g) => g.id === activeGoalId),
    [currentPlan.goals, activeGoalId],
  );

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Tab Navigation */}
      <Card elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTabIndex >= 0 ? activeTabIndex : 0}
          onChange={(_e, idx) => {
            const goal = currentPlan.goals[idx];
            if (goal) setActiveGoalId(goal.id);
          }}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="目標項目タブ"
        >
          {currentPlan.goals.map((g) => {
            const prev = previousPlan.goals.find((p) => p.id === g.id);
            const hasChange = g.text && prev && g.text !== prev.text;
            const isEmpty = !g.text.trim();
            return (
              <Tab
                key={g.id}
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <span>{g.label}</span>
                    {hasChange && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }}
                        aria-label="変更あり" />
                    )}
                    {isEmpty && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main' }}
                        aria-label="未入力" />
                    )}
                  </Stack>
                }
                id={`tab-${g.id}`}
                aria-controls={`tabpanel-${g.id}`}
                sx={{ textTransform: 'none', fontWeight: activeGoalId === g.id ? 700 : 400, minHeight: 48 }}
              />
            );
          })}
        </Tabs>
      </Card>

      {/* Active Tab Panel — Side-by-side comparison */}
      {activeGoal && (
        <Box
          role="tabpanel"
          id={`tabpanel-${activeGoal.id}`}
          aria-labelledby={`tab-${activeGoal.id}`}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2.5,
            flex: 1,
          }}
        >
          {/* LEFT: Previous Plan (Read-Only) */}
          <Card elevation={1}>
            <CardHeader
              title={<Chip label="前回確定" size="small" variant="outlined" />}
              action={
                <Typography variant="caption" color="text.secondary">
                  {previousPlan.planPeriod}
                </Typography>
              }
              sx={{ pb: 0 }}
            />
            <CardContent>
              <Card
                variant="outlined"
                sx={{ bgcolor: 'grey.50', borderRadius: 1.5, mb: 1.5 }}
                aria-label={`前回の${activeGoal.label}`}
              >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {prevGoal?.text || '(前回データなし)'}
                  </Typography>
                </CardContent>
              </Card>

              {prevGoal && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {prevGoal.domains.map((dId) => {
                    const dm = DOMAINS.find((d) => d.id === dId);
                    return dm ? (
                      <Chip
                        key={dId}
                        label={dm.label}
                        size="small"
                        sx={{ bgcolor: dm.bg, color: dm.color, fontWeight: 600, fontSize: 11 }}
                      />
                    ) : null;
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>

          {/* RIGHT: Current Plan (Editable) */}
          <Card
            elevation={2}
            sx={{ border: 2, borderColor: 'primary.light' }}
          >
            <CardHeader
              title={<Chip label="今回更新案" size="small" color="primary" variant="outlined" />}
              action={
                <Tooltip title="前回のテキストを引用します">
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      color={copiedId === activeGoal.id ? 'success' : 'primary'}
                      startIcon={copiedId === activeGoal.id ? <DoneIcon /> : <ContentCopyIcon />}
                      onClick={() => copyFromPrevious(activeGoal.id)}
                      disabled={!prevGoal}
                      aria-label={`前回の${activeGoal.label}を引用`}
                    >
                      {copiedId === activeGoal.id ? '引用済' : '前回から引用'}
                    </Button>
                  </span>
                </Tooltip>
              }
              sx={{ pb: 0 }}
            />
            <CardContent>
              <Stack spacing={2}>
                {/* Text Editor */}
                <TextField
                  id={`goal-textarea-${activeGoal.id}`}
                  value={activeGoal.text}
                  onChange={(e) => updateGoalText(activeGoal.id, e.target.value)}
                  placeholder="目標・支援内容を入力してください…"
                  multiline
                  minRows={4}
                  maxRows={12}
                  fullWidth
                  variant="outlined"
                  aria-describedby={showSmart ? 'smart-guide-panel' : undefined}
                  sx={{
                    '& .MuiOutlinedInput-root': { bgcolor: 'grey.50', borderRadius: 1.5 },
                  }}
                />

                {/* Domain Tags */}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    5領域タグ：
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {DOMAINS.map((d) => {
                      const isOn = activeGoal.domains.includes(d.id);
                      return (
                        <Chip
                          key={d.id}
                          label={d.label}
                          size="small"
                          clickable
                          icon={isOn ? <DoneIcon sx={{ fontSize: 14 }} /> : undefined}
                          onClick={() => toggleDomain(activeGoal.id, d.id)}
                          aria-pressed={isOn}
                          sx={{
                            bgcolor: isOn ? d.bg : 'background.paper',
                            color: isOn ? d.color : 'text.disabled',
                            borderColor: isOn ? d.color + '60' : 'grey.300',
                            border: 1,
                            fontWeight: isOn ? 700 : 400,
                            minHeight: 32,
                            '&:hover': { bgcolor: isOn ? d.bg : 'grey.100' },
                          }}
                        />
                      );
                    })}
                  </Stack>
                </Box>

                {/* Diff Preview */}
                {diff && <DiffPreview diff={diff} />}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   5. メインコンポーネント — ISPComparisonEditorView
   ═══════════════════════════════════════════════════════════════════════════ */

const ISPComparisonEditorView: React.FC<ISPComparisonEditorViewProps> = (props) => {
  const {
    currentPlan, previousPlan, showDiff, showSmart, activeGoalId, copiedId, sidebarOpen,
    daysRemaining, progress, activeGoal, prevGoal, diff, domainCoverage,
    setActiveGoalId, copyFromPrevious, updateGoalText, toggleDomain,
    toggleSidebar, toggleDiff, toggleSmart,
    loading, error, saving, savePlan,
    userSwitcher,
  } = props;

  const [errorSnackOpen, setErrorSnackOpen] = useState(true);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: '100%' }}>

      {/* ═══ LOADING OVERLAY ═══ */}
      {loading && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          bgcolor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)',
        }}>
          <CircularProgress color="success" />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            データを読み込み中…
          </Typography>
        </Box>
      )}

      {/* ═══ ERROR SNACKBAR ═══ */}
      <Snackbar
        open={Boolean(error) && !loading && errorSnackOpen}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setErrorSnackOpen(false)}
      >
        <Alert severity="warning" onClose={() => setErrorSnackOpen(false)} variant="filled" sx={{ width: '100%' }}>
          データ取得に失敗しました。モックデータで表示しています。
        </Alert>
      </Snackbar>

      {/* ═══ HEADER ═══ */}
      <IBDPageHeader
        title="個別支援計画 比較・更新エディタ"
        subtitle={`${currentPlan.userName}さん ｜ 計画期間: ${currentPlan.planPeriod}`}
        icon={<DescriptionIcon />}
        actions={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {userSwitcher}
            <Button
              size="small"
              variant={showDiff ? 'contained' : 'outlined'}
              color={showDiff ? 'primary' : 'inherit'}
              startIcon={<VisibilityIcon />}
              onClick={toggleDiff}
              aria-pressed={showDiff}
            >
              差分プレビュー
            </Button>
            <Button
              size="small"
              variant={showSmart ? 'contained' : 'outlined'}
              color={showSmart ? 'warning' : 'inherit'}
              startIcon={<TipsAndUpdatesIcon />}
              onClick={toggleSmart}
              aria-pressed={showSmart}
            >
              SMARTガイド
            </Button>
            {savePlan && (
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                onClick={savePlan}
                disabled={saving}
              >
                {saving ? '保存中…' : '保存'}
              </Button>
            )}
          </Stack>
        }
      />

      {/* ═══ SMART GUIDE ═══ */}
      <SmartGuidePanel showSmart={showSmart} />

      {/* ═══ MAIN CONTENT AREA ═══ */}
      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>

        {/* Sidebar */}
        <ProgressSidebar
          sidebarOpen={sidebarOpen}
          toggleSidebar={toggleSidebar}
          progress={progress}
          daysRemaining={daysRemaining}
          domainCoverage={domainCoverage}
          currentPlan={currentPlan}
        />

        {/* Editor */}
        <GoalTabPanel
          currentPlan={currentPlan}
          previousPlan={previousPlan}
          activeGoalId={activeGoalId}
          activeGoal={activeGoal}
          prevGoal={prevGoal}
          copiedId={copiedId}
          diff={diff}
          showSmart={showSmart}
          showDiff={showDiff}
          setActiveGoalId={setActiveGoalId}
          copyFromPrevious={copyFromPrevious}
          updateGoalText={updateGoalText}
          toggleDomain={toggleDomain}
        />

      </Box>
    </Box>
  );
};

export default ISPComparisonEditorView;
