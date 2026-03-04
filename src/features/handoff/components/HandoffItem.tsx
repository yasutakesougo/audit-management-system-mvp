/**
 * 申し送り1件の表示コンポーネント（v5: ビジュアル改善版）
 *
 * TodayHandoffTimelineList から抽出。
 * - 情報階層の明確化（時刻+利用者 → タグ行 → 本文）
 * - 完了済みカードの視覚的フィードバック（透過+グレーボーダー）
 * - マイクロアニメーション（ステータス変更pulse、展開スライド）
 * - コメント(返信)タブ / 更新履歴タブ
 * - 会議モード別ワークフローアクションボタン
 */

import { TESTIDS, tid } from '@/testids';
import {
    AccessTime as AccessTimeIcon,
    ChatBubbleOutline as ChatBubbleOutlineIcon,
    CheckCircle as CheckCircleIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    FiberManualRecord as FiberManualRecordIcon,
    History as HistoryIcon,
    OpenInNew as OpenInNewIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Collapse,
    Stack,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DailyActivityNavState } from '../../cross-module/navigationState';
import { getSeverityColor } from '../handoffConstants';
import { getAllowedActions, getNextStatus, HANDOFF_STATUS_META } from '../handoffStateMachine';
import { loadSeenMap, saveSeenMap } from '../handoffStorageUtils';
import type { HandoffRecord, HandoffStatus, MeetingMode } from '../handoffTypes';
import type { WorkflowActions } from '../useHandoffTimelineViewModel';
import { HandoffAuditLogView } from './HandoffAuditLogView';
import { HandoffCommentThread } from './HandoffCommentThread';

// ────────────────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────────────────

/** 時刻フォーマット（HH:MM） */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

export type HandoffItemProps = {
  item: HandoffRecord;
  onStatusChange: (id: number, status: HandoffRecord['status']) => Promise<void> | void;
  /** v3: 会議モード */
  meetingMode: MeetingMode;
  /** v3: ワークフローアクション */
  workflowActions?: WorkflowActions;
};

// ────────────────────────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────────────────────────

export const HandoffItem: React.FC<HandoffItemProps> = ({
  item,
  onStatusChange,
  meetingMode,
  workflowActions,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusPulse, setStatusPulse] = useState(false);
  const [isSeen, setIsSeen] = useState(() => {
    const map = loadSeenMap();
    return Boolean(map[String(item.id)]);
  });
  /** v4: 展開時の詳細タブ（0=返信, 1=更新履歴） */
  const [detailTab, setDetailTab] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const map = loadSeenMap();
    setIsSeen(Boolean(map[String(item.id)]));
  }, [item.id]);

  const isCompleted = item.status === '対応済' || item.status === '完了';

  const handleStatusToggle = async () => {
    const newStatus = getNextStatus(item.status);

    try {
      setStatusPulse(true);
      await onStatusChange(item.id, newStatus);
      setTimeout(() => setStatusPulse(false), 600);
    } catch (error) {
      setStatusPulse(false);
      console.error('[handoff] Status update failed:', error);
    }
  };

  const handleOpenDailyRecord = () => {
    if (!item.userCode || item.userCode === 'ALL') {
      return;
    }

    // createdAt から YYYY-MM-DD を抽出
    const highlightDate = item.createdAt ? item.createdAt.split('T')[0] : undefined;

    const navState: DailyActivityNavState = {
      highlightUserId: item.userCode,
      highlightDate,
    };

    navigate('/daily/activity', { state: navState });
  };

  const isLongMessage = item.message.length > 100;
  const displayMessage = expanded || !isLongMessage
    ? item.message
    : item.message.substring(0, 100) + '...';

  const markSeen = useCallback(() => {
    if (isSeen) return;
    const map = loadSeenMap();
    const key = String(item.id);
    if (!map[key]) {
      map[key] = new Date().toISOString();
      saveSeenMap(map);
    }
    setIsSeen(true);
  }, [isSeen, item.id]);

  const handleToggleExpand = () => {
    if (!expanded) {
      markSeen();
    }
    setExpanded((prev) => !prev);
  };

  // ── 重要度に基づくアクセントカラー ──
  const accentColor =
    item.severity === '重要' ? 'error.main' :
    item.severity === '要注意' ? 'warning.main' :
    'grey.400';

  return (
    <Card
      variant="outlined"
      sx={{
        // 左ボーダー: 完了済みはグレー化、それ以外は重要度カラー
        borderLeft: item.severity === '重要' ? '4px solid' : '3px solid',
        borderLeftColor: isCompleted ? 'grey.300' : accentColor,
        // 完了済みカードの視覚的フィードバック
        opacity: isCompleted ? 0.65 : 1,
        // 未確認カードは柔らかいハイライト
        bgcolor: isSeen
          ? 'background.paper'
          : 'action.hover',
        // ステータス変更時の pulse アニメーション
        transition: 'all 0.3s ease',
        ...(statusPulse && {
          boxShadow: (theme) =>
            `0 0 0 2px ${theme.palette.primary.main}40`,
        }),
        '&:hover': {
          bgcolor: isCompleted
            ? 'background.paper'
            : 'action.hover',
        },
      }}
      {...tid(TESTIDS['agenda-timeline-item'])}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={0.75}>

          {/* ── ROW 1: 時刻 + 利用者名 + ステータスバッジ ── */}
          <Stack direction="row" alignItems="center" spacing={1}>
            {/* 時刻 */}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 0.5,
                fontSize: '0.7rem',
              }}
            >
              {formatTime(item.createdAt)}
            </Typography>

            {/* 利用者名 */}
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                color: isCompleted ? 'text.disabled' : 'text.primary',
                lineHeight: 1.2,
              }}
            >
              {item.userDisplayName}
            </Typography>

            {/* 未確認インジケーター */}
            {!isSeen && (
              <FiberManualRecordIcon
                sx={{
                  fontSize: 8,
                  color: 'warning.main',
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.4 },
                  },
                }}
              />
            )}

            <Box sx={{ flexGrow: 1 }} />

            {/* ステータスバッジ（右端固定） */}
            <Chip
              size="small"
              label={HANDOFF_STATUS_META[item.status].label}
              color={HANDOFF_STATUS_META[item.status].color}
              variant={isCompleted ? 'filled' : 'outlined'}
              onClick={handleStatusToggle}
              clickable
              icon={
                isCompleted ? <CheckCircleIcon /> :
                item.status === '対応中' ? <AccessTimeIcon /> :
                <RadioButtonUncheckedIcon />
              }
              sx={{
                fontWeight: 600,
                fontSize: '0.7rem',
                height: 26,
                transition: 'transform 0.2s ease',
                '&:active': { transform: 'scale(0.95)' },
              }}
            />
          </Stack>

          {/* ── ROW 2: タグ行（カテゴリ + 重要度 + 時間帯） ── */}
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 0.25 }}>
            <Chip
              size="small"
              label={item.category}
              variant="outlined"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                borderColor: 'divider',
                color: 'text.secondary',
              }}
            />

            {item.severity !== '通常' && (
              <Chip
                size="small"
                label={item.severity}
                color={getSeverityColor(item.severity)}
                variant="filled"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                }}
              />
            )}

            <Chip
              size="small"
              label={item.timeBand}
              variant="outlined"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                borderColor: 'divider',
                color: 'text.secondary',
              }}
            />

            <Box sx={{ flexGrow: 1 }} />

            {/* 記録者（小さく右寄せ） */}
            <Typography
              variant="caption"
              sx={{
                color: 'text.disabled',
                fontSize: '0.6rem',
                whiteSpace: 'nowrap',
              }}
            >
              by {item.createdByName}
            </Typography>
          </Stack>

          {/* ── ROW 3: 本文 ── */}
          <Box sx={{ pt: 0.25 }}>
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                fontSize: '0.825rem',
                color: isCompleted ? 'text.disabled' : 'text.primary',
                ...(isCompleted && {
                  textDecoration: 'line-through',
                  textDecorationColor: 'rgba(0,0,0,0.2)',
                }),
              }}
              onClick={!isLongMessage ? markSeen : undefined}
            >
              {displayMessage}
            </Typography>

            {/* 展開/折りたたみ */}
            {isLongMessage && (
              <Button
                size="small"
                onClick={handleToggleExpand}
                endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{
                  mt: 0.25,
                  p: 0,
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  textTransform: 'none',
                }}
              >
                {expanded ? '折りたたむ' : '続きを読む'}
              </Button>
            )}
          </Box>

          {/* ── 展開時: コメント + 更新履歴タブ (Collapseでアニメーション) ── */}
          <Collapse in={expanded} timeout={250}>
            <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Tabs
                value={detailTab}
                onChange={(_, v) => setDetailTab(v)}
                variant="fullWidth"
                sx={{
                  minHeight: 32,
                  '& .MuiTab-root': { minHeight: 32, py: 0.5, fontSize: '0.72rem' },
                }}
              >
                <Tab
                  icon={<ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />}
                  iconPosition="start"
                  label="コメント"
                />
                <Tab
                  icon={<HistoryIcon sx={{ fontSize: 14 }} />}
                  iconPosition="start"
                  label="更新履歴"
                />
              </Tabs>
              <Box sx={{ pt: 1 }}>
                {detailTab === 0 && (
                  <HandoffCommentThread handoffId={item.id} />
                )}
                {detailTab === 1 && (
                  <HandoffAuditLogView handoffId={item.id} />
                )}
              </Box>
            </Box>
          </Collapse>

          {/* Phase 2-1: この利用者の記録を開くCTA */}
          {item.userCode && item.userCode !== 'ALL' && (
            <Box sx={{ mt: 1, pt: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                size="small"
                variant="text"
                startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                onClick={handleOpenDailyRecord}
                data-testid="handoff-open-daily-highlight"
                sx={{
                  justifyContent: 'flex-start',
                  fontSize: '0.72rem',
                  color: 'text.secondary',
                  textTransform: 'none',
                  py: 0.25,
                  '&:hover': { color: 'primary.main' },
                }}
              >
                この利用者の記録を開く
              </Button>
            </Box>
          )}

          {/* v3: モード別アクションボタン */}
          {meetingMode !== 'normal' && workflowActions && (() => {
            const allowed = getAllowedActions(item.status, meetingMode);
            if (allowed.length === 0) return null;

            const ACTION_META: Record<string, { label: string; emoji: string; color: 'primary' | 'warning' | 'success' }> = {
              '確認済': { label: '確認済', emoji: '✅', color: 'primary' },
              '明日へ持越': { label: '明日へ', emoji: '📅', color: 'warning' },
              '完了': { label: '完了', emoji: '🔒', color: 'success' },
              '対応済': { label: '完了', emoji: '✅', color: 'success' },
            };

            const handleAction = async (targetStatus: HandoffStatus) => {
              if (isSaving) return;
              setIsSaving(true);
              setStatusPulse(true);
              try {
                if (targetStatus === '確認済') await workflowActions.markReviewed(item.id);
                else if (targetStatus === '明日へ持越') await workflowActions.markCarryOver(item.id);
                else if (targetStatus === '完了' || targetStatus === '対応済') await workflowActions.markClosed(item.id);
              } finally {
                setIsSaving(false);
                setTimeout(() => setStatusPulse(false), 600);
              }
            };

            return (
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1}>
                  {allowed.map((targetStatus) => {
                    const meta = ACTION_META[targetStatus];
                    if (!meta) return null;
                    return (
                      <Button
                        key={targetStatus}
                        size="small"
                        variant="outlined"
                        color={meta.color}
                        disabled={isSaving}
                        onClick={() => handleAction(targetStatus)}
                        aria-label={`${meta.label}: ${item.title}`}
                        sx={{
                          minWidth: 48,
                          minHeight: 44,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          borderRadius: 2,
                          transition: 'all 0.2s ease',
                          '&:active': { transform: 'scale(0.97)' },
                        }}
                      >
                        {meta.emoji} {meta.label}
                      </Button>
                    );
                  })}
                </Stack>
              </Box>
            );
          })()}
        </Stack>
      </CardContent>
    </Card>
  );
};
