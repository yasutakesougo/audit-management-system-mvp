/**
 * PlanningWorkflowCard — 支援計画管理ワークフローカード
 *
 * Today ページ用の「支援計画管理」アクションカード。
 * 利用者ごとの PDCA フェーズを一覧表示し、CTA で次のアクションへ誘導する。
 *
 * ── 設計方針 ──
 * - 行動カード: 各行の主役は CTA（「何を押せばいいか」が即座に分かる）
 * - priority 順: 最も緊急な利用者が常に先頭に表示される
 * - データ非依存: props で完結する presentation component
 *
 * @see src/features/today/hooks/useWorkflowPhases.ts
 * @see src/domain/bridge/workflowPhase.ts
 */
import { motionTokens } from '@/app/theme';
import {
  type PlanningWorkflowUiCardItem,
  type PlanningWorkflowUiSeverity,
} from '@/app/services/bridgeProxy';
import type { WorkflowPhaseCounts } from '@/features/today/hooks/useWorkflowPhases';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';

// ─── Constants ────────────────────────────────────────────────

const DEFAULT_MAX_ITEMS = 5;

/** severity → 色マッピング */
const SEVERITY_COLORS: Record<PlanningWorkflowUiSeverity, { bg: string; text: string; border: string }> = {
  danger: { bg: 'rgba(229, 57, 53, 0.12)', text: '#e53935', border: '#e53935' },
  warning: { bg: 'rgba(245, 124, 0, 0.12)', text: '#f57c00', border: '#f57c00' },
  info: { bg: 'rgba(25, 118, 210, 0.12)', text: '#1976d2', border: '#1976d2' },
  success: { bg: 'rgba(56, 142, 60, 0.08)', text: '#388e3c', border: '#388e3c' },
};

/** severity → emoji */
const SEVERITY_EMOJI: Record<PlanningWorkflowUiSeverity, string> = {
  danger: '🔴',
  warning: '🟡',
  info: '🔵',
  success: '🟢',
};

// ─── Props ────────────────────────────────────────────────────

export interface PlanningWorkflowCardProps {
  /** ソート済みアイテム一覧 */
  items: PlanningWorkflowUiCardItem[];
  /** フェーズ別件数 */
  counts: WorkflowPhaseCounts;
  /** 最優先アイテム */
  topPriorityItem?: PlanningWorkflowUiCardItem;
  /** 最大表示件数 */
  maxItems?: number;
  /** CTA クリック時のナビゲーション */
  onNavigate?: (href: string) => void;
  /** 読み込み中 */
  isLoading?: boolean;
  /** モニタリング由来の見直し推奨シグナル件数 */
  ispRenewSuggestCount?: number;
  /** 見直し推奨シグナルの確認導線 */
  onOpenIspRenewSuggest?: () => void;
}

// ─── Sub-Components ──────────────────────────────────────────

/** ヘッダーのサマリーチップ */
function SummaryChips({
  counts,
  ispRenewSuggestCount = 0,
}: {
  counts: WorkflowPhaseCounts;
  ispRenewSuggestCount?: number;
}) {
  const chips: Array<{ label: string; count: number; color: string }> = [];

  if (counts.monitoringOverdue > 0) {
    chips.push({ label: '超過', count: counts.monitoringOverdue, color: SEVERITY_COLORS.danger.text });
  }
  if (counts.needsMonitoring > 0) {
    chips.push({ label: '14日以内', count: counts.needsMonitoring, color: SEVERITY_COLORS.warning.text });
  }
  if (counts.needsReassessment > 0) {
    chips.push({ label: '再評価待ち', count: counts.needsReassessment, color: SEVERITY_COLORS.warning.text });
  }
  if (counts.needsAssessment > 0) {
    chips.push({ label: '未作成', count: counts.needsAssessment, color: SEVERITY_COLORS.info.text });
  }
  if (counts.needsPlan > 0) {
    chips.push({ label: '設計中', count: counts.needsPlan, color: SEVERITY_COLORS.warning.text });
  }
  if (ispRenewSuggestCount > 0) {
    chips.push({ label: '見直し推奨', count: ispRenewSuggestCount, color: SEVERITY_COLORS.info.text });
  }

  if (chips.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
      {chips.map(({ label, count, color }) => (
        <Chip
          key={label}
          size="small"
          label={`${label} ${count}`}
          data-testid={`workflow-chip-${label}`}
          sx={{
            fontSize: '0.65rem',
            height: 20,
            borderColor: color,
            color,
            '& .MuiChip-label': { px: 0.75 },
          }}
          variant="outlined"
        />
      ))}
    </Box>
  );
}

/** 1行のワークフローアイテム */
function WorkflowItemRow({
  item,
  onNavigate,
}: {
  item: PlanningWorkflowUiCardItem;
  onNavigate?: (href: string) => void;
}) {
  const colors = SEVERITY_COLORS[item.severity];
  const emoji = SEVERITY_EMOJI[item.severity];

  return (
    <Box
      data-testid={`workflow-item-${item.userId}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1.25,
        px: 1.5,
        borderRadius: 1.5,
        bgcolor: colors.bg,
        border: '1px solid',
        borderColor: 'transparent',
        cursor: 'pointer',
        transition: motionTokens.transition.hoverAll,
        '&:hover': {
          borderColor: colors.border,
          transform: 'translateX(2px)',
        },
      }}
      onClick={() => onNavigate?.(item.href)}
    >
      {/* Severity indicator */}
      <Typography sx={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>
        {emoji}
      </Typography>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{
              fontSize: '0.8rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.userName}
          </Typography>
          <Chip
            size="small"
            label={item.title}
            sx={{
              fontSize: '0.6rem',
              height: 18,
              bgcolor: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              '& .MuiChip-label': { px: 0.5 },
              flexShrink: 0,
            }}
          />
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: '0.7rem', display: 'block' }}
        >
          {item.subtitle}
        </Typography>
      </Box>

      {/* CTA */}
      <Button
        size="small"
        variant="text"
        data-testid={`workflow-cta-${item.userId}`}
        onClick={(e) => {
          e.stopPropagation();
          onNavigate?.(item.href);
        }}
        sx={{
          fontSize: '0.7rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          color: colors.text,
          textTransform: 'none',
          minWidth: 'auto',
          px: 1,
          '&:hover': {
            bgcolor: colors.bg,
          },
        }}
        endIcon={<NavigateNextIcon sx={{ fontSize: '14px !important' }} />}
      >
        {item.ctaLabel}
      </Button>
    </Box>
  );
}

// ─── Main Component ──────────────────────────────────────────

export const PlanningWorkflowCard: React.FC<PlanningWorkflowCardProps> = ({
  items,
  counts,
  maxItems = DEFAULT_MAX_ITEMS,
  onNavigate,
  isLoading,
  ispRenewSuggestCount = 0,
  onOpenIspRenewSuggest,
}) => {
  // Loading state
  if (isLoading) {
    return (
      <Box data-testid="planning-workflow-card-loading" sx={{ py: 1 }}>
        <Skeleton variant="text" width="40%" height={24} />
        <Skeleton variant="rectangular" height={56} sx={{ mt: 1, borderRadius: 1.5 }} />
        <Skeleton variant="rectangular" height={56} sx={{ mt: 0.5, borderRadius: 1.5 }} />
        <Skeleton variant="rectangular" height={56} sx={{ mt: 0.5, borderRadius: 1.5 }} />
      </Box>
    );
  }

  const totalUsers = Object.values(counts).reduce((sum, c) => sum + c, 0);
  const actionRequired =
    counts.monitoringOverdue +
    counts.needsReassessment +
    counts.needsAssessment +
    counts.needsPlan +
    counts.needsMonitoring +
    ispRenewSuggestCount;

  // Empty state
  if (items.length === 0) {
    return (
      <Box
        data-testid="planning-workflow-card-empty"
        sx={{
          py: 3,
          textAlign: 'center',
          borderRadius: 2,
          bgcolor: 'rgba(255, 255, 255, 0.03)',
        }}
      >
        <CheckCircleIcon sx={{ fontSize: 36, color: 'success.main', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          支援計画の管理対象はありません
        </Typography>
      </Box>
    );
  }

  // All stable state
  if (actionRequired === 0) {
    return (
      <Box data-testid="planning-workflow-card-stable">
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>
            支援計画管理
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {totalUsers}名 — すべて安定
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
          🟢 全利用者の計画が安定しています
        </Typography>
      </Box>
    );
  }

  const visibleItems = items.slice(0, maxItems);
  const hiddenCount = items.length - maxItems;

  return (
    <Box data-testid="planning-workflow-card">
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        {actionRequired > 0 ? (
          <WarningAmberIcon sx={{ fontSize: 20, color: 'warning.main' }} />
        ) : (
          <AssignmentLateIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
        )}
        <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>
          支援計画管理
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {totalUsers}名中 {actionRequired}名にアクションが必要
        </Typography>
      </Box>

      <SummaryChips counts={counts} ispRenewSuggestCount={ispRenewSuggestCount} />

      {ispRenewSuggestCount > 0 && onOpenIspRenewSuggest && (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            variant="text"
            onClick={onOpenIspRenewSuggest}
            sx={{ textTransform: 'none', fontSize: '0.72rem', px: 0 }}
          >
            ISP見直し推奨を確認（自動適用なし）
          </Button>
        </Box>
      )}

      {/* ── Item list ── */}
      <Stack spacing={0.5} sx={{ mt: 1.5 }}>
        {visibleItems.map((item) => (
          <WorkflowItemRow key={item.userId} item={item} onNavigate={onNavigate} />
        ))}
      </Stack>

      {/* ── Overflow ── */}
      {hiddenCount > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 1,
            fontStyle: 'italic',
            fontSize: '0.7rem',
          }}
        >
          他 {hiddenCount}名
        </Typography>
      )}
    </Box>
  );
};
