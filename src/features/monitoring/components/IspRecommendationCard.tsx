/**
 * @fileoverview ISP 見直し提案カード（Phase 4-B + 4-C2 判断操作付き）
 * @description
 * IspRecommendationSummary を受け取り、目標ごとの提案を
 * レベル / 理由 / 根拠進捗 / trend / 根拠件数 の6指標で表示する。
 *
 * Phase 4-C2 追加:
 * - 各提案行に「採用 / 保留 / 見送り」ボタン
 * - ボタン押下でメモ入力欄が開き、確定で onDecision callback を呼ぶ
 * - 既に判断済みの場合はステータス Chip + メモを表示
 *
 * 設計方針:
 * - 文言優先: 色だけに頼らず日本語ラベルを明示
 * - urgent-review は明確に目立たせる
 * - pending は弱く表示（「根拠不足」であることを伝える）
 * - 注意書き: 最終判断は人が行うことを明示
 * - 条件付き表示: ispRecommendations がない場合は何も描画しない
 */
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GavelIcon from '@mui/icons-material/Gavel';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useCallback, useState } from 'react';

import type { ProgressTrend } from '../domain/goalProgressTypes';
import { PROGRESS_LEVEL_LABELS } from '../domain/goalProgressTypes';
import type { DecisionStatus } from '../domain/ispRecommendationDecisionTypes';
import {
  DECISION_STATUS_LABELS,
  DECISION_STATUS_CHIP_COLOR,
} from '../domain/ispRecommendationDecisionTypes';
import type {
  IspRecommendation,
  IspRecommendationLevel,
  IspRecommendationSummary,
} from '../domain/ispRecommendationTypes';
import {
  ISP_RECOMMENDATION_LABELS,
  ISP_RECOMMENDATION_COLORS,
} from '../domain/ispRecommendationTypes';

// ─── 定数 ────────────────────────────────────────────────

const LEVEL_CHIP_COLOR: Record<IspRecommendationLevel, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  continue:        'success',
  'adjust-support': 'warning',
  'revise-goal':    'error',
  'urgent-review':  'error',
  pending:         'default',
};

/** 各レベルの補助説明（Tooltip 用） */
const LEVEL_DESCRIPTIONS: Record<IspRecommendationLevel, string> = {
  continue:        '現行支援で進捗が見られるため継続推奨',
  'adjust-support': '進捗に停滞が見られるため、支援方法の見直しを検討',
  'revise-goal':    '目標自体の再設定が必要な可能性あり',
  'urgent-review':  '複数の根拠記録から悪化傾向が確認されており、早急なレビューを推奨',
  pending:         '判定に必要な記録データが不足しています',
};

const TREND_CONFIG: Record<ProgressTrend, { label: string; icon: typeof TrendingUpIcon; color: string }> = {
  improving: { label: '改善', icon: TrendingUpIcon, color: '#10b981' },
  stable:    { label: '横ばい', icon: TrendingFlatIcon, color: '#6b7280' },
  declining: { label: '低下', icon: TrendingDownIcon, color: '#ef4444' },
};

const OVERALL_ALERT_SEVERITY: Record<IspRecommendationLevel, 'success' | 'info' | 'warning' | 'error'> = {
  continue:        'success',
  'adjust-support': 'warning',
  'revise-goal':    'error',
  'urgent-review':  'error',
  pending:         'info',
};

// ─── 判断操作のコールバック型 ────────────────────────────

export interface DecisionInput {
  goalId: string;
  status: DecisionStatus;
  note: string;
}

// ─── 判断ボタン群 ────────────────────────────────────────

const DECISION_BUTTONS: {
  status: Exclude<DecisionStatus, 'pending'>;
  label: string;
  icon: React.ReactElement;
  color: 'success' | 'warning' | 'inherit';
}[] = [
  { status: 'accepted', label: '採用', icon: <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />, color: 'success' },
  { status: 'deferred', label: '保留', icon: <PauseCircleOutlineIcon sx={{ fontSize: 16 }} />, color: 'warning' },
  { status: 'dismissed', label: '見送り', icon: <RemoveCircleOutlineIcon sx={{ fontSize: 16 }} />, color: 'inherit' },
];

// ─── 判断操作 UI ─────────────────────────────────────────

interface DecisionActionsProps {
  goalId: string;
  currentStatus?: DecisionStatus;
  currentNote?: string;
  onDecision?: (input: DecisionInput) => void;
}

const DecisionActions: React.FC<DecisionActionsProps> = ({
  goalId,
  currentStatus,
  currentNote,
  onDecision,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<DecisionStatus | null>(null);
  const [note, setNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleSelect = useCallback((status: Exclude<DecisionStatus, 'pending'>) => {
    setSelectedStatus(status);
    setNote('');
    setIsEditing(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedStatus && onDecision) {
      onDecision({ goalId, status: selectedStatus, note });
    }
    setIsEditing(false);
    setSelectedStatus(null);
    setNote('');
  }, [goalId, selectedStatus, note, onDecision]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setSelectedStatus(null);
    setNote('');
  }, []);

  const isDecided = currentStatus && currentStatus !== 'pending';

  // 既に判断済みの表示
  if (isDecided && !isEditing) {
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.75 }}>
        <Chip
          label={DECISION_STATUS_LABELS[currentStatus]}
          size="small"
          color={DECISION_STATUS_CHIP_COLOR[currentStatus]}
          variant="filled"
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
        {currentNote && (
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            {currentNote}
          </Typography>
        )}
        {onDecision && (
          <Button
            size="small"
            onClick={() => setIsEditing(true)}
            sx={{ fontSize: '0.65rem', minWidth: 0, px: 0.5 }}
          >
            変更
          </Button>
        )}
      </Stack>
    );
  }

  // 判断ボタン群
  return (
    <Box sx={{ mt: 0.75 }}>
      {!isEditing ? (
        <Stack direction="row" spacing={0.5}>
          {DECISION_BUTTONS.map((btn) => (
            <Button
              key={btn.status}
              size="small"
              variant="outlined"
              color={btn.color}
              startIcon={btn.icon}
              onClick={() => handleSelect(btn.status)}
              disabled={!onDecision}
              sx={{
                fontSize: '0.65rem',
                py: 0.25,
                px: 1,
                textTransform: 'none',
                minWidth: 0,
              }}
            >
              {btn.label}
            </Button>
          ))}
        </Stack>
      ) : (
        <Collapse in={isEditing}>
          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Chip
                label={DECISION_STATUS_LABELS[selectedStatus!]}
                size="small"
                color={DECISION_STATUS_CHIP_COLOR[selectedStatus!]}
                variant="filled"
                sx={{ fontWeight: 600, fontSize: '0.7rem' }}
              />
              <Typography variant="caption" color="text.secondary">
                を選択中
              </Typography>
            </Stack>
            <TextField
              size="small"
              placeholder="判断理由（任意）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              maxRows={3}
              inputProps={{ style: { fontSize: '0.75rem' } }}
              sx={{ '& .MuiInputBase-root': { py: 0.5 } }}
            />
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <Button
                size="small"
                onClick={handleCancel}
                sx={{ fontSize: '0.65rem', minWidth: 0 }}
              >
                キャンセル
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleConfirm}
                sx={{ fontSize: '0.65rem', minWidth: 0 }}
              >
                確定
              </Button>
            </Stack>
          </Stack>
        </Collapse>
      )}
    </Box>
  );
};

// ─── 単一提案行 ──────────────────────────────────────────

interface IspRecommendationItemProps {
  recommendation: IspRecommendation;
  goalName?: string;
  currentStatus?: DecisionStatus;
  currentNote?: string;
  onDecision?: (input: DecisionInput) => void;
}

const IspRecommendationItem: React.FC<IspRecommendationItemProps> = ({
  recommendation,
  goalName,
  currentStatus,
  currentNote,
  onDecision,
}) => {
  const { level, reason, evidence } = recommendation;
  const displayName = goalName ?? `目標(${recommendation.goalId})`;
  const isUrgent = level === 'urgent-review';
  const isPending = level === 'pending';
  const trendCfg = TREND_CONFIG[evidence.trend];
  const TrendIcon = trendCfg.icon;
  const progressLabel = PROGRESS_LEVEL_LABELS[evidence.progressLevel];

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: isUrgent ? 'error.main' : 'divider',
        bgcolor: isUrgent
          ? 'error.50'
          : isPending
            ? 'action.disabledBackground'
            : 'background.paper',
        opacity: isPending ? 0.75 : 1,
        ...(isUrgent && {
          borderWidth: 2,
          boxShadow: '0 0 0 1px rgba(220, 38, 38, 0.15)',
        }),
      }}
      data-testid={`isp-recommendation-item-${recommendation.goalId}`}
    >
      {/* 目標名 + 提案レベル Chip */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            wordBreak: 'break-word',
            flex: 1,
            minWidth: 0,
            ...(isPending && { color: 'text.secondary' }),
          }}
        >
          {displayName}
        </Typography>
        <Tooltip title={LEVEL_DESCRIPTIONS[level]} arrow placement="top">
          <Chip
            label={ISP_RECOMMENDATION_LABELS[level]}
            size="small"
            color={LEVEL_CHIP_COLOR[level]}
            variant={isUrgent ? 'filled' : 'outlined'}
            sx={{
              fontWeight: 600,
              flexShrink: 0,
              minWidth: 80,
              justifyContent: 'center',
              ...(isUrgent && {
                color: '#fff',
                bgcolor: ISP_RECOMMENDATION_COLORS[level],
              }),
            }}
          />
        </Tooltip>
      </Stack>

      {/* pending: 簡潔なメッセージ */}
      {isPending ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          記録データが不足しているため、判定を保留しています
        </Typography>
      ) : (
        <Box sx={{ mt: 0.5 }}>
          {/* 理由テキスト */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: isUrgent ? 'error.dark' : 'text.primary',
              fontWeight: isUrgent ? 500 : 400,
              lineHeight: 1.5,
            }}
          >
            {reason}
          </Typography>

          {/* 根拠情報 */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mt: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              根拠: {progressLabel} / 記録 {evidence.matchedRecordCount}件 / タグ {evidence.matchedTagCount}件
            </Typography>
            <Tooltip
              title={`傾向: ${trendCfg.label}（前半/後半比較）`}
              arrow
              placement="bottom-end"
            >
              <Stack direction="row" alignItems="center" spacing={0.3} sx={{ cursor: 'help' }}>
                <TrendIcon sx={{ fontSize: 14, color: trendCfg.color }} />
                <Typography variant="caption" sx={{ color: trendCfg.color, fontWeight: 500 }}>
                  {trendCfg.label}
                </Typography>
              </Stack>
            </Tooltip>
          </Stack>

          {/* 判断操作 */}
          <DecisionActions
            goalId={recommendation.goalId}
            currentStatus={currentStatus}
            currentNote={currentNote}
            onDecision={onDecision}
          />
        </Box>
      )}
    </Box>
  );
};

// ─── メインコンポーネント ────────────────────────────────

export interface IspRecommendationCardProps {
  /** ISP 見直し提案サマリー。undefined / null のとき何も描画しない */
  ispRecommendations?: IspRecommendationSummary | null;
  /**
   * goalId → 表示名のマップ。
   * 提供されない場合は goalId をそのまま使う。
   */
  goalNames?: Record<string, string>;
  /**
   * goalId → 現在の判断ステータス。
   * Phase 4-C: resolveCurrentDecisionStatus の出力を渡す。
   */
  decisionStatuses?: Map<string, DecisionStatus>;
  /**
   * goalId → 判断メモ。
   */
  decisionNotes?: Map<string, string>;
  /**
   * 判断操作のコールバック。
   * undefined の場合は判断ボタンが disabled になる。
   */
  onDecision?: (input: DecisionInput) => void;
}

const IspRecommendationCard: React.FC<IspRecommendationCardProps> = ({
  ispRecommendations,
  goalNames,
  decisionStatuses,
  decisionNotes,
  onDecision,
}) => {
  if (!ispRecommendations || ispRecommendations.recommendations.length === 0) return null;

  const { overallLevel, actionableCount, totalGoalCount, recommendations } = ispRecommendations;
  const hasActionable = actionableCount > 0;
  const alertSeverity = OVERALL_ALERT_SEVERITY[overallLevel];

  // 判断済み件数
  const decidedCount = decisionStatuses
    ? [...decisionStatuses.values()].filter(s => s !== 'pending').length
    : 0;

  return (
    <Box data-testid="isp-recommendation-card">
      {/* セクションタイトル */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ fontWeight: 600 }}
        >
          <GavelIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
          個別支援計画見直し提案
        </Typography>
        <Tooltip
          title="モニタリング期間中の目標進捗分析に基づき、個別支援計画の見直し候補を自動提案しています。提案は補助情報であり、見直しの最終判断は担当者が行います。"
          arrow
          placement="right"
        >
          <HelpOutlineIcon sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
        </Tooltip>
        {/* 判断進捗 */}
        {decisionStatuses && decisionStatuses.size > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            判断: {decidedCount}/{actionableCount}件
          </Typography>
        )}
      </Stack>

      {/* 総合判定 Alert */}
      {hasActionable && (
        <Alert
          severity={alertSeverity}
          sx={{
            mb: 1,
            py: 0.25,
            '& .MuiAlert-message': { fontSize: '0.75rem' },
          }}
        >
          総合判定: <strong>{ISP_RECOMMENDATION_LABELS[overallLevel]}</strong>
          {'　'}
          ({actionableCount}/{totalGoalCount} 件の目標に提案あり)
        </Alert>
      )}

      {/* 個別提案カード群 */}
      <Stack spacing={1} sx={{ maxHeight: 500, overflowY: 'auto' }}>
        {recommendations.map((rec) => (
          <IspRecommendationItem
            key={rec.goalId}
            recommendation={rec}
            goalName={goalNames?.[rec.goalId]}
            currentStatus={decisionStatuses?.get(rec.goalId)}
            currentNote={decisionNotes?.get(rec.goalId)}
            onDecision={onDecision}
          />
        ))}
      </Stack>

      {/* 注意書き */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 1, fontSize: '0.65rem' }}
      >
        ※ 本提案は支援記録の分析に基づく補助情報です。最終的な見直し判断は担当者が行ってください。
      </Typography>
    </Box>
  );
};

export default React.memo(IspRecommendationCard);
