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
import { IBDPageHeader } from '@/features/ibd/core/components/IBDPageHeader';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DescriptionIcon from '@mui/icons-material/Description';
import DoneIcon from '@mui/icons-material/Done';
import SaveIcon from '@mui/icons-material/Save';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';
import type { DiffSegment, GoalItem } from '../data/ispRepo';
import { DOMAINS } from '../data/ispRepo';
import type { DomainCoverage, ProgressInfo } from '../hooks/useISPComparisonEditor';
import { ProgressSidebar } from './ProgressSidebar';
import { SmartGuidePanel } from './SmartGuidePanel';

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
