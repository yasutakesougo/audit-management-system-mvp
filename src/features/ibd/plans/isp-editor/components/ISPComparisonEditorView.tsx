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
import DescriptionIcon from '@mui/icons-material/Description';
import SaveIcon from '@mui/icons-material/Save';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';
import type { DiffSegment, GoalItem } from '../data/ispRepo';
import type { DomainCoverage, ProgressInfo } from '../hooks/useISPComparisonEditor';
import { GoalTabPanel } from './GoalTabPanel';
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
