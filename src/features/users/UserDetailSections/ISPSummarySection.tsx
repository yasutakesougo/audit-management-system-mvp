// ---------------------------------------------------------------------------
// ISPSummarySection — 利用者詳細「個別支援計画書」タブの読み取り専用サマリー
//
// 既存の useISPComparisonEditor を再利用してデータ取得。
// 編集は /isp-editor/:userId に委譲する。
// ---------------------------------------------------------------------------
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { GoalItem } from '@/features/ibd/plans/isp-editor/data/ispRepo';
import { useISPComparisonEditor } from '@/features/ibd/plans/isp-editor/hooks/useISPComparisonEditor';

/* ── 型 ──────────────────────────────────────── */

type Props = {
  userId: string;
};

/* ── ヘルパー ──────────────────────────────────── */

const GOAL_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  long:    { label: '長期目標', color: '#1e88e5' },
  short:   { label: '短期目標', color: '#43a047' },
  support: { label: '支援内容', color: '#f4511e' },
};

function GoalCard({ goal }: { goal: GoalItem }) {
  const meta = GOAL_TYPE_LABEL[goal.type] ?? { label: goal.type, color: '#757575' };
  return (
    <Box sx={{ borderLeft: 3, borderColor: meta.color, pl: 1.5, py: 0.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Chip label={meta.label} size="small" sx={{ bgcolor: meta.color, color: '#fff', fontWeight: 600 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {goal.label}
        </Typography>
      </Stack>
      {goal.text ? (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', opacity: 0.9 }}>
          {goal.text}
        </Typography>
      ) : (
        <Typography variant="body2" sx={{ opacity: 0.5, fontStyle: 'italic' }}>
          未入力
        </Typography>
      )}
      {goal.domains.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
          {goal.domains.map((d) => (
            <Chip key={d} label={d} size="small" variant="outlined" />
          ))}
        </Stack>
      )}
    </Box>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/* ── メインコンポーネント ──────────────────────── */

export function ISPSummarySection({ userId }: Props) {
  const {
    loading,
    error,
    currentPlan,
    domainCoverage,
  } = useISPComparisonEditor({ userId });

  const editorHref = `/isp-editor/${encodeURIComponent(userId)}`;

  // 1) Loading
  if (loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2">個別支援計画書を読み込み中…</Typography>
      </Stack>
    );
  }

  // 2) Error
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          個別支援計画書の読み込みに失敗しました。
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, whiteSpace: 'pre-wrap' }}>
          {String(error)}
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" startIcon={<EditIcon />} href={editorHref}>
            ISPエディタで確認する
          </Button>
        </Box>
      </Box>
    );
  }

  // 3) Empty — 目標がすべて空テキスト
  const hasAnyContent = currentPlan.goals.some((g) => g.text.trim().length > 0);

  if (!hasAnyContent) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          この利用者の個別支援計画書はまだ作成されていません。
        </Typography>
        <Button variant="contained" startIcon={<EditIcon />} href={editorHref}>
          作成する（ISPエディタへ）
        </Button>
      </Box>
    );
  }

  // 4) Success — 目標一覧を表示
  const longGoals = currentPlan.goals.filter((g) => g.type === 'long');
  const shortGoals = currentPlan.goals.filter((g) => g.type === 'short');
  const supports = currentPlan.goals.filter((g) => g.type === 'support');

  const statusLabel = currentPlan.status === 'confirmed' ? '確定' : 'ドラフト';
  const coveredCount = domainCoverage.filter((d) => d.covered).length;

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {/* Header */}
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            label={statusLabel}
            size="small"
            color={currentPlan.status === 'confirmed' ? 'success' : 'default'}
            variant={currentPlan.status === 'confirmed' ? 'filled' : 'outlined'}
          />
          <Chip label={`5領域: ${coveredCount}/5`} size="small" variant="outlined" />
        </Stack>
        <Button variant="outlined" size="small" startIcon={<EditIcon />} href={editorHref}>
          編集する
        </Button>
      </Stack>

      {/* 基本情報 */}
      <SectionCard title="基本">
        <Stack spacing={0.5}>
          <Typography variant="body2">計画期間: {currentPlan.planPeriod || '—'}</Typography>
          <Typography variant="body2">受給者証期限: {currentPlan.certExpiry || '—'}</Typography>
        </Stack>
      </SectionCard>

      {/* 長期目標 */}
      <SectionCard title="長期目標">
        {longGoals.length === 0 ? (
          <Typography variant="body2" sx={{ opacity: 0.5 }}>—</Typography>
        ) : (
          <Stack spacing={1.5}>
            {longGoals.map((g) => <GoalCard key={g.id} goal={g} />)}
          </Stack>
        )}
      </SectionCard>

      {/* 短期目標 */}
      <SectionCard title="短期目標">
        {shortGoals.length === 0 ? (
          <Typography variant="body2" sx={{ opacity: 0.5 }}>—</Typography>
        ) : (
          <Stack spacing={1.5}>
            {shortGoals.map((g) => <GoalCard key={g.id} goal={g} />)}
          </Stack>
        )}
      </SectionCard>

      {/* 支援内容 */}
      <SectionCard title="支援内容">
        {supports.length === 0 ? (
          <Typography variant="body2" sx={{ opacity: 0.5 }}>—</Typography>
        ) : (
          <Stack spacing={1.5}>
            {supports.map((g) => <GoalCard key={g.id} goal={g} />)}
          </Stack>
        )}
      </SectionCard>

      {/* 5領域カバレッジ */}
      <Divider />
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          5領域カバレッジ
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          {domainCoverage.map((d) => (
            <Chip
              key={d.id}
              label={d.label}
              size="small"
              sx={{
                bgcolor: d.covered ? d.bg : undefined,
                color: d.covered ? d.color : 'text.disabled',
                border: d.covered ? `1px solid ${d.color}` : '1px solid',
                borderColor: d.covered ? d.color : 'divider',
                fontWeight: d.covered ? 600 : 400,
              }}
            />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
