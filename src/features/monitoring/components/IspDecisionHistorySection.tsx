/**
 * @fileoverview ISP 判断履歴セクション（Phase 4-D）
 * @description
 * 過去の ISP 見直し判断を目標別にタイムラインで表示する。
 *
 * 表示内容:
 * - 目標ごとの判断履歴（新しい順）
 * - 最新判断の強調表示
 * - 判断日時・判断者・ステータス・メモ
 * - 提案スナップショット要約
 *
 * 設計方針:
 * - decisions が空のときは何も描画しない
 * - 目標名が渡されない場合は goalId をそのまま表示
 * - 長い履歴でもスクロールで崩れない
 * - buildGoalDecisionHistories をそのまま活用
 */
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';
import { safeFormatDate, formatDateYmd } from '@/lib/dateFormat';

import type {
  DecisionStatus,
  GoalDecisionHistory,
  IspRecommendationDecision,
} from '../domain/ispRecommendationDecisionTypes';
import {
  DECISION_STATUS_LABELS,
  DECISION_STATUS_CHIP_COLOR,
} from '../domain/ispRecommendationDecisionTypes';
import {
  ISP_RECOMMENDATION_LABELS,
} from '../domain/ispRecommendationTypes';
import {
  buildGoalDecisionHistories,
  buildDecisionSummary,
} from '../domain/ispRecommendationDecisionUtils';
import type { IspRecommendationSummary } from '../domain/ispRecommendationTypes';

// ─── 日時フォーマッタ ────────────────────────────────────

function formatDateTime(isoString: string): string {
  return safeFormatDate(isoString, (d) => {
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  }, isoString);
}

function formatDate(isoString: string): string {
  return formatDateYmd(isoString, isoString);
}

// ─── ステータスのボーダーカラー ──────────────────────────

const STATUS_BORDER_COLORS: Record<DecisionStatus, string> = {
  pending:   '#d1d5db',
  accepted:  '#10b981',
  dismissed: '#9ca3af',
  deferred:  '#f59e0b',
};

// ─── 単一判断エントリー ──────────────────────────────────

interface DecisionEntryProps {
  decision: IspRecommendationDecision;
  isLatest: boolean;
}

const DecisionEntry: React.FC<DecisionEntryProps> = ({ decision, isLatest }) => {
  const { status, decidedBy, decidedAt, note, snapshot, monitoringPeriodFrom, monitoringPeriodTo } = decision;
  const borderColor = STATUS_BORDER_COLORS[status];

  return (
    <Box
      sx={{
        pl: 2,
        py: 1,
        borderLeft: '3px solid',
        borderColor,
        position: 'relative',
        ...(isLatest && {
          bgcolor: 'action.hover',
          borderRadius: '0 4px 4px 0',
        }),
      }}
    >
      {/* タイムライン・ドット */}
      <Box
        sx={{
          position: 'absolute',
          left: -6,
          top: 16,
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: borderColor,
          border: '2px solid',
          borderColor: 'background.paper',
        }}
      />

      {/* ヘッダー: ステータス + 日時 */}
      <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" rowGap={0.5}>
        <Chip
          label={DECISION_STATUS_LABELS[status]}
          size="small"
          color={DECISION_STATUS_CHIP_COLOR[status]}
          variant={isLatest ? 'filled' : 'outlined'}
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
        {isLatest && (
          <Chip
            label="最新"
            size="small"
            color="info"
            variant="outlined"
            sx={{ fontSize: '0.6rem', height: 20 }}
          />
        )}
        <Typography variant="caption" color="text.secondary">
          {formatDateTime(decidedAt)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
          by {decidedBy}
        </Typography>
      </Stack>

      {/* メモ（あれば） */}
      {note && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            color: 'text.primary',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {note}
        </Typography>
      )}

      {/* スナップショット概要 */}
      <Tooltip
        title={`提案理由: ${snapshot.reason}`}
        arrow
        placement="bottom-start"
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mt: 0.5,
            fontSize: '0.6rem',
            cursor: 'help',
          }}
        >
          提案: {ISP_RECOMMENDATION_LABELS[snapshot.level]}
          {' / '}進捗率 {Math.round(snapshot.rate * 100)}%
          {' / '}
          期間 {formatDate(monitoringPeriodFrom)}〜{formatDate(monitoringPeriodTo)}
        </Typography>
      </Tooltip>
    </Box>
  );
};

// ─── 目標別アコーディオン ────────────────────────────────

interface GoalHistoryAccordionProps {
  history: GoalDecisionHistory;
  defaultExpanded: boolean;
}

const GoalHistoryAccordion: React.FC<GoalHistoryAccordionProps> = ({
  history,
  defaultExpanded,
}) => {
  const { goalName, goalId, decisions, latestDecision } = history;
  const displayName = goalName ?? `目標 (${goalId})`;

  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '4px !important',
        '&:before': { display: 'none' },
        '&.Mui-expanded': { margin: 0 },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          minHeight: 40,
          px: 1.5,
          '& .MuiAccordionSummary-content': { margin: '6px 0', alignItems: 'center', gap: 1 },
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, flex: 1, minWidth: 0, wordBreak: 'break-word' }}
        >
          {displayName}
        </Typography>
        {latestDecision && (
          <Chip
            label={DECISION_STATUS_LABELS[latestDecision.status]}
            size="small"
            color={DECISION_STATUS_CHIP_COLOR[latestDecision.status]}
            variant="filled"
            sx={{ fontWeight: 600, fontSize: '0.65rem', flexShrink: 0 }}
          />
        )}
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {decisions.length}件
        </Typography>
      </AccordionSummary>

      <AccordionDetails sx={{ px: 1.5, py: 1 }}>
        <Stack spacing={0} sx={{ ml: 0.5 }}>
          {decisions.map((d, i) => (
            <DecisionEntry
              key={d.id}
              decision={d}
              isLatest={i === 0}
            />
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

// ─── サマリーバー ────────────────────────────────────────

interface DecisionSummaryBarProps {
  recommendations: IspRecommendationSummary;
  decisions: IspRecommendationDecision[];
}

const DecisionSummaryBar: React.FC<DecisionSummaryBarProps> = ({
  recommendations,
  decisions,
}) => {
  const summary = useMemo(
    () => buildDecisionSummary(recommendations, decisions),
    [recommendations, decisions],
  );

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      flexWrap="wrap"
      rowGap={0.5}
      sx={{
        p: 1,
        bgcolor: 'action.hover',
        borderRadius: 1,
        mb: 1,
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          判断状況:
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {summary.decidedCount}/{summary.totalGoals}件
        </Typography>
      </Stack>

      {/* ステータス別 */}
      {summary.byStatus.accepted > 0 && (
        <Chip
          label={`採用 ${summary.byStatus.accepted}`}
          size="small"
          color="success"
          variant="outlined"
          sx={{ fontSize: '0.65rem', height: 22 }}
        />
      )}
      {summary.byStatus.deferred > 0 && (
        <Chip
          label={`保留 ${summary.byStatus.deferred}`}
          size="small"
          color="warning"
          variant="outlined"
          sx={{ fontSize: '0.65rem', height: 22 }}
        />
      )}
      {summary.byStatus.dismissed > 0 && (
        <Chip
          label={`見送り ${summary.byStatus.dismissed}`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.65rem', height: 22 }}
        />
      )}
      {summary.pendingCount > 0 && (
        <Chip
          label={`未判断 ${summary.pendingCount}`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.65rem', height: 22, borderStyle: 'dashed' }}
        />
      )}

      {/* 最終更新 */}
      {summary.lastDecidedAt && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', ml: 'auto' }}>
          最終: {formatDateTime(summary.lastDecidedAt)} ({summary.lastDecidedBy})
        </Typography>
      )}
    </Stack>
  );
};

// ─── メインコンポーネント ────────────────────────────────

export interface IspDecisionHistorySectionProps {
  /** 判断レコード配列 */
  decisions: IspRecommendationDecision[];
  /** 現在の ISP 提案サマリー（サマリーバー表示用） */
  recommendations?: IspRecommendationSummary | null;
  /** goalId → 表示名マップ */
  goalNames?: Record<string, string>;
}

const IspDecisionHistorySection: React.FC<IspDecisionHistorySectionProps> = ({
  decisions,
  recommendations,
  goalNames,
}) => {
  const histories = useMemo(
    () => buildGoalDecisionHistories(decisions, goalNames),
    [decisions, goalNames],
  );

  // 判断が1件もなければ何も描画しない
  if (decisions.length === 0) return null;

  return (
    <Box data-testid="isp-decision-history-section">
      {/* セクションタイトル */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.75 }}>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ fontWeight: 600 }}
        >
          <HistoryIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
          判断履歴
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ({decisions.length}件)
        </Typography>
      </Stack>

      {/* サマリーバー（推薦サマリーがある場合のみ） */}
      {recommendations && (
        <DecisionSummaryBar
          recommendations={recommendations}
          decisions={decisions}
        />
      )}

      {/* 目標別アコーディオン */}
      <Stack spacing={1} sx={{ maxHeight: 500, overflowY: 'auto' }}>
        {histories.map((h, i) => (
          <GoalHistoryAccordion
            key={h.goalId}
            history={h}
            defaultExpanded={i === 0}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default React.memo(IspDecisionHistorySection);
